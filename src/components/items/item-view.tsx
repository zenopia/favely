'use client';

import type { EnhancedList, ListItem } from "@/types/list";
import { Lock } from "lucide-react";
import { CategoryBadge } from "@/components/lists/category-badge";
import { toast } from "sonner";
import { ItemDetailsOverlay } from "@/components/items/item-details-overlay";
import { useState } from "react";

interface ItemViewProps {
  list: EnhancedList;
  item: ListItem;
  isOwner: boolean;
}

export function ItemView({ 
  list,
  item,
  isOwner
}: ItemViewProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleDetailsUpdate = async (details: { title: string; comment?: string; properties?: Array<{ type?: 'text' | 'link'; tag?: string; value: string; }> }) => {
    try {
      const response = await fetch(`/api/${list.owner.username}/lists/${list.id}/items/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(details),
      });

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      toast.success('Item updated successfully');
      window.location.reload();
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-0">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold sm:text-3xl">
              {list.title}
            </h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <CategoryBadge 
                category={list.category}
                className="pointer-events-none"
              />
              {list.privacy === 'private' && (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {list.description && (
            <p className="text-muted-foreground text-sm">{list.description}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Item #{item.id}</h2>
            {isOwner && (
              <button
                onClick={() => setShowDetails(true)}
                className="text-sm text-primary hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="font-medium">{item.title}</div>
            {item.comment && (
              <div className="mt-1 text-sm text-muted-foreground">{item.comment}</div>
            )}
            {Array.isArray(item.properties) && item.properties.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {item.properties.map(prop => (
                  <li key={prop.id} className="text-sm text-muted-foreground">
                    {prop.type === 'link' ? (
                      <a
                        href={prop.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {prop.value}
                      </a>
                    ) : (
                      <span>{prop.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {showDetails && (
        <ItemDetailsOverlay
          isOpen={showDetails}
          onClose={() => setShowDetails(false)}
          onSave={handleDetailsUpdate}
          initialDetails={{
            title: item.title,
            comment: item.comment,
            properties: item.properties || []
          }}
        />
      )}
    </div>
  );
} 