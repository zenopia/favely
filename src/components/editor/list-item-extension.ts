import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin } from 'prosemirror-state'
import { keymap } from 'prosemirror-keymap'
import { splitListItem } from '@tiptap/pm/schema-list'
import ListItemView from './list-item-view'

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
      setListItemActive: (pos: number | null) => ({ tr, state, dispatch }) => {
        if (!dispatch) return true

        // Clear active state from all list items
        state.doc.descendants((node, pos) => {
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
    const plugin = new Plugin({
      props: {
        handleDrop(view, event, slice, moved) {
          const { state, dispatch } = view
          const { activeItemPos } = this.spec.extension.storage

          if (activeItemPos === null || !event.dataTransfer) return false

          // Get coordinates relative to the editor
          const editorRect = view.dom.getBoundingClientRect()
          const relativeY = event.clientY - editorRect.top

          // Find all list items and their positions
          const listItems: { node: any, pos: number, rect?: DOMRect }[] = []
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'listItem') {
              const el = view.nodeDOM(pos) as HTMLElement
              if (el) {
                listItems.push({ 
                  node, 
                  pos,
                  rect: el.getBoundingClientRect()
                })
              }
            }
          })

          if (listItems.length === 0) return false

          // Sort list items by their vertical position
          listItems.sort((a, b) => {
            if (!a.rect || !b.rect) return 0
            return a.rect.top - b.rect.top
          })

          // Find the target position
          let targetPos = listItems[0].pos
          let insertAfter = false

          // Find which item we're closest to vertically
          for (let i = 0; i < listItems.length; i++) {
            const item = listItems[i]
            if (!item.rect) continue

            const itemMiddleY = item.rect.top + (item.rect.height / 2) - editorRect.top

            if (i === listItems.length - 1 && relativeY > itemMiddleY) {
              // If we're past the middle of the last item, insert after it
              targetPos = item.pos
              insertAfter = true
              break
            }

            const nextItem = listItems[i + 1]
            if (!nextItem || !nextItem.rect) {
              // If this is the last item or next item has no rect
              if (relativeY <= itemMiddleY) {
                targetPos = item.pos
                insertAfter = false
                break
              }
              continue
            }

            const nextItemMiddleY = nextItem.rect.top + (nextItem.rect.height / 2) - editorRect.top

            if (relativeY <= itemMiddleY) {
              // Insert before current item
              targetPos = item.pos
              insertAfter = false
              break
            } else if (relativeY <= nextItemMiddleY) {
              // Insert after current item
              targetPos = item.pos
              insertAfter = true
              break
            }
          }

          // Adjust target position if inserting after an item
          if (insertAfter) {
            const targetNode = state.doc.nodeAt(targetPos)
            if (targetNode) {
              targetPos += targetNode.nodeSize
            }
          }

          if (targetPos === activeItemPos) return false

          // Move the node
          const sourceNode = state.doc.nodeAt(activeItemPos)
          if (!sourceNode) return false

          const tr = state.tr
          tr.delete(activeItemPos, activeItemPos + sourceNode.nodeSize)
          
          // Adjust insert position if needed
          if (targetPos > activeItemPos) {
            targetPos -= sourceNode.nodeSize
          }
          
          tr.insert(targetPos, sourceNode)
          dispatch(tr)
          return true
        }
      }
    })

    // Add a reference to the extension instance
    plugin.spec.extension = this

    return [plugin]
  },
}) 