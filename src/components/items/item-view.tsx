'use client';

import type { EnhancedList, ListItem } from "@/types/list";
import { Lock, EyeOff, ExternalLink } from "lucide-react";
import { CategoryBadge } from "@/components/lists/category-badge";
import { toast } from "sonner";
import { ItemDetailsOverlay } from "@/components/items/item-details-overlay";
import { useState } from "react";

// Function to detect URLs in text
function detectUrls(text: string): Array<{ url: string; index: number }> {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  const urls: Array<{ url: string; index: number }> = [];
  let match;
  
  while ((match = urlRegex.exec(text)) !== null) {
    urls.push({ url: match[0], index: match.index });
  }
  
  return urls;
}

// Function to render text with clickable URLs
function TextWithUrls({ text }: { text: string }) {
  const urls = detectUrls(text);
  if (urls.length === 0) return <>{text}</>;

  let lastIndex = 0;
  const elements: JSX.Element[] = [];

  urls.forEach(({ url, index }, i) => {
    // Add text before the URL
    if (index > lastIndex) {
      elements.push(<span key={`text-${i}`}>{text.slice(lastIndex, index)}</span>);
    }
    
    // Add the URL as a link
    elements.push(
      <a
        key={`link-${i}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline inline-flex items-center gap-1"
      >
        {url}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
    
    lastIndex = index + url.length;
  });

  // Add any remaining text after the last URL
  if (lastIndex < text.length) {
    elements.push(<span key="text-end">{text.slice(lastIndex)}</span>);
  }

  return <>{elements}</>;
}

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
      // Find the index of the current item in the list's items array
      const itemIndex = (list.items || []).findIndex(i => i.id === item.id);
      if (itemIndex === -1) {
        throw new Error('Item not found');
      }

      const response = await fetch(`/api/lists/${list.id}/items`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          index: itemIndex,
          ...details
        }),
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
              {list.privacy === 'unlisted' && (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {list.description && (
            <p className="text-muted-foreground text-sm">{list.description}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Item #{(list.items || []).findIndex(i => i.id === item.id) + 1}</h2>
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
            <div className="font-medium">
              <TextWithUrls text={item.title} />
            </div>
            {item.comment && (
              <div className="mt-1 text-sm text-muted-foreground">
                <TextWithUrls text={item.comment} />
              </div>
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
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {prop.value}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span>
                        <TextWithUrls text={prop.value} />
                      </span>
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