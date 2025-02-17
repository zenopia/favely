"use client";

import { EnhancedList } from "@/types/list";
import { CategoryBadge } from "@/components/lists/category-badge";
import ListActionBar from "@/components/lists/list-action-bar";
import { Eye, Pin, Copy, Lock, Pen, Plus, EyeOff, ExternalLink, CheckCircle2, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { EditListFAB } from "@/components/layout/FABs/edit-list-fab";
import { UserCard } from "@/components/users/user-card";
import { ErrorBoundaryWrapper } from "@/components/error-boundary-wrapper";
import { CollaboratorManagement } from "@/components/lists/collaborator-management";
import { useAuthService } from "@/lib/services/auth.service";
import { cn } from "@/lib/utils";

interface ListViewProps {
  list: EnhancedList;
  isOwner: boolean;
  _isCollaborator: boolean;
  isPinned: boolean;
  isFollowing: boolean;
  showCollaborators: boolean;
  onCollaboratorsClick: () => void;
  onPinChange?: (isPinned: boolean) => void;
}

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

const getCategoryVar = (category?: string) => {
  if (!category) return 'other';
  switch (category) {
    case 'tv-shows': return 'tv';
    case 'things-to-do': return 'activities';
    default: return category;
  }
};

export function ListView({ 
  list, 
  isOwner, 
  _isCollaborator,
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
                <p className="text-muted-foreground whitespace-pre-wrap">{list.description}</p>
              )}
            </div>
            <div key="category-privacy" className="flex items-center gap-2">
              <CategoryBadge category={list.category} />
              {list.privacy === 'private' && (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              {list.privacy === 'unlisted' && (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        <div className="items-section space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Items</h2>
          </div>
          {Array.isArray(list.items) && list.items.length > 0 ? (
            <ul className="space-y-2">
              {list.items.map((item) => {
                return (
                  <li
                    key={item.id}
                    className="flex items-start border-b last:border-b-0 relative"
                    style={{
                      borderLeft: `4px solid var(--category-${getCategoryVar(list.category)})`,
                      borderBottom: 'none',
                      borderRadius: '0.375rem',
                      marginBottom: '4px'
                    }}
                  >
                    <div className="flex items-center justify-center p-4">
                      <span className="flex items-center justify-center">
                        {item.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </span>
                    </div>
                    <div className="flex-1 p-4">
                      <div className={cn(
                        "font-medium",
                        item.completed && "text-muted-foreground line-through"
                      )}>
                        <TextWithUrls text={item.title} />
                      </div>
                      {item.comment && (
                        <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                          <TextWithUrls text={item.comment} />
                        </div>
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
          <div key="fab-section" className="fixed bottom-0 right-0 w-full pointer-events-none">
            <div className="container max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
              <div className="pointer-events-auto flex justify-end">
                <EditListFAB 
                  listId={list.id} 
                  username={list.owner.username}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 