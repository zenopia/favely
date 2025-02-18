"use client";

import { useState, useEffect } from "react";
import { ListView } from "@/components/lists/list-view";
import { ListViewNav } from "@/components/layout/nav/list-view-nav";
import { ErrorBoundaryWrapper } from "@/components/error-boundary-wrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { EnhancedList } from "@/types/list";
import { ListLayout } from "@/components/layout/list-layout";
import { useProtectedFetch } from "@/hooks/use-protected-fetch";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useAuthService } from "@/lib/services/auth.service";
import { useRouter } from "next/navigation";

interface ListPageContentProps {
  list: EnhancedList;
  isOwner: boolean;
  isPinned: boolean;
  isFollowing: boolean;
  _isCollaborator: boolean;
  returnPath?: string;
  isLoading?: boolean;
  error?: string;
}

export function ListPageContent({
  list,
  isOwner,
  isPinned: initialIsPinned,
  isFollowing: initialIsFollowing,
  _isCollaborator: initialIsCollaborator,
  returnPath,
  isLoading: initialIsLoading,
  error: initialError
}: ListPageContentProps) {
  const router = useRouter();
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [isPinned, setIsPinned] = useState(initialIsPinned);
  const [isFollowing, _setIsFollowing] = useState(initialIsFollowing);
  const [isCollaborator, _setIsCollaborator] = useState(initialIsCollaborator);
  const { fetchWithAuth } = useProtectedFetch();
  const { isSignedIn: _isSignedIn } = useAuthGuard({ protected: false }); // Don't force auth
  const { user: _user } = useAuthService();

  // Update local pin state when initial value changes
  useEffect(() => {
    setIsPinned(initialIsPinned);
  }, [initialIsPinned]);

  const handlePinChange = (newPinned: boolean) => {
    setIsPinned(newPinned);
    // Update the server state in the background using fetchWithAuth
    fetchWithAuth(`/api/lists/${list.id}/pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pinned: newPinned }),
      requireAuth: true
    }).then(() => {
      // Only refresh the page data after the server update is complete
      router.refresh();
    }).catch(error => {
      console.error('Error updating pin status:', error);
      // Revert the local state if the server update fails
      setIsPinned(!newPinned);
    });
  };

  if (initialIsLoading) {
    return (
      <ListLayout>
        <div className="container px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8 space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full max-w-[600px]" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </ListLayout>
    );
  }

  if (initialError) {
    return (
      <ListLayout>
        <div className="container px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{initialError}</AlertDescription>
          </Alert>
        </div>
      </ListLayout>
    );
  }

  return (
    <ListLayout>
      <div className="flex flex-col min-h-[calc(100vh-64px)]">
        <ListViewNav 
          returnPath={returnPath} 
          title={list.title}
          isOwner={isOwner}
          isCollaborator={isCollaborator}
          showCollaborators={showCollaborators}
          onCollaboratorsClick={() => setShowCollaborators(!showCollaborators)}
          collaborators={list.collaborators}
        />
        <div className="flex-1 container px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8 overflow-y-auto">
          <ErrorBoundaryWrapper>
            <ListView
              list={list}
              isOwner={isOwner}
              isPinned={isPinned}
              isFollowing={isFollowing}
              _isCollaborator={isCollaborator}
              showCollaborators={showCollaborators}
              onCollaboratorsClick={() => setShowCollaborators(!showCollaborators)}
              onPinChange={handlePinChange}
            />
          </ErrorBoundaryWrapper>
        </div>
      </div>
    </ListLayout>
  );
} 