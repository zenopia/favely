"use client";

import { useState, useEffect } from "react";
import { EnhancedList, ListItem } from "@/types/list";
import { CategoryBadge } from "@/components/lists/category-badge";
import ListActionBar from "@/components/lists/list-action-bar";
import { Eye, Pin, Copy, Lock, Pen, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { EditListFAB } from "@/components/layout/FABs/edit-list-fab";
import { UserCard } from "@/components/users/user-card";
import { ErrorBoundaryWrapper } from "@/components/error-boundary-wrapper";
import { CollaboratorManagement } from "@/components/lists/collaborator-management";
import { useAuthService } from "@/lib/services/auth.service";

type CollaboratorRole = 'owner' | 'admin' | 'editor' | 'viewer';

interface ListViewProps {
  list: EnhancedList;
  isOwner: boolean;
  isPinned: boolean;
  isFollowing: boolean;
  isCollaborator: boolean;
  showCollaborators: boolean;
  onCollaboratorsClick: () => void;
  onPinChange?: (isPinned: boolean) => void;
}

export function ListView({ 
  list, 
  isOwner, 
  isCollaborator,
  isPinned, 
  isFollowing,
  showCollaborators,
  onCollaboratorsClick,
  onPinChange
}: ListViewProps) {
  const { user, isSignedIn } = useAuthService();

  const handlePinChange = (newPinned: boolean) => {
    onPinChange?.(newPinned);
  };

  return (
    <>
      {isSignedIn && user && showCollaborators && (
        <ErrorBoundaryWrapper>
          <CollaboratorManagement
            listId={list.id}
            isOwner={isOwner}
            privacy={list.privacy}
            onClose={onCollaboratorsClick}
            onPrivacyChange={(newPrivacy) => {
              list.privacy = newPrivacy;
            }}
            currentUserRole={user ? list.collaborators?.find(c => c.clerkId === user.id)?.role : undefined}
            owner={{
              clerkId: list.owner.clerkId,
              username: list.owner.username,
              imageUrl: list.owner.imageUrl || undefined,
              displayName: list.owner.displayName
            }}
          />
        </ErrorBoundaryWrapper>
      )}

      <div className="space-y-8 pb-24">
        <div key="header-section" className="header-section space-y-4">
          <div key="user-card" className="mb-4">
            <UserCard
              username={list.owner.username}
              displayName={list.owner.displayName}
              imageUrl={list.owner.imageUrl || ''}
              isFollowing={isSignedIn ? isFollowing : false}
              hideFollow={!isSignedIn}
            />
          </div>

          <div key="header-content" className="flex items-start justify-between gap-4">
            <div key="title-description" className="space-y-1">
              <h1 className="text-2xl font-bold">{list.title}</h1>
              {list.description && (
                <p className="text-muted-foreground">{list.description}</p>
              )}
            </div>
            <div key="category-privacy" className="flex items-center gap-2">
              <CategoryBadge category={list.category} />
              {list.privacy === 'private' && (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        <div className="items-section space-y-4">
          <h2 className="text-xl font-semibold">Items</h2>
          {Array.isArray(list.items) && list.items.length > 0 ? (
            <ul className="space-y-2">
              {list.items.map((item, index) => {
                const itemKey = `item-${item.id}-${index}`;
                return (
                  <li 
                    key={itemKey} 
                    className="flex items-stretch rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-center min-w-[3rem] bg-muted rounded-l-lg group-hover:bg-muted/70 transition-colors">
                      <span className="text-base font-medium text-muted-foreground">
                        {list.listType === 'ordered' ? (
                          index + 1
                        ) : (
                          <span className="text-xl">•</span>
                        )}
                      </span>
                    </div>
                    <div className="flex-1 p-4">
                      <div className="font-medium">{item.title}</div>
                      {item.comment && (
                        <div className="mt-1 text-sm text-muted-foreground">{item.comment}</div>
                      )}
                      {Array.isArray(item.properties) && item.properties.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {item.properties.map((prop) => {
                            const propKey = `${itemKey}-prop-${prop.id}`;
                            return (
                              <li key={propKey} className="text-sm text-muted-foreground">
                                {prop.type === 'link' ? (
                                  <a
                                    key={`${propKey}-link`}
                                    href={prop.value}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    {prop.value}
                                  </a>
                                ) : (
                                  <span key={`${propKey}-value`}>{prop.value}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div>No items in this list</div>
          )}
        </div>

        <div key="stats-section" className="stats-section space-y-4 border-t pt-4">
          <div key="stats-content" className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <div key="views" className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {list.stats.viewCount}
              </div>
              <div key="pins" className="flex items-center gap-1">
                <Pin className="h-3 w-3" />
                {list.stats.pinCount}
              </div>
              <div key="copies" className="flex items-center gap-1">
                <Copy className="h-3 w-3" />
                {list.stats.copyCount}
              </div>
            </div>
            <div key="timestamps" className="flex flex-col gap-1 text-right">
              {list.editedAt && 
                Math.floor(new Date(list.editedAt).getTime() / 60000) > 
                Math.floor(new Date(list.createdAt).getTime() / 60000) ? (
                <>
                  <div className="flex items-center gap-1 justify-end">
                    <Pen className="h-4 w-4" />
                    <span>{formatDistanceToNow(new Date(list.editedAt), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <Plus className="h-4 w-4" />
                    <span>{formatDistanceToNow(new Date(list.createdAt), { addSuffix: true })}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1 justify-end">
                  <Plus className="h-4 w-4" />
                  <span>{formatDistanceToNow(new Date(list.createdAt), { addSuffix: true })}</span>
                </div>
              )}
            </div>
          </div>

          {isSignedIn && user && (
            <ListActionBar
              listId={list.id}
              isPinned={isPinned}
              onPinChange={handlePinChange}
            />
          )}
        </div>

        {isSignedIn && user && isOwner && (
          <div key="fab-section" className="fab-section">
            <EditListFAB 
              listId={list.id} 
              username={list.owner.username}
            />
          </div>
        )}
      </div>
    </>
  );
} 