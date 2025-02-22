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
  DragStartEvent,
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
import { IndentIcon, OutdentIcon } from 'lucide-react'

interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
  level: number;
  tag?: string;
  childItems?: Array<{
    title: string;
    tag?: string;
  }>;
}

type SavedTaskItem = {
  id: string;
  title: string;
  checked: boolean;
  tag?: string;
  childItems?: Array<{
    title: string;
    tag?: string;
  }>;
};

interface TaskListEditorProps {
  initialItems?: SavedTaskItem[];
  onChange?: (items: SavedTaskItem[]) => void;
  className?: string;
  category?: string;
}

interface SortableItemProps {
  id: string
  item: TaskItem
  items: TaskItem[]
  parentIsDragging?: boolean
  onTextChange: (id: string, text: string) => void
  onCheckChange: (id: string, checked: boolean) => void
  onKeyDown: (e: React.KeyboardEvent, id: string) => void
  onPaste: (e: React.ClipboardEvent, id: string) => void
  onIndent: (id: string) => void
  onOutdent: (id: string) => void
  isActive: boolean
  onFocus: () => void
  onBlur: () => void
  setEditableRef: (id: string) => (el: HTMLDivElement | null) => void
  editableRefs: React.RefObject<Map<string, HTMLDivElement>>
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
  items,
  parentIsDragging,
  onTextChange,
  onCheckChange,
  onKeyDown,
  onPaste,
  onIndent,
  onOutdent,
  isActive,
  onFocus,
  onBlur,
  setEditableRef,
  editableRefs,
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

  // Add ref for the buttons container
  const buttonsRef = useRef<HTMLDivElement>(null);

  // Modified onBlur handler that checks if we're clicking the indent/outdent buttons
  const handleBlur = (e: React.FocusEvent) => {
    // Check if the click was inside the buttons container
    if (buttonsRef.current?.contains(e.relatedTarget as Node)) {
      return; // Don't trigger blur if clicking buttons
    }
    onBlur();
  };

  // Find child items if this is a parent item
  const isParent = item.level === 0;
  const childItems = isParent && isDragging ? items.filter((childItem: TaskItem, index: number) => {
    const parentIndex = items.findIndex((i: TaskItem) => i.id === id);
    return childItem.level > 0 && 
           index > parentIndex && 
           items.slice(parentIndex + 1, index).every((i: TaskItem) => i.level > 0);
  }) : [];

  // If this item is a child and its parent is being dragged, don't render it
  if (parentIsDragging) {
    return null;
  }

