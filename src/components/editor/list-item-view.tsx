import React, { useEffect, useRef } from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { ListItemAttributes } from './list-item-extension'
import { Node } from 'prosemirror-model'
import { Transaction } from 'prosemirror-state'

interface ListItemViewProps {
  node: {
    attrs: ListItemAttributes
  }
  selected: boolean
  extension: any
  getPos: () => number
  editor: any
}

export default function ListItemView({
  node,
  selected,
  extension,
  getPos,
  editor,
}: ListItemViewProps) {
  const { active, dragging } = node.attrs
  const dragHandleRef = useRef<HTMLDivElement>(null)

  const handleClick = (event: React.MouseEvent) => {
    const pos = getPos()
    editor.commands.setListItemActive(pos)
  }

  const handleDragStart = (event: React.DragEvent | React.TouchEvent) => {
    const pos = getPos()
    editor.commands.setListItemActive(pos)
    editor.commands.updateAttributes('listItem', { dragging: true })
    
    // Find a valid text position within the list item for selection
    const resolvedPos = editor.state.doc.resolve(pos)
    const nodeAfter = resolvedPos.nodeAfter
    if (nodeAfter) {
      const contentPos = pos + 1 // Move inside the list item
      const contentNode = editor.state.doc.nodeAt(contentPos)
      
      if (contentNode && contentNode.type.name === 'paragraph') {
        // Select the paragraph content
        const from = contentPos + 1 // Move inside the paragraph
        const to = contentPos + contentNode.nodeSize - 1
        editor.commands.setTextSelection({ from, to })
      }
    }

    // For touch events, set the drag data
    if ('dataTransfer' in event) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', '') // Required for Firefox
    }
  }

  const handleDragEnd = () => {
    // Clear dragging state for all list items
    editor.state.doc.descendants((node: Node, pos: number) => {
      if (node.type.name === 'listItem') {
        editor.commands.command(({ tr }: { tr: Transaction }) => {
          const attrs = node.attrs as ListItemAttributes
          tr.setNodeMarkup(pos, undefined, { ...attrs, dragging: false })
          return true
        })
      }
    })
  }

  const handleTouchStart = (event: React.TouchEvent) => {
    event.preventDefault() // Prevent scrolling while trying to drag
    handleDragStart(event)
  }

  const handleTouchMove = (event: React.TouchEvent) => {
    event.preventDefault()
    const touch = event.touches[0]
    const target = document.elementFromPoint(touch.clientX, touch.clientY)
    
    // Simulate drag over behavior
    if (target) {
      const listItem = target.closest('.list-item')
      if (listItem) {
        const rect = listItem.getBoundingClientRect()
        const relativeY = touch.clientY - rect.top
        
        // Clear existing drop targets
        document.querySelectorAll('.drop-target').forEach(el => {
          el.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom', 'drop-target-active')
        })
        
        // Add drop target indicator
        listItem.classList.add('drop-target', 'drop-target-active')
        if (relativeY < rect.height / 2) {
          listItem.classList.add('drop-target-top')
        } else {
          listItem.classList.add('drop-target-bottom')
        }
      }
    }
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    event.preventDefault()
    const touch = event.changedTouches[0]
    const target = document.elementFromPoint(touch.clientX, touch.clientY)
    
    // Clear all drop targets
    document.querySelectorAll('.drop-target').forEach(el => {
      el.classList.remove('drop-target', 'drop-target-top', 'drop-target-bottom', 'drop-target-active')
    })
    
    if (target) {
      const listItem = target.closest('.list-item')
      if (listItem) {
        // Create a proper drop event with all necessary properties
        const dropEvent = new DragEvent('drop', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer()
        })
        // Dispatch to both the list item and the editor view
        listItem.dispatchEvent(dropEvent)
        editor.view.dom.dispatchEvent(dropEvent)
      }
    }
    
    handleDragEnd()
  }

  useEffect(() => {
    const dragHandle = dragHandleRef.current
    if (!dragHandle) return

    const touchStartHandler = (e: TouchEvent) => {
      e.preventDefault()
      handleDragStart(e as unknown as React.TouchEvent)
    }

    const touchMoveHandler = (e: TouchEvent) => {
      e.preventDefault()
      handleTouchMove(e as unknown as React.TouchEvent)
    }

    const touchEndHandler = (e: TouchEvent) => {
      e.preventDefault()
      handleTouchEnd(e as unknown as React.TouchEvent)
    }

    dragHandle.addEventListener('touchstart', touchStartHandler, { passive: false })
    dragHandle.addEventListener('touchmove', touchMoveHandler, { passive: false })
    dragHandle.addEventListener('touchend', touchEndHandler, { passive: false })

    return () => {
      dragHandle.removeEventListener('touchstart', touchStartHandler)
      dragHandle.removeEventListener('touchmove', touchMoveHandler)
      dragHandle.removeEventListener('touchend', touchEndHandler)
    }
  }, [])

  return (
    <NodeViewWrapper 
      as="li" 
      className={`list-item ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${dragging ? 'is-dragging' : ''}`}
      onClick={handleClick}
    >
      <div 
        ref={dragHandleRef}
        className="drag-handle" 
        contentEditable={false}
        data-drag-handle
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        ⋮⋮
      </div>
      <NodeViewContent className="list-item-content" />
    </NodeViewWrapper>
  )
} 