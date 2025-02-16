import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { NodeViewWrapper, NodeViewContent, Editor, Extension } from '@tiptap/react'
import { createPortal } from 'react-dom'
import { ListItemAttributes } from './list-item-extension'
import categoryTags from '@/lib/tagMappings'
import { Tag, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ListItemViewProps {
  node: {
    attrs: ListItemAttributes
  }
  selected: boolean
  _extension?: Extension
  getPos: () => number
  editor: Editor
}

export default function ListItemView({
  node,
  selected,
  _extension,
  getPos,
  editor,
}: ListItemViewProps) {
  const { active, dragging, tag, category, completed } = node.attrs as ListItemAttributes
  const ref = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const tagButtonRef = useRef<HTMLDivElement>(null)
  const draggedTagRef = useRef<string | null>(null)
  const [showTagMenu, setShowTagMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

  // Check if this is a parent (top-level) list item
  const isParentItem = useMemo(() => {
    const pos = getPos()
    const $pos = editor.state.doc.resolve(pos)
    return $pos.depth <= 1
  }, [editor.state.doc, getPos])

  // Get all used tags in the current child list
  const getUsedTags = useCallback(() => {
    const usedTags = new Set<string>()
    const pos = getPos()
    
    try {
      // Find the parent list item
      let parentPos = pos
      let depth = editor.state.doc.resolve(pos).depth
      while (depth > 1) {
        parentPos = editor.state.doc.resolve(pos).before(depth)
        depth--
      }

      // Get all child list items and their tags
      const parentNode = editor.state.doc.nodeAt(parentPos)
      if (parentNode) {
        parentNode.descendants((node, _, parent) => {
          if (node.type.name === 'listItem' && parent && parent !== parentNode) {
            const nodeTag = node.attrs.tag
            if (nodeTag) {
              usedTags.add(nodeTag)
            }
          }
        })
      }
    } catch (error) {
      console.error('Error getting used tags:', error)
    }

    return usedTags
  }, [editor.state.doc, getPos])

  // Memoize available tags to prevent unnecessary recalculations
  const availableTags = useMemo(() => {
    try {
      // Get the parent's category
      const pos = getPos()
      const $pos = editor.state.doc.resolve(pos)
      let parentPos = pos
      let depth = $pos.depth
      let parentCategory = category

      // Find the parent list item and its category
      while (depth > 1) {
        parentPos = $pos.before(depth)
        const parentNode = editor.state.doc.nodeAt(parentPos)
        if (parentNode && parentNode.attrs.category) {
          parentCategory = parentNode.attrs.category
          break
        }
        depth--
      }

      // Use the parent's category to get available tags
      const allTags = parentCategory && parentCategory in categoryTags 
        ? categoryTags[parentCategory as keyof typeof categoryTags] 
        : []
      
      // For parent list items, return empty array (no tags allowed)
      if ($pos.depth <= 1) {
        return []
      }

      // For child list items, filter out used tags
      const usedTags = getUsedTags()
      return allTags.filter(tag => !usedTags.has(tag) || node.attrs.tag === tag)
    } catch (error) {
      console.error('Error calculating available tags:', error)
      return []
    }
  }, [category, editor.state.doc, getPos, node.attrs.tag, getUsedTags])

  // Add a function to refresh available tags and ensure category is preserved
  const refreshAvailableTags = useCallback(() => {
    const pos = getPos()
    const $pos = editor.state.doc.resolve(pos)
    let parentPos = pos
    let depth = $pos.depth
    let parentCategory = category

    // Find the parent list item and its category
    while (depth > 1) {
      parentPos = $pos.before(depth)
      const parentNode = editor.state.doc.nodeAt(parentPos)
      if (parentNode && parentNode.attrs.category) {
        parentCategory = parentNode.attrs.category
        break
      }
      depth--
    }

    editor.commands.command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        category: parentCategory // Ensure category is preserved
      })
      return true
    })
  }, [editor, getPos, node.attrs, category])

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    const pos = getPos()
    
    editor.commands.command(({ tr }) => {
      // First, deactivate all list items
      tr.doc.descendants((node, pos) => {
        if (node.type.name === 'listItem') {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            active: false
          })
        }
      })

      // Then activate only the clicked item
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        active: true
      })
      return true
    })
  }

  // Handle tag click with refresh
  const handleTagClick = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    // Refresh available tags before showing menu
    refreshAvailableTags()
    
    if (tagButtonRef.current) {
      const rect = tagButtonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      })
    }
    
    setShowTagMenu(prev => !prev)
  }

  const handleTagSelect = (selectedTag: string) => {
    event?.preventDefault()
    const pos = getPos()
    editor.commands.command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        tag: selectedTag
      })
      return true
    })
    setShowTagMenu(false)
  }

  const handleClickOutside = (event: MouseEvent) => {
    if (
      tagButtonRef.current && 
      !tagButtonRef.current.contains(event.target as Node) &&
      !document.querySelector('.tag-menu')?.contains(event.target as Node)
    ) {
      setShowTagMenu(false)
    }
  }

  useEffect(() => {
    if (showTagMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTagMenu])

  const handleDragStart = (event: React.DragEvent) => {
    event.stopPropagation()
    const pos = getPos()
    
    // Store the tag, node ID, and completed state
    draggedTagRef.current = tag || null
    editor.storage.listItem = {
      ...editor.storage.listItem,
      draggedTag: tag || null,
      draggedNodeId: node.attrs.nodeId,
      draggedCompleted: completed,  // Store completed state
      sourcePos: pos
    }
    
    editor.commands.setListItemActive(pos)
    editor.commands.command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        dragging: true,
        active: true,
        completed: completed  // Preserve completed state
      })
      return true
    })
    
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', '')
    event.dataTransfer.setData('application/tag', tag || '')
    event.dataTransfer.setData('application/node-id', node.attrs.nodeId || '')
    event.dataTransfer.setData('application/completed', String(completed))  // Store completed state
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2
    
    // Clear previous drop targets
    document.querySelectorAll('.drop-target').forEach(el => {
      el.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom')
    })
    
    target.classList.add('drop-target')
    if (event.clientY < midpoint) {
      target.classList.add('drop-target-top')
    } else {
      target.classList.add('drop-target-bottom')
    }
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const target = event.currentTarget as HTMLElement
    target.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom')
  }

  const handleDragEnd = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const pos = getPos()
    editor.commands.command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        dragging: false,
        completed: completed  // Preserve completed state
      })
      return true
    })
    document.querySelectorAll('.drop-target').forEach(el => {
      el.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom')
    })
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    // Close the tag menu if it's open
    setShowTagMenu(false)
    
    // Create a synthetic drop event for ProseMirror
    const dropEvent = new DragEvent('drop', {
      clientX: event.clientX,
      clientY: event.clientY,
      bubbles: true,
      cancelable: true,
      dataTransfer: event.dataTransfer
    })
    editor.view.dom.dispatchEvent(dropEvent)
  }

  const handleCompletedChange = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    editor.commands.toggleCompleted()
  }

  useEffect(() => {
    const dragHandle = dragHandleRef.current
    if (!dragHandle) return

    const touchStartHandler = (e: TouchEvent) => {
      e.preventDefault()
      const pos = getPos()
      
      // Store the tag and node ID in both the ref and the extension storage
      draggedTagRef.current = tag || null
      editor.storage.listItem = {
        ...editor.storage.listItem,
        draggedTag: tag || null,
        draggedNodeId: node.attrs.nodeId,
        sourcePos: pos
      }
      
      // Log the touch start for debugging
      console.log('Touch start:', {
        node: {
          id: node.attrs.nodeId,
          tag: tag,
          position: pos
        },
        attrs: node.attrs // Log all attributes
      })
      
      editor.commands.setListItemActive(pos)
      editor.commands.command(({ tr }) => {
        // First, store the current state of all nodes
        const originalNodes = new Map()
        tr.doc.descendants((node, pos) => {
          if (node.type.name === 'listItem') {
            originalNodes.set(node.attrs.nodeId, {
              attrs: { ...node.attrs }
            })
          }
        })

        // Set dragging state for the current node
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          dragging: true,
          active: true
        })

        // Ensure other nodes maintain their original attributes
        tr.doc.descendants((node, pos) => {
          if (node.type.name === 'listItem' && node.attrs.nodeId !== node.attrs.nodeId) {
            const originalNode = originalNodes.get(node.attrs.nodeId)
            if (originalNode) {
              tr.setNodeMarkup(pos, undefined, originalNode.attrs)
            }
          }
        })
        return true
      })
    }

    const touchMoveHandler = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      
      if (target) {
        const listItem = target.closest('.list-item')
        if (listItem instanceof HTMLElement) {
          const rect = listItem.getBoundingClientRect()
          const midpoint = rect.top + rect.height / 2
          
          // Clear previous drop targets
          document.querySelectorAll('.drop-target').forEach(el => {
            el.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom')
          })
          
          listItem.classList.add('drop-target')
          if (touch.clientY < midpoint) {
            listItem.classList.add('drop-target-top')
          } else {
            listItem.classList.add('drop-target-bottom')
          }
        }
      }
    }

    const touchEndHandler = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.changedTouches[0]
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      const initialPos = getPos()
      
      if (target) {
        const listItem = target.closest('.list-item')
        if (listItem) {
          // Create a DataTransfer object with the tag information
          const dataTransfer = new DataTransfer()
          dataTransfer.setData('text/plain', '')
          dataTransfer.setData('application/tag', tag || '')
          dataTransfer.setData('application/node-id', node.attrs.nodeId || '')
          
          // Store the tag and node ID in the editor storage
          editor.storage.listItem = {
            ...editor.storage.listItem,
            draggedTag: tag || null,
            draggedNodeId: node.attrs.nodeId,
            sourcePos: initialPos
          }

          // Log state before creating drop event
          console.log('Touch end - before drop:', {
            node: {
              id: node.attrs.nodeId,
              tag: tag,
              position: initialPos
            },
            attrs: node.attrs // Log all attributes
          })

          // Create and dispatch the synthetic drop event
          const dropEvent = new DragEvent('drop', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true,
            cancelable: true,
            dataTransfer
          })

          editor.view.dom.dispatchEvent(dropEvent)
        }
      }
      
      // Clear drag state only if the node still exists
      try {
        const currentNode = editor.state.doc.nodeAt(initialPos)
        if (currentNode) {
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(initialPos, undefined, {
              ...node.attrs,
              dragging: false
            })
            return true
          })
        }
      } catch (error) {
        console.debug('Node position no longer exists after drag')
      }
      
      document.querySelectorAll('.drop-target').forEach(el => {
        el.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom')
      })
      
      // Clear stored tag references
      draggedTagRef.current = null
      editor.storage.listItem = {
        ...editor.storage.listItem,
        draggedTag: null,
        draggedNodeId: null,
        sourcePos: null
      }
    }

    dragHandle.addEventListener('touchstart', touchStartHandler, { passive: false })
    dragHandle.addEventListener('touchmove', touchMoveHandler, { passive: false })
    dragHandle.addEventListener('touchend', touchEndHandler, { passive: false })

    return () => {
      dragHandle.removeEventListener('touchstart', touchStartHandler)
      dragHandle.removeEventListener('touchmove', touchMoveHandler)
      dragHandle.removeEventListener('touchend', touchEndHandler)
    }
  }, [editor.commands, editor.view.dom, getPos, node.attrs, tag])

  // Add a useEffect to update tag menu position when the list item moves
  useEffect(() => {
    if (showTagMenu && tagButtonRef.current) {
      const rect = tagButtonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      })
    }
  }, [showTagMenu, getPos])

  // Modify the refresh effect to only handle tag availability
  useEffect(() => {
    if (!dragging) {
      refreshAvailableTags()
    }
  }, [dragging, refreshAvailableTags])

  return (
    <>
      <NodeViewWrapper 
        as="li" 
        ref={ref}
        className={cn(
          'list-item',
          selected && 'is-selected',
          active && 'is-active',
          dragging && 'is-dragging',
          completed && 'border-green-500 border-2',
          'relative'
        )}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-category={category}
        data-completed={completed}
        data-node-id={node.attrs.nodeId}
      >
        <div 
          ref={dragHandleRef}
          className="drag-handle" 
          contentEditable={false}
          data-drag-handle
          draggable="true"
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          ⋮⋮
        </div>

        <div className="flex items-start gap-2 flex-1 pt-1">
          {isParentItem && (
            <div
              className={cn(
                'checkbox-wrapper',
                'flex items-center justify-center w-6 h-6 rounded border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer',
                completed && 'bg-primary border-primary text-primary-foreground'
              )}
              contentEditable={false}
              onClick={handleCompletedChange}
              data-completed={completed}
            >
              {completed && <Check className="h-4 w-4 stroke-[3]" />}
            </div>
          )}

          <div 
            ref={tagButtonRef}
            className={cn(
              'tag-button',
              tag ? 'has-tag' : 'no-tag'
            )}
            contentEditable={false} 
            onClick={handleTagClick}
            data-tag={tag || ''}
          >
            {tag ? (
              <span key={`tag-${node.attrs.nodeId}-${tag}`}>{tag}</span>
            ) : (
              <Tag className="h-4 w-4" />
            )}
          </div>

          <NodeViewContent className="list-item-content" />
        </div>
      </NodeViewWrapper>

      {showTagMenu && createPortal(
        <div 
          className="tag-bubble-menu"
          style={{
            position: 'absolute',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            zIndex: 50,
          }}
        >
          <div className="tag-menu">
            {availableTags.map((availableTag: string) => (
              <button
                key={availableTag}
                className={cn(
                  "tag-menu-item",
                  tag === availableTag && "active"
                )}
                onClick={() => handleTagSelect(availableTag)}
                type="button"
              >
                {availableTag}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
} 