  // Find parent's checked status if this is a child item
  const parentChecked = item.level > 0 ? items.slice(0, items.findIndex(i => i.id === id))
    .reverse()
    .find(i => i.level === 0)?.checked : false;

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
    borderRadius: '0.375rem',
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        isDragging && "opacity-100"
      )}
    >
      <div className={cn(
        "flex items-start gap-2 p-2 rounded group relative min-h-[48px]",
        isActive && "bg-[#f3f1ff]",
        item.level > 0 && "bg-muted",
        (item.checked || (item.level > 0 && parentChecked)) && "text-muted-foreground",
        item.tag && `border-l-[var(--category-${item.tag?.replace(/\s+/g, '-')})]`
      )}>
        {item.level === 0 && (
          <input
            type="checkbox"
            checked={item.checked}
            onChange={e => onCheckChange(item.id, e.target.checked)}
            className="cursor-pointer shrink-0 mt-1.5"
          />
        )}
        
        <div 
          ref={setEditableRef(item.id)}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Type your task here..."
          onFocus={onFocus}
          onBlur={handleBlur}
          onInput={e => onTextChange(item.id, e.currentTarget.textContent || '')}
          onKeyDown={e => onKeyDown(e, item.id)}
          onPaste={e => onPaste(e, item.id)}
          className={cn(
            "flex-1 outline-none min-h-[1.5em] px-1 whitespace-pre-wrap break-words",
            "before:text-muted-foreground before:pointer-events-none",
            !item.text && 'empty:before:content-[attr(data-placeholder)]'
          )}
        />

        {/* Indent/Outdent buttons - only show when item is active */}
        {isActive && (
          <div ref={buttonsRef} className="flex items-center gap-1">
            {item.level > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onOutdent(id);
                  // Refocus the editable div after the operation
                  const element = editableRefs.current?.get(id);
                  if (element) {
                    element.focus();
                  }
                }}
                className="p-1 hover:bg-muted rounded-sm transition-colors"
                title="Outdent"
                tabIndex={-1} // Prevent button from receiving focus
              >
                <OutdentIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onIndent(id);
                  // Refocus the editable div after the operation
                  const element = editableRefs.current?.get(id);
                  if (element) {
                    element.focus();
                  }
                }}
                className="p-1 hover:bg-muted rounded-sm transition-colors"
                title="Indent"
                tabIndex={-1} // Prevent button from receiving focus
              >
                <IndentIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        )}

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
      </div>

      {/* Show child items when parent is being dragged */}
      {isDragging && childItems.length > 0 && (
        <div className="ml-6 space-y-1">
          {childItems.map(childItem => (
            <div
              key={childItem.id}
              className={cn(
                "flex items-start gap-2 p-2 rounded bg-muted min-h-[48px]",
                "opacity-90"
              )}
            >
              <div className="flex-1 px-1">
                {childItem.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

// Convert saved items to editor items
const convertSavedToEditorItems = (savedItems: SavedTaskItem[]): TaskItem[] => {
  const result: TaskItem[] = [];
  
  savedItems.forEach(item => {
    // Add parent item
    const parentItem = {
      id: item.id,
      text: item.title,
      checked: item.checked,
      level: 0,
      tag: item.tag
    };
    result.push(parentItem);
    
    // Add child items if any, maintaining their order
    if (item.childItems?.length) {
      let insertIndex = result.length;
      item.childItems.forEach(child => {
        const childItem = {
          id: Date.now().toString() + Math.random(),
          text: child.title,
          checked: false,
          level: 1,
          tag: child.tag
        };
        // Insert child item at the current insert index and increment it
        result.splice(insertIndex, 0, childItem);
        insertIndex++;
      });
    }
  });
  
  return result;
};

// Prepare items for save
const prepareItemsForSave = (items: TaskItem[]): SavedTaskItem[] => {
  const result: SavedTaskItem[] = [];
  
  // Process each parent item (level 0)
  items.forEach((item, index) => {
    if (item.level === 0 && item.text.trim()) {  // Only include items with text
      // Initialize the parent item, explicitly copying all fields
      const parentItem: SavedTaskItem = {
        id: item.id,
        title: item.text,
        checked: Boolean(item.checked), // Ensure boolean type
        tag: item.tag,
        childItems: []
      };

      // Find all child items that belong to this parent
      let childIndex = index + 1;
      while (childIndex < items.length && items[childIndex].level > 0) {
        const childItem = items[childIndex];
        if (childItem.text.trim()) {  // Only include child items with text
          parentItem.childItems?.push({
            title: childItem.text,
            tag: childItem.tag
          });
        }
        childIndex++;
      }

      result.push(parentItem);
    }
  });
  
  return result;
};

export function TaskListEditor({
  initialItems = [],
  onChange,
  className,
  category,
}: TaskListEditorProps) {
  const [items, setItems] = useState<TaskItem[]>(() => 
    initialItems.length > 0 
      ? convertSavedToEditorItems(initialItems)
      : [{ id: '1', text: '', checked: false, level: 0 }]
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const editableRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [draggingParentId, setDraggingParentId] = useState<string | null>(null);

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
    // Only pass the parent items to onChange, with children as childItems
    if (onChange) {
      const itemsForSave = prepareItemsForSave(newItems)
      onChange(itemsForSave)
    }
  }

  // Handle text changes
  const handleTextChange = (id: string, text: string) => {
    let newItems = items.map(item => {
      if (item.id === id) {
        return { ...item, text }
      }
      return item
    })

    // If this is a child item, also update the parent's childItems
    const currentItem = items.find(item => item.id === id)
    if (currentItem && currentItem.level > 0) {
      // Find parent item
      const parentIndex = items.findIndex((parentItem, idx) => 
        idx < items.findIndex(i => i.id === id) && 
        parentItem.level === (currentItem.level - 1)
      )
      
      if (parentIndex !== -1) {
        const parentItem = items[parentIndex]
        const parentChildItems = parentItem.childItems || []
        
        // Find the matching child item by comparing the old text
        const existingChildIndex = parentChildItems.findIndex(
          p => p.title === currentItem.text
        )
        
        // Create or update the child item
        const childItem = {
          title: text
        }
        
        // Update parent item in newItems array
        newItems = newItems.map((item, index) => {
          if (index === parentIndex) {
            const updatedChildItems = [...parentChildItems]
            if (existingChildIndex !== -1) {
              updatedChildItems[existingChildIndex] = childItem
            } else {
              updatedChildItems.push(childItem)
            }
            return {
              ...item,
              childItems: updatedChildItems
            }
          }
          return item
        })
      }
    }

    updateItems(newItems)
  }

  // Handle checkbox changes
  const handleCheckChange = (id: string, checked: boolean) => {
    const index = items.findIndex(item => item.id === id)
    const currentItem = items[index]

    // Only allow checking parent items (level 0)
    if (currentItem.level === 0) {
      const updatedItems = items.map(item =>
        item.id === id ? { ...item, checked } : item
      )
      updateItems(updatedItems)
    }
  }

  // Handle indentation
  const handleIndent = (id: string) => {
    const index = items.findIndex(item => item.id === id);
    if (index <= 0) return; // Can't indent first item

    const currentItem = items[index];
    
    // Find the previous parent item by going backwards until we find a level 0 item
    let prevParentIndex = index - 1;
    while (prevParentIndex >= 0 && items[prevParentIndex].level > 0) {
      prevParentIndex--;
    }

    // If we found a parent item
    if (prevParentIndex >= 0) {
      const updatedItems = [...items];
      const parentItem = updatedItems[prevParentIndex];
      
      // Update the current item's level to 1
      updatedItems[index] = {
        ...currentItem,
        level: 1
      };

      // Add the current item to the parent's childItems
      if (!parentItem.childItems) {
        parentItem.childItems = [];
      }
      
      parentItem.childItems.push({
        title: currentItem.text,
        tag: currentItem.tag
      });

      // Update the parent item
      updatedItems[prevParentIndex] = parentItem;
      
      updateItems(updatedItems);
    }
  };

  const handleOutdent = (id: string) => {
    const index = items.findIndex(item => item.id === id)
    const currentItem = items[index]

    if (currentItem.level > 0) {
      // Find the parent item (the item before this one with level - 1)
      const parentIndex = items.slice(0, index).reverse()
        .findIndex(item => item.level === currentItem.level - 1)
      
      if (parentIndex !== -1) {
        const actualParentIndex = index - 1 - parentIndex
        const parentItem = items[actualParentIndex]
        const updatedItems = [...items]

        // Update the current item's level
        updatedItems[index] = {
          ...currentItem,
          level: currentItem.level - 1
        }

        // Remove this item from parent's childItems
        const updatedParentChildItems = (parentItem.childItems || [])
          .filter(p => p.title !== currentItem.text)

        // Update the parent item
        updatedItems[actualParentIndex] = {
          ...parentItem,
          childItems: updatedParentChildItems
        }

        updateItems(updatedItems)
      }
    }
  }

  // Create a new task and focus it
  const createNewTask = (afterId: string, text: string = '') => {
    const index = items.findIndex(item => item.id === afterId)
    const currentItem = items[index]
    const newItem = { 
      id: Date.now().toString(), 
      text, 
      checked: false,
      level: currentItem.level,
      childItems: []
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

    // Find the current item and its level
    const index = items.findIndex(item => item.id === id)
    const currentItem = items[index]
    const baseLevel = currentItem.level

    // First, find the indentation of the first line to use as a baseline
    const firstLineMatch = lines[0].match(/^[\t ]*/)
    const baseIndentCount = firstLineMatch ? firstLineMatch[0].length : 0

    // Process lines to detect hierarchy relative to the first line
    const processedLines = lines.map(line => {
      // Count leading spaces/tabs to determine indentation level
      const match = line.match(/^[\t ]*/)
      const indentCount = match ? match[0].length : 0
      // Calculate relative indentation level compared to the first line
      const relativeLevel = Math.floor((indentCount - baseIndentCount) / 2)
      
      return {
        text: line.trim(),
        level: Math.max(0, baseLevel + relativeLevel) // Ensure level doesn't go below 0
      }
    })

    // Create new items from the processed lines
    const newItems = processedLines.map((line, i) => ({
      id: Date.now().toString() + i,
      text: line.text,
      checked: i === 0 ? currentItem.checked : false, // Preserve checked status for first item
      level: line.level,
      childItems: []
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(null);
    const draggedItem = items.find(item => item.id === event.active.id);
    if (draggedItem?.level === 0) {
      setDraggingParentId(draggedItem.id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const draggedItem = items.find(item => item.id === active.id);
    
    // Always reset dragging parent ID
    setDraggingParentId(null);

    if (over && draggedItem) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      
      if (oldIndex !== newIndex) {
        let newItems: TaskItem[] = [];
        
        if (draggedItem.level === 0) {
          // For parent items, move them along with their children
          const childItems: TaskItem[] = [];
          let childCount = 0;
          
          // Collect all consecutive child items after the parent
          for (let i = oldIndex + 1; i < items.length; i++) {
            if (items[i].level > 0) {
              childItems.push(items[i]);
              childCount++;
            } else {
              break;
            }
          }

          // First remove the parent and children
          const withoutMoved = [
            ...items.slice(0, oldIndex),
            ...items.slice(oldIndex + 1 + childCount)
          ];

          // Then insert them at the new position
          newItems = [
            ...withoutMoved.slice(0, newIndex),
            draggedItem,
            ...childItems,
            ...withoutMoved.slice(newIndex)
          ];
        } else {
          // For child items, ensure they stay under a parent
          const overItem = items[newIndex];
          const prevItem = newIndex > 0 ? items[newIndex - 1] : null;
          const nextItem = newIndex < items.length - 1 ? items[newIndex + 1] : null;

          // Only allow moving between items of the same level
          if (overItem.level === draggedItem.level) {
            newItems = arrayMove(items, oldIndex, newIndex);
          }
        }

        if (newItems.length > 0) {
          updateItems(newItems);
        }
      }
    }
    
    // Set the dropped item as active and focus its text
    const activeId = active.id.toString();
    setActiveId(activeId);
    
    // Ensure all text content is properly restored after the drop
    requestAnimationFrame(() => {
      // Focus the dropped item
      const element = editableRefs.current.get(activeId);
      if (element) {
        focusElementAtEnd(element);
      }

      // Restore text content for all items
      items.forEach(item => {
        const element = editableRefs.current.get(item.id);
        if (element && element.textContent !== item.text) {
          element.textContent = item.text;
        }
      });
    });
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
            {items.map((item) => {
              // Check if this item is a child of the currently dragging parent
              const isChildOfDraggingParent = Boolean(
                draggingParentId && 
                item.level > 0 && 
                items.slice(0, items.findIndex(i => i.id === item.id))
                     .reverse()
                     .find(i => i.level === 0)?.id === draggingParentId
              );

              return (
                <SortableItem
                  key={item.id}
                  id={item.id}
                  item={item}
                  items={items}
                  parentIsDragging={isChildOfDraggingParent}
                  onTextChange={handleTextChange}
                  onCheckChange={handleCheckChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onIndent={handleIndent}
                  onOutdent={handleOutdent}
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
                  editableRefs={editableRefs}
                  category={category}
                />
              );
            })}
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