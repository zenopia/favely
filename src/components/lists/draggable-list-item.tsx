"use client";

import { useState } from "react";
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { GripVertical, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DraggableListItemProps {
  item: {
    id: string;
    title: string;
    comment?: string;
    properties?: Array<{
      id: string;
      type?: 'text' | 'link';
      tag?: string;
      value: string;
    }>;
  };
  index: number;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onUpdate: (updates: Partial<{
    title: string;
    comment?: string;
    properties?: Array<{
      id: string;
      type?: 'text' | 'link';
      tag?: string;
      value: string;
    }>;
  }>) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function DraggableListItem({
  item,
  index,
  dragHandleProps,
  onUpdate,
  onRemove,
  disabled
}: DraggableListItemProps) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      className={`
        relative flex items-stretch rounded-lg border bg-card
        ${isDragging ? 'ring-2 ring-primary' : ''}
      `}
    >
      <div 
        className="flex items-center justify-center min-w-[3rem] bg-muted rounded-l-lg"
      >
        <span className="text-base font-medium">
          {index + 1}
        </span>
      </div>

      <div className="flex-1 p-3">
        <Input
          className="h-10 transition-colors focus:bg-accent"
          placeholder="Item title"
          value={item.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          disabled={disabled}
        />
      </div>

      <div
        {...dragHandleProps}
        className="flex items-center px-3 cursor-grab active:cursor-grabbing"
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <button
        type="button"
        className={cn(
          "flex items-center justify-center min-w-[3rem] rounded-r-lg transition-colors",
          "hover:bg-destructive hover:text-destructive-foreground",
          "focus-visible:outline-none focus-visible:bg-destructive focus-visible:text-destructive-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={disabled}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Remove item</span>
      </button>
    </div>
  );
} 