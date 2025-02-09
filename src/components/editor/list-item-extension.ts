import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin } from 'prosemirror-state'
import { splitListItem, liftListItem, sinkListItem } from '@tiptap/pm/schema-list'
import { EditorView, DecorationSet } from 'prosemirror-view'
import { TextSelection } from 'prosemirror-state'
import ListItemView from './list-item-view'
import { Slice, Node as ProseMirrorNode } from 'prosemirror-model'

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
       * Set a tag for the list item
       */
      setListItemTag: (tag: string) => ReturnType,
      /**
       * Split list item at current position
       */
      splitListItem: () => ReturnType,
      /**
       * Sink the list item down into an inner list
       */
      sinkListItem: () => ReturnType,
      /**
       * Lift the list item up from the inner list
       */
      liftListItem: () => ReturnType,
    }
  }
}

declare module 'prosemirror-state' {
  interface EditorProps {
    handleDragStart?: (view: EditorView, event: DragEvent) => boolean | void
    handleDragOver?: (view: EditorView, event: DragEvent) => boolean | void
    handleDragLeave?: (view: EditorView, event: DragEvent) => boolean | void
    handleDragEnd?: (view: EditorView, event: DragEvent) => boolean | void
    handleDrop?: (view: EditorView, event: DragEvent, slice: Slice, moved: boolean) => boolean | void
    createSelectionBetween?: (view: EditorView) => null
  }
}

export interface ListItemAttributes {
  active?: boolean,
  dragging?: boolean,
  tag?: string,
  category?: string,
}

// Custom drag view to override ProseMirror's default
class _EmptyDragView {
  slice: Slice
  move: boolean

  constructor(_node: ProseMirrorNode,_view: EditorView, _event: DragEvent) {
    this.slice = Slice.empty
    this.move = false
  }
  
  destroy() {}
  update() { return false }
  setDropPos() {}
  get pos() { return -1 }
}

