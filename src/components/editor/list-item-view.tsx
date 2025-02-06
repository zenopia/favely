import React from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { ListItemAttributes } from './list-item-extension'

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

  const handleClick = (event: React.MouseEvent) => {
    const pos = getPos()
    editor.commands.setListItemActive(pos)
  }

  const handleDragStart = (event: React.DragEvent | React.TouchEvent) => {
    const pos = getPos()
    editor.commands.setListItemActive(pos)
    editor.commands.updateAttributes('listItem', { dragging: true })
    
    // Select all content within the list item
    const resolvedPos = editor.state.doc.resolve(pos)
    const end = resolvedPos.end()
    editor.commands.setTextSelection({ from: pos + 1, to: end })

    // For touch events, set the drag data
    if ('dataTransfer' in event) {
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  const handleDragEnd = () => {
    editor.commands.updateAttributes('listItem', { dragging: false })
  }

  return (
    <NodeViewWrapper 
      as="li" 
      className={`list-item ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${dragging ? 'is-dragging' : ''}`}
      onClick={handleClick}
    >
      <div 
        className="drag-handle" 
        contentEditable={false}
        data-drag-handle
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
      >
        ⋮⋮
      </div>
      <NodeViewContent className="list-item-content" />
    </NodeViewWrapper>
  )
} 