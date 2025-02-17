'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'

interface TaskItem {
  id: string
  text: string
  checked: boolean
  children?: TaskItem[]
  tag?: string
  level: number
}

interface TaskListEditorProps {
  initialItems?: TaskItem[]
  onChange?: (items: TaskItem[]) => void
  className?: string
  category?: string
}

interface SortableItemProps {
  id: string
  item: TaskItem
  onTextChange: (id: string, text: string) => void
  onCheckChange: (id: string, checked: boolean) => void
  onKeyDown: (e: React.KeyboardEvent, id: string) => void
  onPaste: (e: React.ClipboardEvent, id: string) => void
  isActive: boolean
  onFocus: () => void
  onBlur: () => void
  setEditableRef: (id: string) => (el: HTMLDivElement | null) => void
  category?: string
}

const getCategoryVar = (category?: string) => {
  if (!category) return 'other';
  switch (category) {
    case 'tv-shows': return 'tv';
    case 'things-to-do': return 'activities';
    default: return category;
  }
};

function SortableItem({
  id,
  item,
  onTextChange,
  onCheckChange,
  onKeyDown,
  onPaste,
  isActive,
  onFocus,
  onBlur,
  setEditableRef,
  category,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform && {
      ...transform,
      scaleX: isDragging ? 1.02 : 1,
      scaleY: isDragging ? 1.02 : 1,
    }),
    transition,
    marginLeft: `${item.level * 1.5}rem`,
    marginTop: '4px',
    backgroundColor: isDragging ? '#f3f1ff' : undefined,
    boxShadow: isDragging ? 'rgba(0, 0, 0, 0.2) 0px 5px 10px' : undefined,
    zIndex: isDragging ? 50 : undefined,
    borderLeft: `4px solid var(--category-${getCategoryVar(category)})`,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-2 p-2 rounded group relative min-h-[48px]",
        isActive && "bg-[#f3f1ff]",
        item.checked && "text-muted-foreground line-through",
        item.tag && `border-l-[var(--category-${item.tag?.replace(/\s+/g, '-')})]`
      )}
    >
      <input
        type="checkbox"
        checked={item.checked}
        onChange={e => onCheckChange(item.id, e.target.checked)}
        className="cursor-pointer shrink-0 mt-1.5"
      />
      
      <div 
        ref={setEditableRef(item.id)}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Type your task here..."
        onFocus={onFocus}
        onBlur={onBlur}
        onInput={e => onTextChange(item.id, e.currentTarget.textContent || '')}
        onKeyDown={e => onKeyDown(e, item.id)}
        onPaste={e => onPaste(e, item.id)}
        className={cn(
          "flex-1 outline-none min-h-[1.5em] px-1 whitespace-pre-wrap break-words",
          "before:text-muted-foreground before:pointer-events-none",
          !item.text && 'empty:before:content-[attr(data-placeholder)]'
        )}
      />

      <div
        {...attributes}
        {...listeners}
        className={cn(
          "opacity-0 group-hover:opacity-100 cursor-move px-2 shrink-0",
          "hover:text-blue-500 transition-opacity duration-200",
          "touch-none select-none",
          isDragging && "opacity-100"
        )}
      >
        ⋮⋮
      </div>
    </li>
  );
}

