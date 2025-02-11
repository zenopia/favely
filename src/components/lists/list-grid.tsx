"use client";

import { useState } from "react";
import { ListSearchControls } from "@/components/lists/list-search-controls";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, ListChecks, Eye, Pin, PenLine, EyeOff } from "lucide-react";
import { CategoryBadge } from "@/components/lists/category-badge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnhancedList, ListCategory } from "@/types/list";
import { LIST_CATEGORIES } from "@/types/list";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";

interface ListGridProps {
  lists: EnhancedList[];
  showPrivacyBadge?: boolean;
  _isFollowing?: boolean;
  lastViewedMap?: Record<string, Date>;
  searchParams?: {
    q?: string;
    category?: string;
    sort?: string;
  };
  showSearch?: boolean;
}

// Add this CSS keyframe animation at the top of the file
const pulseAnimation = `
  @keyframes pulse {
    0% {
      transform: scale(0.95);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.8;
    }
    100% {
      transform: scale(0.95);
      opacity: 0.5;
    }
  }
`;

export function ListGrid({ 
  lists, 
  showPrivacyBadge = true, 
  _isFollowing, 
  lastViewedMap: initialViewedMap = {},
  searchParams,
  showSearch = false
}: ListGridProps) {
  const currentPath = usePathname();
  const [viewedMap, setViewedMap] = useState<Record<string, Date>>(initialViewedMap);

  const category = searchParams?.category && LIST_CATEGORIES.includes(searchParams.category as ListCategory) 
    ? searchParams.category as ListCategory 
    : undefined;

  const handleListClick = (listId: string) => {
    setViewedMap(prev => ({
      ...prev,
      [listId]: new Date()
    }));
  };

  return (
    <>
      {lists.length > 0 && <style>{pulseAnimation}</style>}
      <div className="space-y-8">
        <ListSearchControls 
          defaultCategory={category}
          defaultSort={searchParams?.sort}
          showSearch={showSearch}
        />

        {lists.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No lists found
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <Link 
                key={list.id} 
                href={`/lists/${list.id}?from=${encodeURIComponent(currentPath)}`}
                onClick={() => handleListClick(list.id)}
              >
                <Card className="group relative overflow-hidden transition-colors hover:bg-accent">
                  <div className="p-4 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {viewedMap[list.id] && list.editedAt && new Date(list.editedAt) > new Date(viewedMap[list.id]) && (
                            <div className="flex-shrink-0">
                              <div 
                                className={cn(
                                  "bg-primary rounded-full w-2 h-2",
                                  "animate-[pulse_2s_ease-in-out_infinite]"
                                )}
                              />
                            </div>
                          )}
                          <h3 className="font-semibold leading-none tracking-tight line-clamp-1">
                            {list.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <CategoryBadge category={list.category} />
                          {showPrivacyBadge && list.privacy === 'private' && (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                          {showPrivacyBadge && list.privacy === 'unlisted' && (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {list.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {list.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{list.stats.viewCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Pin className="h-4 w-4" />
                          <span>{list.stats.pinCount}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <ListChecks className="h-4 w-4" />
                        <span>{list.items?.length || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage 
                            src={list.owner.imageUrl || undefined} 
                            alt={list.owner.displayName || list.owner.username} 
                          />
                          <AvatarFallback>
                            {(list.owner.displayName || list.owner.username || '?')[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-foreground font-medium">{list.owner.displayName || list.owner.username}</span>
                          <span className="text-muted-foreground">@{list.owner.username}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {differenceInMinutes(new Date(list.editedAt || ''), new Date(list.createdAt)) > 1 ? (
                          <>
                            <PenLine className="h-4 w-4" />
                            <span>{formatDistanceToNow(new Date(list.editedAt || list.createdAt))} ago</span>
                          </>
                        ) : (
                          <span>{formatDistanceToNow(new Date(list.createdAt))} ago</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
} 