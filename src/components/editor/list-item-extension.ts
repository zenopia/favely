import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin } from 'prosemirror-state'
import { splitListItem, liftListItem, sinkListItem } from '@tiptap/pm/schema-list'
import { EditorView, DecorationSet } from 'prosemirror-view'
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
      /**
       * Toggle the completed state of a list item
       */
      toggleCompleted: () => ReturnType,
    }
  }
}

declare module '@tiptap/core' {
  interface EditorOptions {
    onCompletedChange?: (completed: boolean, nodeId: string) => void
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
  nodeId?: string,
  completed?: boolean,
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
      draggedNodeId: null as string | null,
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
      completed: {
        default: false,
        parseHTML: element => element.getAttribute('data-completed') === 'true',
        renderHTML: attributes => {
          // Always render the data-completed attribute
          return { 'data-completed': attributes.completed ? 'true' : 'false' }
        },
      },
      tag: {
        default: null,
        parseHTML: element => {
          const tag = element.getAttribute('data-tag');
          return tag === '' ? null : tag;
        },
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
      nodeId: {
        default: null,
        parseHTML: element => element.getAttribute('data-node-id') || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        renderHTML: attributes => {
          if (!attributes.nodeId) {
            return {}
          }
          return { 'data-node-id': attributes.nodeId }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'li',
        getAttrs: element => {
          if (typeof element === 'string') return {};
          
          const tag = element.getAttribute('data-tag');
          const category = element.getAttribute('data-category');
          const rawCompleted = element.getAttribute('data-completed');
          const completed = rawCompleted === 'true';
          const nodeId = element.getAttribute('data-node-id');
          
          return {
            tag: tag || null,
            category: category || null,
            completed,
            nodeId: nodeId || null,
          };
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const mergedAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes);
    return ['li', mergedAttrs, 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ListItemView)
  },

  addCommands() {
    return {
      toggleListItem: () => ({ commands }) => {
        return false
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
        const { $from } = state.selection

        // Get the current list item's position and node
        let listItemPos = null
        let listItemNode = null
        let depth = $from.depth
        
        // Walk up the tree to find the list item node
        while (depth > 0) {
          const node = $from.node(depth)
          if (node.type.name === 'listItem') {
            listItemPos = $from.before(depth)
            listItemNode = node
            break
          }
          depth--
        }

        if (listItemPos === null || !listItemNode) return false

        // Check if we're already in a nested list
        const grandParent = $from.node(-3)
        if (grandParent && grandParent.type.name === 'listItem') {
          return false
        }

        // Check if this item has any direct child lists
        let hasChildList = false
        listItemNode.content.forEach(child => {
          if (child.type.name === 'bulletList' || child.type.name === 'orderedList') {
            hasChildList = true
          }
        })

        // Don't allow indentation if the node has child lists
        if (hasChildList) {
          return false
        }

        // Check if there's a previous sibling that we can indent under
        const $pos = state.doc.resolve(listItemPos)
        const index = $pos.index()
        if (index === 0) {
          return false // Can't indent the first item
        }

        return sinkListItem(state.schema.nodes.listItem)(state, dispatch)
      },
      liftListItem: () => ({ state, dispatch }) => {
        // Only allow lifting if we're not in the outermost list
        const { $from } = state.selection
        const grandParent = $from.node(-3)
        
        // If we're in a nested list (has listItem grandparent)
        if (grandParent && grandParent.type.name === 'listItem') {
          return liftListItem(state.schema.nodes.listItem)(state, dispatch)
        }
        
        // Don't allow lifting from the outermost list
        return false
      },
      toggleCompleted: () => ({ state, dispatch }) => {
        const { selection } = state
        const { $from } = selection
        
        let depth = $from.depth
        let pos = $from.start()
        
        while (depth > 0) {
          const node = $from.node(depth)
          if (node.type.name === 'listItem') {
            pos = $from.before(depth)
            const currentCompleted = node.attrs.completed || false
            
            if (dispatch) {
              const tr = state.tr
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                completed: !currentCompleted
              })
              dispatch(tr)

              const editor = this.editor
              if (editor && editor.options.onCompletedChange) {
                editor.options.onCompletedChange(!currentCompleted, node.attrs.nodeId)
              }
            }
            return true
          }
          depth--
        }
        
        return false
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { $from, empty } = this.editor.state.selection
        const node = $from.node()

        // Check if current node is empty
        const isEmpty = node.content.size === 0 || 
          (node.content.size === 2 && node.firstChild?.type.name === 'paragraph' && node.firstChild.content.size === 0)

        // If the current node is empty, prevent creating a new one
        if (empty && isEmpty) {
          return true // Prevent default behavior and stop propagation
        }

        // Otherwise, proceed with normal split
        return this.editor.commands.splitListItem()
      },
      Tab: () => {
        return this.editor.commands.sinkListItem()
      },
      'Shift-Tab': () => {
        return this.editor.commands.liftListItem()
      },
      // Prevent Backspace from breaking out of list when at start of first item
      Backspace: () => {
        const { empty, $anchor } = this.editor.state.selection
        const isAtStart = $anchor.pos === 1

        // If we're at the very start of the first list item
        if (empty && isAtStart) {
          return true // Prevent default behavior
        }

        return false // Let other handlers take care of it
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
              tr.setNodeMarkup(pos, undefined, { 
                ...node.attrs, 
                active: false,
                completed: node.attrs.completed // Preserve completed state
              })
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
              tr.setNodeMarkup(listItemPos, undefined, { 
                ...node.attrs, 
                active: true,
                completed: node.attrs.completed // Preserve completed state
              })
              this.storage.activeItemPos = listItemPos
            }
          }

          return tr
        }
      }),

      // Plugin to disable ProseMirror's default drag behavior
      new Plugin({
        props: {
          nodeViews: {
            listItem: (_node, _view, _getPos) => {
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
          createSelectionBetween: () => null,
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
              return false
            },
            dragend: (view, event) => {
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
            const draggedTag = this.storage.draggedTag
            const draggedNodeId = this.storage.draggedNodeId

            if (activeItemPos === null) return false

            try {
              // Get the source item's depth/level
              const $sourcePos = state.doc.resolve(activeItemPos)
              const sourceDepth = $sourcePos.depth
              const sourceNode = state.doc.nodeAt(activeItemPos)
              if (!sourceNode) return false

              // Store original nodes and their attributes from initial state
              const originalNodesByPosition = new Map()
              const originalNodesById = new Map()
              
              // Find the node under the dragged item
              const nodeUnderDragged = state.doc.nodeAt(activeItemPos + sourceNode.nodeSize)
              const nodeUnderDraggedPos = activeItemPos + sourceNode.nodeSize
              
              // Store the original attributes of the node under the dragged item
              const nodeUnderDraggedOriginalAttrs = nodeUnderDragged ? { ...nodeUnderDragged.attrs } : null

              state.doc.descendants((node, pos) => {
                if (node.type.name === 'listItem') {
                  // Store complete node attributes by position and ID
                  originalNodesByPosition.set(pos, {
                    attrs: { ...node.attrs },
                    nodeSize: node.nodeSize
                  })
                  originalNodesById.set(node.attrs.nodeId, {
                    attrs: { ...node.attrs },
                    nodeSize: node.nodeSize,
                    pos: pos
                  })
                }
              })

              // Create a single transaction for all changes
              const tr = state.tr

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
              const dropBuffer = 20

              if (relativeY > lastItemBottom - dropBuffer) {
                const $lastPos = state.doc.resolve(lastItem.pos)
                const parentDepth = $lastPos.depth - 1
                const parentNode = $lastPos.node(parentDepth)
                
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

              // Store the dragged node's attributes
              const draggedNodeAttrs = { ...sourceNode.attrs }
              const draggedNodeCompleted = draggedNodeAttrs.completed || false
              const draggedNodeId = draggedNodeAttrs.nodeId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

              // Delete the old node
              tr.delete(activeItemPos, sourceNodeEnd)

              // Create new node with preserved completed state
              const newNode = sourceNode.type.create(
                {
                  ...draggedNodeAttrs,
                  active: true,
                  dragging: false,
                  nodeId: draggedNodeId,
                  completed: draggedNodeCompleted
                },
                sourceNode.content,
                sourceNode.marks
              )

              // Insert at the target position
              tr.insert(insertPos, newNode)

              dispatch(tr.scrollIntoView())
              clearDropTargets(view)
              return true
            } catch (error) {
              clearDropTargets(view)
              return false
            }
          }
        }
      }),

      // Plugin to maintain list structure
      new Plugin({
        appendTransaction: (transactions, oldState, newState) => {
          // Skip if no changes
          if (!transactions.some(tr => tr.docChanged)) return null

          const tr = newState.tr

          // If document is empty or has no list items, create one
          if (newState.doc.childCount === 0 || !newState.doc.firstChild?.type.name.includes('List')) {
            const listType = this.editor.isActive('bulletList') ? 'bulletList' : 'orderedList'
            tr.replaceWith(0, newState.doc.content.size, this.editor.schema.nodes[listType].create(
              null,
              [this.editor.schema.nodes.listItem.create(
                null,
                [this.editor.schema.nodes.paragraph.create()]
              )]
            ))
            return tr
          }

          return null
        }
      })
    ]
  },
}) 