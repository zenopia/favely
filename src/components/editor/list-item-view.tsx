import { useEffect, useRef, useState, useMemo } from 'react'
import { NodeViewWrapper, NodeViewContent, Editor, Extension, NodeViewProps } from '@tiptap/react'
import { createPortal } from 'react-dom'
import { ListItemAttributes } from './list-item-extension'
import categoryTags from '@/lib/tagMappings'
import { Tag } from 'lucide-react'
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
  const { active, dragging, tag, category } = node.attrs as ListItemAttributes
  const ref = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const tagButtonRef = useRef<HTMLDivElement>(null)
  const [showTagMenu, setShowTagMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const categoryRef = useRef(category)

  // Get all used tags in the current child list
  const getUsedTags = () => {
    const usedTags = new Set<string>()
    const pos = getPos()
    
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

    return usedTags
  }

  // Memoize available tags to prevent unnecessary recalculations
  const availableTags = useMemo(() => {
    if (!category || category === categoryRef.current) {
      categoryRef.current = category
      const allTags = categoryRef.current && categoryRef.current in categoryTags 
        ? categoryTags[categoryRef.current as keyof typeof categoryTags] 
        : []
      
      // For parent list items, return empty array (no tags allowed)
      const pos = getPos()
      const depth = editor.state.doc.resolve(pos).depth
      if (depth <= 1) {
        return []
      }

      // For child list items, filter out used tags
      const usedTags = getUsedTags()
      return allTags.filter(tag => !usedTags.has(tag) || node.attrs.tag === tag)
    }
    
    categoryRef.current = category
    const allTags = category in categoryTags ? categoryTags[category as keyof typeof categoryTags] : []
    
    // For parent list items, return empty array
    const pos = getPos()
    const depth = editor.state.doc.resolve(pos).depth
    if (depth <= 1) {
      return []
    }

    // For child list items, filter out used tags
    const usedTags = getUsedTags()
    return allTags.filter(tag => !usedTags.has(tag) || node.attrs.tag === tag)
  }, [category, editor.state.doc, getPos, node.attrs.tag])

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    const pos = getPos()
    
    // First, deactivate all list items
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'listItem') {
        editor.commands.command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            active: false
          })
          return true
        })
      }
    })

    // Then activate only the clicked item
    editor.commands.command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        active: true
      })
      return true
    })
  }

  const handleTagClick = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
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

  console.log('Category:', category);
  console.log('Available Tags:', availableTags);

  const handleDragStart = (event: React.DragEvent) => {
    event.stopPropagation()
    const pos = getPos()
    editor.commands.setListItemActive(pos)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', '')
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
    document.querySelectorAll('.drop-target').forEach(el => {
      el.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom')
    })
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
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

  useEffect(() => {
    const dragHandle = dragHandleRef.current
    if (!dragHandle) return

    const touchStartHandler = (e: TouchEvent) => {
      e.preventDefault()
      const pos = getPos()
      editor.commands.setListItemActive(pos)
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
      
      if (target) {
        const listItem = target.closest('.list-item')
        if (listItem) {
          const dropEvent = new DragEvent('drop', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
          })
          editor.view.dom.dispatchEvent(dropEvent)
        }
      }
      
      document.querySelectorAll('.drop-target').forEach(el => {
        el.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom')
      })
    }

    dragHandle.addEventListener('touchstart', touchStartHandler, { passive: false })
    dragHandle.addEventListener('touchmove', touchMoveHandler, { passive: false })
    dragHandle.addEventListener('touchend', touchEndHandler, { passive: false })

    return () => {
      dragHandle.removeEventListener('touchstart', touchStartHandler)
      dragHandle.removeEventListener('touchmove', touchMoveHandler)
      dragHandle.removeEventListener('touchend', touchEndHandler)
    }
  }, [editor.commands, editor.view.dom, getPos])

  return (
    <>
      <NodeViewWrapper 
        as="li" 
        ref={ref}
        className={`list-item ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${dragging ? 'is-dragging' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-category={category}
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

        <div 
          ref={tagButtonRef}
          className={cn(
            'tag-button',
            tag ? 'has-tag' : 'no-tag'
          )}
          contentEditable={false} 
          onClick={handleTagClick}
        >
          {tag ? tag : <Tag className="h-4 w-4" />}
        </div>

        <NodeViewContent className="list-item-content" />
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