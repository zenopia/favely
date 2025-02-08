import React, { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from '@tiptap/react'
import { SubListItemAttributes } from './sub-list-item-extension'
import { BubbleMenu } from '@tiptap/react'
import categoryTags from '@/lib/tagMappings'

export default function SubListItemView({
  node,
  selected,
  extension,
  getPos,
  editor,
}: NodeViewProps) {
  const { active, dragging, tag, depth = 0, category } = node.attrs as SubListItemAttributes
  const ref = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const tagButtonRef = useRef<HTMLDivElement>(null)
  const [showTagMenu, setShowTagMenu] = useState(false)

  const handleClick = (_event: React.MouseEvent) => {
    const pos = getPos()
    editor.commands.setListItemActive(pos)
  }

  const handleTagClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    setShowTagMenu(true)
  }

  const handleTagSelect = (selectedTag: string) => {
    const pos = getPos()
    editor.commands.setSubListItemTag(selectedTag)
    setShowTagMenu(false)
  }

  const availableTags = category && category in categoryTags ? categoryTags[category as keyof typeof categoryTags] : []

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
    
    const dropEvent = new DragEvent('drop', {
      clientX: event.clientX,
      clientY: event.clientY,
      bubbles: true,
      cancelable: true,
      dataTransfer: event.dataTransfer
    })
    editor.view.dom.dispatchEvent(dropEvent)
  }

  return (
    <>
      {showTagMenu && (
        <BubbleMenu
          editor={editor}
          pluginKey="tagBubbleMenu"
          shouldShow={() => showTagMenu}
          tippyOptions={{
            placement: 'bottom-start',
            getReferenceClientRect: () => tagButtonRef.current?.getBoundingClientRect() || new DOMRect(),
            onClickOutside: () => setShowTagMenu(false),
          }}
        >
          <div className="tag-bubble-menu">
            <div className="tag-menu">
              {availableTags.map((availableTag: string) => (
                <button
                  key={availableTag}
                  className="tag-menu-item"
                  onClick={() => handleTagSelect(availableTag)}
                  type="button"
                >
                  {availableTag}
                </button>
              ))}
            </div>
          </div>
        </BubbleMenu>
      )}
      
      <NodeViewWrapper 
        as="li" 
        ref={ref}
        className={`sub-list-item depth-${depth} ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${dragging ? 'is-dragging' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
          className={tag ? 'tag-label' : 'add-tag-button'} 
          contentEditable={false} 
          onClick={handleTagClick}
          style={{ pointerEvents: 'all' }}
        >
          {tag || '+ Add Tag'}
        </div>

        <NodeViewContent className="sub-list-item-content" />
      </NodeViewWrapper>
    </>
  )
} 