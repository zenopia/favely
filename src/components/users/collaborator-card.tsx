"use client";

import { UserProfileBase } from "@/components/users/user-profile-base";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useUsers } from "@/hooks/use-users";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePathname } from "next/navigation";
import React from "react";

export interface CollaboratorCardProps {
  userId: string;
  username?: string;
  email?: string;
  imageUrl?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  status?: 'pending' | 'accepted' | 'rejected';
  clerkId?: string;
  acceptedDate?: string;
  linkToProfile?: boolean;
  canManageRoles?: boolean;
  isOwner?: boolean;
  currentUserRole?: 'owner' | 'admin' | 'editor' | 'viewer';
  onRoleChange?: (newRole: string) => void;
  onRemove?: () => void;
  onResendInvite?: () => void;
  onCancelInvite?: () => void;
  onAcceptInvite?: () => void;
  onRejectInvite?: () => void;
  className?: string;
  displayName?: string;
}

export const CollaboratorCard = React.memo(function CollaboratorCard({ 
  userId, 
  username, 
  email,
  imageUrl,
  role,
  clerkId,
  linkToProfile = true,
  canManageRoles = false,
  isOwner = false,
  currentUserRole,
  onRoleChange,
  onRemove,
  onResendInvite,
  onCancelInvite,
  onAcceptInvite,
  onRejectInvite,
  className,
  displayName
}: CollaboratorCardProps) {
  const isEmailInvite = !clerkId;
  const pathname = usePathname();
  const relativePath = pathname.replace(/^\//, '');
  const usernameWithAt = username?.startsWith('@') ? username : username ? `@${username}` : '';

  const { data: userData, isLoading } = useUsers(clerkId ? [clerkId] : undefined);
  const user = userData?.[0];

  const roleBadgeVariant = React.useMemo(() => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'editor':
        return 'secondary';
      default:
        return 'outline';
    }
  }, [role]);

  if (!isEmailInvite && isLoading) {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-muted rounded" />
      </div>
    );
  }

  const roleDisplay = (
    (canManageRoles || currentUserRole) && role !== 'owner' ? (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className={cn(
              "flex items-center gap-1 px-2 h-6 capitalize",
              "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {role}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[150]">
          {canManageRoles && (
            <>
              <DropdownMenuItem onClick={() => onRoleChange?.('admin')}>
                Admin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRoleChange?.('editor')}>
                Editor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRoleChange?.('viewer')}>
                Viewer
              </DropdownMenuItem>
              {isOwner && (
                <DropdownMenuItem onClick={() => onRoleChange?.('owner')}>
                  Transfer Ownership
                </DropdownMenuItem>
              )}
            </>
          )}
          {/* Always show remove option for collaborators to remove themselves */}
          <DropdownMenuItem
            onClick={onRemove}
            className="text-destructive focus:text-destructive"
          >
            {currentUserRole && !canManageRoles ? "Leave List" : "Remove"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : (
      <div className="flex items-center gap-2">
        <Badge variant={roleBadgeVariant} className="capitalize">
          {role}
        </Badge>
      </div>
    )
  );

  const content = (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {isEmailInvite ? (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate max-w-[200px]">
                {email}
              </span>
              <Badge variant="secondary" className="mt-0.5 text-xs w-fit">
                Pending Invite
              </Badge>
            </div>
          </div>
        ) : (
          <UserProfileBase
            username={username || user?.username || ''}
            firstName={displayName || user?.displayName}
            imageUrl={imageUrl || user?.imageUrl}
            variant="compact"
            hideFollow={true}
            linkToProfile={false}
          />
        )}
      </div>
      <div onClick={(e) => e.preventDefault()}>
        {roleDisplay}
      </div>
    </div>
  );

  if (linkToProfile && status === 'accepted') {
    return (
      <Link href={`/profile/${usernameWithAt}?from=${relativePath}`}>
        {content}
      </Link>
    );
  }

  return content;
}); 