export const ListItemExtension = Node.create({
  name: 'listItem',

  addOptions() {
    return {
      HTMLAttributes: {},
      draggable: true,
      nested: true,
    }
  },

  group: 'listItem',

  // Update content to wrap text in paragraph nodes
  content: '(paragraph | bulletList | orderedList)*',

  defining: true,

  addStorage() {
    return {
      activeItemPos: null as number | null,
      isDragging: false,
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
      tag: {
        default: null,
        parseHTML: element => element.getAttribute('data-tag'),
        renderHTML: attributes => {
          if (!attributes.tag) {
            return {}
          }
          return { 'data-tag': attributes.tag }
        },
      },
      category: {
        default: null,
        parseHTML: element => element.getAttribute('data-category'),
        renderHTML: attributes => {
          if (!attributes.category) {
            return {}
          }
          return { 'data-category': attributes.category }
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

        try {
          // Clear active state from all list items
          tr.doc.descendants((node, pos) => {
            if (node.type.name === 'listItem') {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, active: false })
            }
          })

          // Set active state for the selected item only
          if (pos !== null && tr.doc.nodeAt(pos)?.type.name === 'listItem') {
            tr.setNodeMarkup(pos, undefined, { active: true })
            this.storage.activeItemPos = pos
          } else {
            this.storage.activeItemPos = null
          }
        } catch (error) {
          // If setting active state fails, clear it
          this.storage.activeItemPos = null
        }

        return true
      },
      setListItemTag: (tag: string) => ({ tr, state, dispatch }) => {
        const { selection } = state
        const position = selection.$anchor.pos
        const node = state.doc.nodeAt(position)
        
        if (!node || node.type.name !== 'listItem') return false
        
        if (dispatch) {
          tr.setNodeMarkup(position, undefined, {
            ...node.attrs,
            tag,
          })
          return dispatch(tr)
        }
        
        return true
      },
      splitListItem: () => ({ state, dispatch }) => {
        return splitListItem(state.schema.nodes.listItem)(state, dispatch)
      },
      sinkListItem: () => ({ state, dispatch }) => {
        // Only allow sinking if we're not already in a nested list
        const { $from } = state.selection
        const grandParent = $from.node(-3)
        if (grandParent && grandParent.type.name === 'listItem') {
          // Already nested, don't allow further nesting
          return false
        }
        return sinkListItem(state.schema.nodes.listItem)(state, dispatch)
      },
      liftListItem: () => ({ state, dispatch }) => {
        // Only allow lifting if we're not in the outermost list
        const { $from } = state.selection
        const grandParent = $from.node(-3)
        const greatGrandParent = $from.node(-4)
        
        // If we're in a nested list (has listItem grandparent)
        if (grandParent && grandParent.type.name === 'listItem') {
          return liftListItem(state.schema.nodes.listItem)(state, dispatch)
        }
        
        // Don't allow lifting from the outermost list
        return false
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        return this.editor.commands.splitListItem()
      },
      Tab: () => {
        return this.editor.commands.sinkListItem()
      },
      'Shift-Tab': () => {
        return this.editor.commands.liftListItem()
      },
    }
  },

  addProseMirrorPlugins() {
    const extension = this
    const clearDropTargets = (view: EditorView) => {
      const domNodes = view.dom.querySelectorAll('.drop-target')
      domNodes.forEach((el: Element) => {
        el.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom', 'drop-target-active')
      })
    }

    return [
      // Plugin to track selection changes and update active state
      new Plugin({
        appendTransaction: (transactions, oldState, newState) => {
          // Only proceed if the selection has changed
          if (oldState.selection.eq(newState.selection)) return null

          const tr = newState.tr

          // Clear active state from all list items
          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'listItem') {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, active: false })
            }
          })

          // Find the list item that contains the current selection
          const $from = newState.selection.$from
          let depth = $from.depth
          let listItemPos = null

          // Walk up the tree to find the closest list item
          while (depth > 0) {
            const node = $from.node(depth)
            if (node.type.name === 'listItem') {
              listItemPos = $from.before(depth)
              break
            }
            depth--
          }

          // Set active state for the selected item
          if (listItemPos !== null) {
            const node = newState.doc.nodeAt(listItemPos)
            if (node) {
              tr.setNodeMarkup(listItemPos, undefined, { ...node.attrs, active: true })
              extension.storage.activeItemPos = listItemPos
            }
          }

          return tr
        }
      }),

      // Plugin to disable ProseMirror's default drag behavior
      new Plugin({
        props: {
          // Prevent ProseMirror from creating drag decorations
          nodeViews: {
            listItem: (_node, _view, _getPos) => {
              // Disable ProseMirror's built-in drag decoration for list items
              return {
                dom: document.createElement('li'),
                contentDOM: document.createElement('div'),
                ignoreMutation: () => true,
                stopEvent: (_event) => {
                  return _event.type.startsWith('drag')
                }
              }
            }
          },
          // Prevent selection during drag
          createSelectionBetween: () => null,
          // Prevent default decorations
          decorations: () => DecorationSet.empty
        }
      }),

      // Plugin to handle drag events
      new Plugin({
        props: {
          handleDOMEvents: {
            dragstart: (view, event) => {
              if (event.target instanceof HTMLElement && event.target.closest('[data-drag-handle]')) {
                extension.storage.isDragging = true
                return true
              }
              return false
            },
            drop: (view, event) => {
              extension.storage.isDragging = false
              return false
            },
            dragend: (view, event) => {
              extension.storage.isDragging = false
              return false
            },
          }
        }
      }),

      // Our custom drag and drop plugin
      new Plugin({
        props: {
          handleDrop: (view: EditorView, event: DragEvent, _slice: Slice, _moved: boolean) => {
            const { state, dispatch } = view
            const { activeItemPos } = this.storage

            if (activeItemPos === null) return false

            // Get the source item's depth/level
            const $sourcePos = state.doc.resolve(activeItemPos)
            const sourceDepth = $sourcePos.depth
            const sourceNode = state.doc.nodeAt(activeItemPos)
            if (!sourceNode) return false

            // Get coordinates relative to the editor
            const editorRect = view.dom.getBoundingClientRect()
            const relativeY = event.clientY - editorRect.top

            // Find all list items and their positions at the same depth
            const listItems: { node: ProseMirrorNode, pos: number, rect?: DOMRect }[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'listItem') {
                const $pos = state.doc.resolve(pos)
                // Only include items at the same depth as the source item
                if ($pos.depth === sourceDepth) {
                  const el = view.nodeDOM(pos) as HTMLElement
                  if (el instanceof HTMLElement) {
                    listItems.push({ 
                      node, 
                      pos,
                      rect: el.getBoundingClientRect()
                    })
                  }
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

            // Handle dropping at the end of the list
            const lastItem = listItems[listItems.length - 1]
            const lastItemBottom = lastItem.rect ? lastItem.rect.bottom - editorRect.top : 0
            // Add a generous buffer zone below the last item (100px)
            const dropBuffer = 100

            if (relativeY > lastItemBottom - dropBuffer) {
              // Find the parent list of the last item
              const $lastPos = state.doc.resolve(lastItem.pos)
              const parentDepth = $lastPos.depth - 1
              
              // Only allow dropping if we're at the same depth
              if ($lastPos.depth === sourceDepth) {
                // Set target to the last item's position
                targetPos = lastItem.pos
                insertAfter = true
                
                // Get the parent list end position
                const parentEnd = $lastPos.end(parentDepth)
                const lastNode = state.doc.nodeAt(lastItem.pos)
                
                // Calculate the position after the last item
                if (lastNode) {
                  targetPos = Math.min(parentEnd - 1, lastItem.pos + lastNode.nodeSize)
                }
              } else {
                return false
              }
            } else {
              // Find which item we're closest to vertically
              for (let i = 0; i < listItems.length; i++) {
                const item = listItems[i]
                if (!item.rect) continue

                const itemMiddleY = item.rect.top + (item.rect.height / 2) - editorRect.top

                if (i === listItems.length - 1 && relativeY > itemMiddleY - dropBuffer) {
                  targetPos = item.pos
                  insertAfter = true
                  break
                }

                if (relativeY <= itemMiddleY) {
                  targetPos = item.pos
                  insertAfter = false
                  break
                }

                const nextItem = listItems[i + 1]
                if (!nextItem || !nextItem.rect) {
                  targetPos = item.pos
                  insertAfter = true
                  break
                }
              }
            }

            // Verify target position is at the same depth
            const $targetPos = state.doc.resolve(targetPos)
            if ($targetPos.depth !== sourceDepth) {
              return false
            }

            if (targetPos === activeItemPos) return false

            const tr = state.tr
            
            // Get the full size of the source node including children
            const sourceNodeSize = sourceNode.nodeSize
            const sourceNodeEnd = activeItemPos + sourceNodeSize

            // Calculate the insert position before deleting the source node
            let insertPos
            if (insertAfter) {
              // When inserting after, ensure we stay within the parent list
              const parentDepth = $targetPos.depth - 1
              const parentNode = $targetPos.node(parentDepth)
              const targetNode = $targetPos.nodeAfter
              
              if (parentNode && (parentNode.type.name === 'bulletList' || parentNode.type.name === 'orderedList')) {
                // For the last position, use the parent list end position
                if (relativeY > lastItemBottom - dropBuffer) {
                  insertPos = $targetPos.end(parentDepth) - 1
                } else if (targetNode) {
                  insertPos = $targetPos.pos + targetNode.nodeSize
                } else {
                  insertPos = $targetPos.end(parentDepth) - 1
                }
              } else {
                insertPos = targetPos
              }
            } else {
              insertPos = targetPos
            }

            // Delete the node from its current position
            tr.delete(activeItemPos, sourceNodeEnd)
            
            // Adjust insert position if it was after the deleted node
            if (insertPos > activeItemPos) {
              insertPos -= sourceNodeSize
            }
            
            // Final bounds check and ensure we're within the parent list
            const $insertPos = state.doc.resolve(insertPos)
            const parentEnd = $insertPos.end($insertPos.depth - 1)
            insertPos = Math.max(0, Math.min(insertPos, parentEnd))
            
            // Insert the node at the new position
            tr.insert(insertPos, sourceNode)
            
            // Update storage and dispatch
            this.storage.activeItemPos = insertPos
            dispatch(tr)

            // Set the active state and handle the range error
            try {
              this.editor.commands.setListItemActive(insertPos)
            } catch (error) {
              // If setting active state fails, clear it
              this.storage.activeItemPos = null
            }
            
            // Clear drop targets after successful drop
            clearDropTargets(view)
            
            return true
          }
        }
      })
    ]
  },
}) 