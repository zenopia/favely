'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CollaboratorCard } from "@/components/users/collaborator-card";
import { UserCombobox } from "@/components/users/user-combobox";
import { useAuthService } from "@/lib/services/auth.service";

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

interface FollowingResult {
  followingId: string;
  user: {
    username: string;
    displayName: string;
    imageUrl?: string;
  };
}

interface CollaboratorManagementProps {
  listId: string;
  isOwner: boolean;
  privacy: 'public' | 'private';
  onClose: () => void;
  onPrivacyChange?: (privacy: 'public' | 'private') => void;
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
  privacy: initialPrivacy,
  onClose,
  onPrivacyChange,
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
  const [privacy, setPrivacy] = useState(initialPrivacy);

  const canManageCollaborators = isOwner || currentUserRole === 'admin';

  useEffect(() => {
    // Trigger open animation after mount
    requestAnimationFrame(() => {
      setIsOpen(true);
    });
  }, []);

  // Function to fetch collaborators
  const fetchCollaborators = async () => {
    setIsLoadingCollaborators(true);
    try {
      const response = await fetch(`/api/lists/${listId}/collaborators`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setCollaborators(data.collaborators || []);
    } catch (error) {
      toast.error("Failed to load collaborators");
    } finally {
      setIsLoadingCollaborators(false);
    }
  };

  useEffect(() => {
    fetchCollaborators();
  }, [listId]);

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        const response = await fetch('/api/users/following');
        if (!response.ok) throw new Error();
        const data = await response.json();
        setFollowingIds(data.following.map((result: FollowingResult) => result.followingId));
      } catch (error) {
        console.error('Failed to fetch following:', error);
        toast.error("Failed to load following users");
      } finally {
        setIsLoadingFollowing(false);
      }
    };

    fetchFollowing();
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  const handleInvite = async (value: { type: 'user' | 'email', userId?: string, username?: string, email?: string }) => {
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
        targetUserId: value.userId,  // This is already the Clerk ID
        email: value.email,
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
        // The user data is already in the value object from the combobox
        const newCollaborator = {
          userId: value.userId,
          clerkId: value.userId,
          username: value.username,
          role: 'viewer',
          status: 'accepted',
          _isEmailInvite: false,
          imageUrl: (value as any).imageUrl,
          displayName: (value as any).displayName
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
        {
          id: toastId
        }
      );
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message, { id: toastId });
      } else {
        toast.error(
          value.type === 'user'
            ? "Failed to add collaborator"
            : "Failed to send invitation",
          { id: toastId }
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const togglePrivacy = async () => {
    const newPrivacy = privacy === "public" ? "private" : "public";
    setIsLoading(true);
    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          privacy: newPrivacy,
        }),
      });

      if (!response.ok) {
        throw new Error();
      }

      const updatedList = await response.json();
      setPrivacy(updatedList.privacy);
      onPrivacyChange?.(updatedList.privacy);
      toast.success("Privacy updated!");
    } catch (error) {
      toast.error("Failed to update privacy");
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
          "border-l transition-transform duration-300 ease-in-out",
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

          <div className="flex-1 overflow-y-auto p-6 pt-4">
            <div className="space-y-6 pb-40">
              {/* Privacy section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {privacy === "public" ? (
                        <Globe className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <h3 className="font-medium">
                        {privacy === "public" ? "Public" : "Private"} List
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {privacy === "public"
                        ? "Anyone can view this list"
                        : "Only collaborators can view this list"}
                    </p>
                  </div>
                  {(isOwner || collaborators.some(c => c.role === 'admin')) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={togglePrivacy}
                      disabled={isLoading}
                    >
                      Make {privacy === "public" ? "Private" : "Public"}
                    </Button>
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

              {/* Collaborators list */}
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
                  <>
                    {/* Show owner first */}
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

                    {/* Show other collaborators */}
                    {collaborators.filter(c => c.role !== 'owner').map(collaborator => {
                      const isCurrentUser = collaborator.userId === userId;
                      const canManageRoles = canManageCollaborators && collaborator.role !== 'owner';
                      const uniqueKey = collaborator._isEmailInvite 
                        ? `email-invite-${collaborator.email}-${collaborator.userId}`
                        : `collaborator-${collaborator.userId}`;
                      return (
                        <CollaboratorCard
                          key={uniqueKey}
                          userId={collaborator.userId}
                          username={collaborator.username}
                          email={collaborator.email}
                          imageUrl={collaborator.imageUrl}
                          role={collaborator.role}
                          status={collaborator.status}
                          clerkId={!collaborator._isEmailInvite ? collaborator.clerkId : undefined}
                          canManageRoles={canManageRoles}
                          isOwner={isOwner}
                          currentUserRole={isCurrentUser ? collaborator.role : undefined}
                          onRoleChange={(newRole) => handleRoleChange(collaborator.userId, newRole)}
                          onRemove={() => handleRemoveCollaborator(collaborator.userId)}
                          displayName={collaborator.displayName}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 