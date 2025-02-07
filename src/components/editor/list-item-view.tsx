import React, { useEffect, useRef } from 'react'
import { NodeViewWrapper, NodeViewContent, Editor, Extension } from '@tiptap/react'
import { ListItemAttributes } from './list-item-extension'

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
  const { active, dragging } = node.attrs
  const ref = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)

  const handleClick = (_event: React.MouseEvent) => {
    const pos = getPos()
    editor.commands.setListItemActive(pos)
  }

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
    <NodeViewWrapper 
      as="li" 
      ref={ref}
      className={`list-item ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${dragging ? 'is-dragging' : ''}`}
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
      <NodeViewContent className="list-item-content" />
    </NodeViewWrapper>
  )
} 