export function TaskListEditor({
  initialItems = [],
  onChange,
  className,
  category,
}: TaskListEditorProps) {
  const [items, setItems] = useState<TaskItem[]>(() => 
    initialItems.length > 0 
      ? initialItems 
      : [{ id: '1', text: '', checked: false, level: 0 }]
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const editableRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
      activationTrigger: {
        delay: 0,
        pressure: 0,
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update items and notify parent
  const updateItems = (newItems: TaskItem[]) => {
    setItems(newItems)
    onChange?.(newItems)
  }

  // Handle text changes
  const handleTextChange = (id: string, text: string) => {
    const newItems = items.map(item =>
      item.id === id ? { ...item, text } : item
    )
    updateItems(newItems)
  }

  // Handle checkbox changes
  const handleCheckChange = (id: string, checked: boolean) => {
    const newItems = items.map(item =>
      item.id === id ? { ...item, checked } : item
    )
    updateItems(newItems)
  }

  // Handle indentation
  const handleIndent = (id: string) => {
    const index = items.findIndex(item => item.id === id)
    if (index <= 0) return // Can't indent first item

    const prevItem = items[index - 1]
    const currentItem = items[index]

    // Can only indent one level deeper than previous item
    if (currentItem.level <= prevItem.level) {
      const newItems = items.map(item =>
        item.id === id ? { ...item, level: item.level + 1 } : item
      )
      updateItems(newItems)
    }
  }

  const handleOutdent = (id: string) => {
    const newItems = items.map(item =>
      item.id === id && item.level > 0 ? { ...item, level: item.level - 1 } : item
    )
    updateItems(newItems)
  }

  // Create a new task and focus it
  const createNewTask = (afterId: string, text: string = '') => {
    const index = items.findIndex(item => item.id === afterId)
    const currentItem = items[index]
    const newItem = { 
      id: Date.now().toString(), 
      text, 
      checked: false,
      level: currentItem.level
    }
    const newItems = [
      ...items.slice(0, index + 1),
      newItem,
      ...items.slice(index + 1)
    ]
    updateItems(newItems)
    setActiveId(newItem.id)
    
    // Focus the new item after render
    requestAnimationFrame(() => {
      const element = editableRefs.current.get(newItem.id)
      if (element) {
        focusElementAtEnd(element)
      }
    })
  }

  // Handle paste events
  const handlePaste = (e: React.ClipboardEvent, id: string) => {
    e.preventDefault()
    
    // Get the plain text content
    const text = e.clipboardData.getData('text/plain')
    if (!text) return

    // Split into lines and filter out empty lines
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) return

    // If it's just one line, treat it as normal text input
    if (lines.length === 1) {
      handleTextChange(id, lines[0])
      return
    }

    // For multiple lines, create new items
    const index = items.findIndex(item => item.id === id)
    const currentItem = items[index]
    
    // Create new items from the lines
    const newItems = lines.map((line, i) => ({
      id: Date.now().toString() + i,
      text: line,
      checked: false,
      level: currentItem.level
    }))

    // Replace the current item with the new items
    const updatedItems = [
      ...items.slice(0, index),
      ...newItems,
      ...items.slice(index + 1)
    ]

    updateItems(updatedItems)
    
    // Focus the last created item
    setActiveId(newItems[newItems.length - 1].id)
  }

  // Helper function to focus an element and place caret at the end
  const focusElementAtEnd = useCallback((element: HTMLDivElement) => {
    element.focus()
    const range = document.createRange()
    const selection = window.getSelection()
    range.selectNodeContents(element)
    range.collapse(false) // false means collapse to end
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    const currentIndex = items.findIndex(item => item.id === id)
    
    if (e.key === 'Enter') {
      e.preventDefault()
      createNewTask(id)
    } else if (e.key === 'Backspace' && items.length > 1) {
      const item = items.find(item => item.id === id)
      if (item?.text === '') {
        e.preventDefault()
        if (item.level > 0) {
          // First outdent
          handleOutdent(id)
        } else {
          // Then delete if at level 0
          const newItems = items.filter(item => item.id !== id)
          updateItems(newItems)
          // Focus previous item
          if (currentIndex > 0) {
            const prevId = items[currentIndex - 1].id
            setActiveId(prevId)
            requestAnimationFrame(() => {
              const element = editableRefs.current.get(prevId)
              if (element) {
                focusElementAtEnd(element)
              }
            })
          }
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        handleOutdent(id)
      } else {
        handleIndent(id)
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const targetIndex = e.key === 'ArrowUp' 
        ? Math.max(0, currentIndex - 1)
        : Math.min(items.length - 1, currentIndex + 1)
      
      const targetId = items[targetIndex].id
      setActiveId(targetId)
      requestAnimationFrame(() => {
        const element = editableRefs.current.get(targetId)
        if (element) {
          focusElementAtEnd(element)
        }
      })
    }
  }

  const setEditableRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      editableRefs.current.set(id, el)
    } else {
      editableRefs.current.delete(id)
    }
  }, []);

  // Update the text content of editable divs when items change
  useEffect(() => {
    items.forEach(item => {
      const element = editableRefs.current.get(item.id)
      if (element && element.textContent !== item.text) {
        element.textContent = item.text
      }
    })
  }, [items])

  const handleDragStart = () => {
    setActiveId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      
      updateItems(arrayMove(items, oldIndex, newIndex));
    }

    // Set the dropped item as active and focus its text
    const activeId = active.id.toString();
    setActiveId(activeId);
    
    // Focus the dropped item's text after a short delay to ensure all drag operations are complete
    setTimeout(() => {
      const element = editableRefs.current.get(activeId);
      if (element) {
        focusElementAtEnd(element);
      }
    }, 50);
  };

  return (
    <div className={cn("border rounded-lg p-2", className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={items.map(item => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className={cn("list-none p-0 m-0 relative")}>
            {items.map((item) => (
              <SortableItem
                key={item.id}
                id={item.id}
                item={item}
                onTextChange={handleTextChange}
                onCheckChange={handleCheckChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                isActive={activeId === item.id}
                onFocus={() => {
                  setActiveId(item.id)
                  const element = editableRefs.current.get(item.id)
                  if (element) {
                    focusElementAtEnd(element)
                  }
                }}
                onBlur={() => setActiveId(null)}
                setEditableRef={setEditableRef}
                category={category}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <style jsx global>
        {`
          [contenteditable] {
            -webkit-user-modify: read-write;
            overflow-wrap: break-word;
            -webkit-line-break: after-white-space;
            -webkit-user-select: text;
            white-space: pre-wrap;
            cursor: text;
          }

          [contenteditable]:empty:before {
            content: attr(data-placeholder);
            color: rgb(161 161 170);
            pointer-events: none;
          }
        `}
      </style>
    </div>
  );
} 