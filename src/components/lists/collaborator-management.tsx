'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Globe, Lock, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CollaboratorCard } from "@/components/users/collaborator-card";
import { UserCombobox } from "@/components/users/user-combobox";
import { useAuthService } from "@/lib/services/auth.service";
import { useVirtualizer } from '@tanstack/react-virtual';
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserInviteValue {
  type: 'user';
  userId: string;
  username: string;
  displayName: string;
  imageUrl: string | null;
}

interface EmailInviteValue {
  type: 'email';
  email: string;
  note?: string;
}

type InviteValue = UserInviteValue | EmailInviteValue;

interface Collaborator {
  userId: string;
  clerkId: string;
  username: string;
  email?: string;
  imageUrl?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  status?: 'pending' | 'accepted' | 'rejected';
  _isEmailInvite?: boolean;
  displayName?: string;
}

interface FollowingUser {
  id: string;
  username: string;
  displayName: string;
  imageUrl: string | null;
}

interface CollaboratorManagementProps {
  listId: string;
  isOwner: boolean;
  visibility: 'public' | 'unlisted' | 'private';
  onClose: () => void;
  onVisibilityChange?: (visibility: 'public' | 'unlisted' | 'private') => void;
  currentUserRole?: 'owner' | 'admin' | 'editor' | 'viewer';
  owner: {
    clerkId: string;
    username: string;
    imageUrl?: string;
    displayName?: string;
  };
}

