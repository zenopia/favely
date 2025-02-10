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
      draggedTag: null as string | null,
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
              this.storage.activeItemPos = listItemPos
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
                this.storage.isDragging = true
                return true
              }
              return false
            },
            drop: (view, event) => {
              // Don't clear anything here - handleDrop will handle cleanup
              return false
            },
            dragend: (view, event) => {
              // Only clear if we're not in the middle of a drop operation
              if (!view.hasFocus()) {
                this.storage.isDragging = false
                this.storage.draggedTag = null
              }
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
            const draggedTag = this.storage.draggedTag // Capture tag before any operations

            if (activeItemPos === null) return false

            try {
              // Get the source item's depth/level
              const $sourcePos = state.doc.resolve(activeItemPos)
              const sourceDepth = $sourcePos.depth
              const sourceNode = state.doc.nodeAt(activeItemPos)
              if (!sourceNode) return false

              // Create a single transaction for all changes
              const dropTr = state.tr

              // Store the source node's complete state
              const sourceNodeSize = sourceNode.nodeSize
              const sourceNodeEnd = activeItemPos + sourceNodeSize

              // Get coordinates relative to the editor
              const editorRect = view.dom.getBoundingClientRect()
              const relativeY = event.clientY - editorRect.top

              // Find all list items and their positions at the same depth
              const listItems: { node: ProseMirrorNode, pos: number, rect?: DOMRect }[] = []
              state.doc.descendants((node, pos) => {
                if (node.type.name === 'listItem') {
                  const $pos = state.doc.resolve(pos)
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
              const dropBuffer = 20 // Reduced from 100 to make it less sensitive

              if (relativeY > lastItemBottom - dropBuffer) {
                const $lastPos = state.doc.resolve(lastItem.pos)
                const parentDepth = $lastPos.depth - 1
                const parentNode = $lastPos.node(parentDepth)
                
                // Only allow dropping at the end if we're in the same parent list
                if ($lastPos.depth === sourceDepth && parentNode.type.name === $sourcePos.node(sourceDepth - 1).type.name) {
                  targetPos = lastItem.pos
                  insertAfter = true
                  
                  const parentEnd = $lastPos.end(parentDepth)
                  const lastNode = state.doc.nodeAt(lastItem.pos)
                  
                  if (lastNode) {
                    targetPos = Math.min(parentEnd - 1, lastItem.pos + lastNode.nodeSize)
                  }
                } else {
                  return false
                }
              } else {
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

              // Calculate insert position
              let insertPos = targetPos
              if (insertAfter) {
                const parentDepth = $targetPos.depth - 1
                const parentNode = $targetPos.node(parentDepth)
                const targetNode = $targetPos.nodeAfter

                if (parentNode && (parentNode.type.name === 'bulletList' || parentNode.type.name === 'orderedList')) {
                  if (relativeY > lastItemBottom - dropBuffer) {
                    insertPos = $targetPos.end(parentDepth) - 1
                  } else if (targetNode) {
                    insertPos = $targetPos.pos + targetNode.nodeSize
                  } else {
                    insertPos = $targetPos.end(parentDepth) - 1
                  }
                }
              }

              // Adjust insert position if it was after the deleted node
              if (insertPos > activeItemPos) {
                insertPos -= sourceNodeSize
              }

              // Final bounds check
              const $insertPos = state.doc.resolve(insertPos)
              const parentEnd = $insertPos.end($insertPos.depth - 1)
              insertPos = Math.max(0, Math.min(insertPos, parentEnd))

              // Create a new node with the preserved tag
              const finalAttrs = {
                active: true,
                dragging: false,
                tag: draggedTag || sourceNode.attrs.tag,
                category: sourceNode.attrs.category
              }

              // Create the new node
              const newNode = sourceNode.type.create(
                { ...finalAttrs, _key: Date.now() },
                sourceNode.content,
                sourceNode.marks
              )

              // Delete the old node
              dropTr.delete(activeItemPos, sourceNodeEnd)

              // Insert the new node
              dropTr.insert(insertPos, newNode)

              // Set the node's final attributes
              dropTr.setNodeMarkup(insertPos, undefined, finalAttrs)

              // Dispatch all changes at once
              dispatch(dropTr)

              // Update storage
              this.storage.activeItemPos = insertPos
              this.storage.draggedTag = null

              // Set the active state and force a re-render
              this.editor.commands.command(({ state: commandState, dispatch: commandDispatch }) => {
                if (!commandDispatch) return true
                const updateTr = commandState.tr
                const node = updateTr.doc.nodeAt(insertPos)
                if (node) {
                  updateTr.setNodeMarkup(insertPos, undefined, {
                    ...finalAttrs,
                    _forceUpdate: Date.now()
                  })
                  commandDispatch(updateTr)
                }
                return true
              })

              // Clear drop targets
              clearDropTargets(view)

              return true
            } catch (error) {
              console.error('Error during drag and drop:', error)
              this.storage.activeItemPos = null
              clearDropTargets(view)
              return false
            }
          }
        }
      })
    ]
  },
}) 