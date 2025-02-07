import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin } from 'prosemirror-state'
import { splitListItem } from '@tiptap/pm/schema-list'
import { EditorView } from 'prosemirror-view'
import { TextSelection } from 'prosemirror-state'
import ListItemView from './list-item-view'
import { Slice } from 'prosemirror-model'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    listItem: {
      /**
       * Toggle a list item
       */
      toggleListItem: () => ReturnType,
      /**
       * Set the active state of a list item
       */
      setListItemActive: (pos: number | null) => ReturnType,
      /**
       * Split list item at current position
       */
      splitListItem: () => ReturnType,
    }
  }
}

declare module 'prosemirror-state' {
  interface EditorProps {
    handleDragOver?: (view: EditorView, event: DragEvent) => boolean | void
    handleDragLeave?: (view: EditorView, event: DragEvent) => boolean | void
    handleDrop?: (view: EditorView, event: DragEvent, slice: Slice, moved: boolean) => boolean | void
  }
}

export interface ListItemAttributes {
  active?: boolean,
  dragging?: boolean,
}

export const ListItemExtension = Node.create({
  name: 'listItem',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  content: 'paragraph block*',

  defining: true,

  draggable: true,

  addStorage() {
    return {
      activeItemPos: null as number | null,
    }
  },

  addAttributes() {
    return {
      active: {
        default: false,
        parseHTML: element => element.getAttribute('data-active') === 'true',
        renderHTML: attributes => {
          if (!attributes.active) {
            return {}
          }
          return { 'data-active': 'true' }
        },
      },
      dragging: {
        default: false,
        parseHTML: element => element.getAttribute('data-dragging') === 'true',
        renderHTML: attributes => {
          if (!attributes.dragging) {
            return {}
          }
          return { 'data-dragging': 'true' }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'li',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['li', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ListItemView)
  },

  addCommands() {
    return {
      toggleListItem: () => ({ commands }) => {
        return commands.toggleList('listItem', 'paragraph')
      },
      setListItemActive: (pos: number | null) => ({ tr, dispatch }) => {
        if (!dispatch) return true

        // Clear active state from all list items
        tr.doc.descendants((node, pos) => {
          if (node.type.name === 'listItem') {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, active: false })
          }
        })

        // Set active state for the selected item
        if (pos !== null) {
          tr.setNodeMarkup(pos, undefined, { active: true })
          this.storage.activeItemPos = pos
        } else {
          this.storage.activeItemPos = null
        }

        return true
      },
      splitListItem: () => ({ state, dispatch }) => {
        return splitListItem(state.schema.nodes.listItem)(state, dispatch)
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        return this.editor.commands.splitListItem()
      },
    }
  },

  addProseMirrorPlugins() {
    const clearDropTargets = (view: EditorView) => {
      const domNodes = view.dom.querySelectorAll('.drop-target')
      domNodes.forEach((el: Element) => {
        el.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom', 'drop-target-active')
      })
    }

    const findListItems = (view: EditorView) => {
      const items: { node: any, pos: number, rect?: DOMRect }[] = []
      view.state.doc.descendants((node, pos) => {
        if (node.type.name === 'listItem') {
          const el = view.nodeDOM(pos) as HTMLElement
          if (el) {
            items.push({ 
              node, 
              pos,
              rect: el.getBoundingClientRect()
            })
          }
        }
      })
      return items.sort((a, b) => {
        if (!a.rect || !b.rect) return 0
        return a.rect.top - b.rect.top
      })
    }

    const findDropPosition = (event: DragEvent, listItems: Array<{ node: any, pos: number, rect?: DOMRect }>, editorRect: DOMRect) => {
      const relativeY = event.clientY - editorRect.top
      const lastItem = listItems[listItems.length - 1]
      
      // Handle dropping at the end of the list
      if (lastItem && lastItem.rect && relativeY > lastItem.rect.bottom - editorRect.top) {
        return { targetPos: lastItem.pos, insertAfter: true }
      }

      // Find the closest item
      for (let i = 0; i < listItems.length; i++) {
        const item = listItems[i]
        if (!item.rect) continue

        const itemMiddleY = item.rect.top + (item.rect.height / 2) - editorRect.top
        const nextItem = listItems[i + 1]

        if (relativeY <= itemMiddleY) {
          return { targetPos: item.pos, insertAfter: false }
        }

        if (!nextItem || !nextItem.rect || relativeY <= nextItem.rect.top + (nextItem.rect.height / 2) - editorRect.top) {
          return { targetPos: item.pos, insertAfter: true }
        }
      }

      return { targetPos: listItems[0].pos, insertAfter: false }
    }

    const updateDropTarget = (targetElement: HTMLElement, relativeY: number) => {
      targetElement.classList.add('drop-target', 'drop-target-active')
      if (relativeY < targetElement.getBoundingClientRect().height / 2) {
        targetElement.classList.add('drop-target-top')
      } else {
        targetElement.classList.add('drop-target-bottom')
      }
    }

    const plugin = new Plugin({
      props: {
        handleDragOver: (view: EditorView, event: DragEvent) => {
          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })?.pos

          if (!pos) return false

          clearDropTargets(view)

          let targetElement: HTMLElement | null = null
          view.state.doc.nodesBetween(pos, pos, (node, nodePos) => {
            if (node.type.name === 'listItem') {
              const domNode = view.nodeDOM(nodePos)
              if (domNode && domNode instanceof HTMLElement) {
                targetElement = domNode
                return false
              }
            }
          })

          if (!targetElement) return false

          const rect = targetElement.getBoundingClientRect()
          const relativeY = event.clientY - rect.top
          updateDropTarget(targetElement, relativeY)

          event.preventDefault()
          return true
        },

        handleDragLeave: (view: EditorView, event: DragEvent) => {
          const relatedTarget = event.relatedTarget as Element
          if (!view.dom.contains(relatedTarget)) {
            clearDropTargets(view)
          }
          return false
        },

        handleDrop: (view: EditorView, event: DragEvent, _slice: Slice, moved: boolean) => {
          clearDropTargets(view)

          const { state, dispatch } = view
          const { activeItemPos } = this.storage

          if (activeItemPos === null || !event.dataTransfer) return false

          const listItems = findListItems(view)
          if (listItems.length === 0) return false

          const editorRect = view.dom.getBoundingClientRect()
          const { targetPos, insertAfter } = findDropPosition(event, listItems, editorRect)

          if (targetPos === activeItemPos) return false

          const sourceNode = state.doc.nodeAt(activeItemPos)
          if (!sourceNode) return false

          const tr = state.tr
          
          // Move the node
          tr.delete(activeItemPos, activeItemPos + sourceNode.nodeSize)
          
          let insertPos = targetPos
          if (insertAfter) {
            const targetNode = state.doc.nodeAt(targetPos)
            if (targetNode) {
              insertPos += targetNode.nodeSize
            }
          }
          
          if (insertPos > activeItemPos) {
            insertPos -= sourceNode.nodeSize
          }
          
          tr.insert(insertPos, sourceNode)
          dispatch(tr)
          
          // Set active state
          this.editor.commands.setListItemActive(insertPos)
          
          return true
        },

        handleClick: (view: EditorView, pos: number, event: MouseEvent) => {
          const { state, dispatch } = view
          const node = state.doc.nodeAt(pos)
          
          if (node?.type.name === 'listItem') {
            const contentPos = pos + 1
            const contentNode = state.doc.nodeAt(contentPos)
            
            if (contentNode?.type.name === 'paragraph') {
              const tr = state.tr
              tr.setSelection(TextSelection.near(tr.doc.resolve(contentPos + 1)))
              dispatch(tr)
            }
          }
          
          return false
        }
      }
    })

    return [plugin]
  },
}) 