export function CollaboratorManagement({ 
  listId, 
  isOwner, 
  visibility: initialVisibility,
  onClose,
  onVisibilityChange,
  currentUserRole,
  owner
}: CollaboratorManagementProps) {
  const { user: currentUser } = useAuthService();
  const userId = currentUser?.id;
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(true);
  const [visibility, setVisibility] = useState(initialVisibility);
  const parentRef = React.useRef<HTMLDivElement>(null);

  const canManageCollaborators = isOwner || currentUserRole === 'admin';

  // Create virtualizer for collaborator list
  const rowVirtualizer = useVirtualizer({
    count: collaborators.length + 1, // +1 for owner
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height of each collaborator card
    overscan: 5, // Number of items to render outside of the visible area
  });

  // Memoize the filtered collaborators list
  const filteredCollaborators = React.useMemo(() => 
    collaborators.filter(c => c.role !== 'owner'),
    [collaborators]
  );

  // Function to fetch collaborators with caching
  const fetchCollaborators = React.useCallback(async () => {
    setIsLoadingCollaborators(true);
    try {
      const cacheKey = `collaborators-${listId}`;
      const cachedData = sessionStorage.getItem(cacheKey);
      
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const isExpired = Date.now() - timestamp > 30000; // Cache for 30 seconds
        
        if (!isExpired) {
          setCollaborators(data);
          setIsLoadingCollaborators(false);
          return;
        }
      }

      const response = await fetch(`/api/lists/${listId}/collaborators`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      
      // Cache the response
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data: data.collaborators,
        timestamp: Date.now()
      }));

      setCollaborators(data.collaborators || []);
    } catch (error) {
      toast.error("Failed to load collaborators");
    } finally {
      setIsLoadingCollaborators(false);
    }
  }, [listId]);

  // Fetch collaborators on mount
  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  // Fetch following users with caching
  const fetchFollowing = React.useCallback(async () => {
    try {
      const cacheKey = 'following-users';
      const cachedData = sessionStorage.getItem(cacheKey);
      
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const isExpired = Date.now() - timestamp > 60000; // Cache for 1 minute
        
        if (!isExpired) {
          setFollowingIds(data);
          setIsLoadingFollowing(false);
          return;
        }
      }

      const response = await fetch('/api/users/following');
      if (!response.ok) throw new Error();
      const data = await response.json();
      
      // Extract IDs from the following array
      const followingIds = data.following.map((user: FollowingUser) => user.id);
      
      // Cache the response
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data: followingIds,
        timestamp: Date.now()
      }));

      setFollowingIds(followingIds);
    } catch (error) {
      console.error('Failed to fetch following:', error);
      toast.error("Failed to load following users");
    } finally {
      setIsLoadingFollowing(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowing();
  }, [fetchFollowing]);

  useEffect(() => {
    // Trigger open animation after mount
    requestAnimationFrame(() => {
      setIsOpen(true);
    });
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  const handleInvite = async (value: InviteValue) => {
    const toastId = toast.loading(
      value.type === 'user' 
        ? 'Adding collaborator...' 
        : 'Sending invitation...'
    );
    
    try {
      setIsLoading(true);

      // Check if user has permission to add collaborators
      if (!canManageCollaborators) {
        throw new Error("You don't have permission to add collaborators");
      }

      if (value.type === 'user' && !value.userId) {
        throw new Error("User ID is required for user invites");
      }

      const requestBody = {
        type: value.type,
        targetUserId: value.type === 'user' ? value.userId : undefined,
        email: value.type === 'email' ? value.email : undefined,
        role: 'viewer',
        status: value.type === 'user' ? 'accepted' : 'pending'
      };

      const response = await fetch(`/api/lists/${listId}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add collaborator');
      }

      await response.json();

      // For user invites, we want to show them immediately as an accepted collaborator
      if (value.type === 'user') {
        const newCollaborator = {
          userId: value.userId,
          clerkId: value.userId,
          username: value.username,
          displayName: value.displayName,
          imageUrl: value.imageUrl,
          role: 'viewer',
          status: 'accepted',
          _isEmailInvite: false
        } as Collaborator;
        
        setCollaborators(prevCollaborators => [...prevCollaborators, newCollaborator]);
      } else {
        // For email invites, show as pending
        setCollaborators(prevCollaborators => [...prevCollaborators, {
          userId: value.email,
          email: value.email,
          role: 'viewer',
          status: 'pending',
          _isEmailInvite: true
        } as Collaborator]);
      }

      toast.success(
        value.type === 'user' 
          ? 'Collaborator added successfully' 
          : 'Invitation sent successfully',
        { id: toastId }
      );
    } catch (error) {
      console.error('Error adding collaborator:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to add collaborator',
        { id: toastId }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVisibility = async (newVisibility: 'public' | 'unlisted' | 'private') => {
    setIsLoading(true);
    // Update state immediately for smoother UI
    setVisibility(newVisibility);
    
    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          visibility: newVisibility,
        }),
      });

      if (!response.ok) {
        // Revert on error
        setVisibility(visibility);
        throw new Error();
      }

      const updatedList = await response.json();
      onVisibilityChange?.(updatedList.visibility);
      toast.success("Visibility updated!");
    } catch (error) {
      toast.error("Failed to update visibility");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const toastId = toast.loading('Updating role...');
    setIsLoading(true);
    try {
      const targetCollaborator = collaborators.find(c => c.userId === userId);

      // Don't allow changing owner's role
      if (targetCollaborator?.role === 'owner') {
        throw new Error("Cannot change the owner's role");
      }

      // Only owner or admin can change roles
      if (!canManageCollaborators) {
        throw new Error("You don't have permission to change roles");
      }

      // Admin cannot promote to owner
      if (currentUserRole === 'admin' && newRole === 'owner') {
        throw new Error("Only the owner can transfer ownership");
      }

      // Use clerkId for the API call
      const clerkId = targetCollaborator?.clerkId || userId;
      const response = await fetch(`/api/lists/${listId}/collaborators/${clerkId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: newRole,
        }),
      });

      if (!response.ok) {
        throw new Error();
      }

      // Refresh collaborators list
      const updatedResponse = await fetch(`/api/lists/${listId}/collaborators`);
      if (!updatedResponse.ok) {
        throw new Error('Failed to fetch updated collaborators');
      }

      const data = await updatedResponse.json();
      setCollaborators(data.collaborators || []);
      toast.success("Role updated!", { id: toastId });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message, { id: toastId });
      } else {
        toast.error("Failed to update role", { id: toastId });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    const toastId = toast.loading('Removing collaborator...');
    const isCurrentUser = collaboratorId === userId;
    
    try {
      setIsLoading(true);

      // Check if user has permission to remove collaborators
      if (!canManageCollaborators && !isCurrentUser) {
        throw new Error("You don't have permission to remove other collaborators");
      }

      const targetCollaborator = collaborators.find(c => c.userId === collaboratorId);
      if (targetCollaborator?.role === 'owner') {
        throw new Error("Cannot remove the owner");
      }

      // Use clerkId for the API call
      const clerkId = targetCollaborator?.clerkId || collaboratorId;
      const response = await fetch(`/api/lists/${listId}/collaborators/${clerkId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove collaborator');
      }

      // After successful deletion, fetch the updated collaborators list
      const updatedResponse = await fetch(`/api/lists/${listId}/collaborators`);
      if (!updatedResponse.ok) {
        throw new Error('Failed to fetch updated collaborators');
      }

      const data = await updatedResponse.json();
      if (!Array.isArray(data.collaborators)) {
        throw new Error('Invalid collaborators data received');
      }

      setCollaborators(data.collaborators);
      
      // If the user removed themselves, close the sheet
      if (isCurrentUser) {
        onClose();
      }

      toast.success(
        isCurrentUser ? 'You left the list' : 'Collaborator removed successfully',
        { id: toastId }
      );
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message, { id: toastId });
      } else {
        toast.error(
          isCurrentUser ? 'Failed to leave list' : 'Failed to remove collaborator',
          { id: toastId }
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0"
        )}
        onClick={handleClose}
      />

      {/* Collaborator Sheet */}
      <div 
        className={cn(
          "fixed inset-y-0 right-0 w-[400px] bg-background shadow-lg pointer-events-auto",
          "border-l transition-transform duration-300 ease-in-out transform",
          "z-[101] max-h-screen overflow-hidden",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full relative">
          <div className="flex items-center justify-between p-6 pb-0">
            <div>
              <h2 className="text-lg font-semibold">List Access</h2>
              <p className="text-sm text-muted-foreground">
                Admins can edit access to this list.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 pt-4" ref={parentRef}>
            <div className="space-y-6 pb-40">
              {/* Privacy section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {visibility === "public" ? (
                        <Globe className="h-4 w-4" />
                      ) : visibility === "unlisted" ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <h3 className="font-medium">
                        {visibility === "public" ? "Public" : visibility === "unlisted" ? "Unlisted" : "Private"} List
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground pr-2">
                      {visibility === "public"
                        ? "Anyone can view this list"
                        : visibility === "unlisted"
                        ? "Anyone with the link can view this list. The list wont appear in your profile or in search results."
                        : "Only you and your added collaborators can view this list"}
                    </p>
                  </div>
                  {(isOwner || collaborators.some(c => c.role === 'admin')) && (
                    <Select
                      value={visibility}
                      onValueChange={(value: 'public' | 'unlisted' | 'private') => {
                        if (value !== visibility) {
                          toggleVisibility(value);
                        }
                      }}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[200]" position="popper" side="bottom">
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="unlisted">Unlisted</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Invite section */}
              {canManageCollaborators && (
                <>
                  <div className="space-y-2">
                    <UserCombobox
                      placeholder="Add people by username or email..."
                      onSelect={handleInvite}
                      disabled={isLoading || isLoadingFollowing}
                      userIds={followingIds}
                      excludeUserIds={collaborators
                        .filter(c => !c._isEmailInvite && c.clerkId)
                        .map(c => c.clerkId)
                      }
                    />
                  </div>
                  <div className="h-[1px] bg-border" />
                </>
              )}

              {/* Virtualized collaborators list */}
              <div className="space-y-4">
                {isLoadingCollaborators ? (
                  <CollaboratorCard
                    key="loading-collaborator"
                    userId="loading-collaborator"
                    username="loading"
                    role="viewer"
                    linkToProfile={false}
                    className="animate-pulse"
                  />
                ) : (
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const isOwnerRow = virtualRow.index === 0;
                      const collaborator = isOwnerRow ? null : filteredCollaborators[virtualRow.index - 1];

                      return (
                        <div
                          key={isOwnerRow ? 'owner' : collaborator?.userId}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {isOwnerRow ? (
                            <CollaboratorCard
                              key={`owner-${owner.clerkId}`}
                              userId={owner.clerkId}
                              username={owner.username}
                              imageUrl={owner.imageUrl}
                              role="owner"
                              status="accepted"
                              clerkId={owner.clerkId}
                              canManageRoles={false}
                              isOwner={isOwner}
                              displayName={owner.displayName}
                            />
                          ) : collaborator && (
                            <CollaboratorCard
                              key={collaborator._isEmailInvite 
                                ? `email-invite-${collaborator.email}-${collaborator.userId}`
                                : `collaborator-${collaborator.userId}`}
                              userId={collaborator.userId}
                              username={collaborator.username}
                              email={collaborator.email}
                              imageUrl={collaborator.imageUrl}
                              role={collaborator.role}
                              status={collaborator.status}
                              clerkId={!collaborator._isEmailInvite ? collaborator.clerkId : undefined}
                              canManageRoles={canManageCollaborators && collaborator.role !== 'owner'}
                              isOwner={isOwner}
                              currentUserRole={collaborator.userId === userId ? collaborator.role : undefined}
                              onRoleChange={(newRole) => handleRoleChange(collaborator.userId, newRole)}
                              onRemove={() => handleRemoveCollaborator(collaborator.userId)}
                              displayName={collaborator.displayName}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 