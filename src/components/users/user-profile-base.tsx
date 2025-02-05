"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FollowButton } from "@/components/users/follow-button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MapPin, Calendar, Users, UserCircle2Icon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface UserProfileBaseProps {
  // Core user data
  username: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  livingStatus?: string | null;
  privacySettings?: {
    showBio?: boolean;
    showLocation?: boolean;
    showPersonalDetails?: boolean;
    showDateOfBirth?: boolean;
    showGender?: boolean;
    showLivingStatus?: boolean;
  };
  
  // Display options
  variant?: "full" | "card" | "compact";
  hideFollow?: boolean;
  isFollowing?: boolean;
  showLocation?: boolean;
  showStats?: boolean;
  stats?: {
    followers?: number;
    following?: number;
    lists?: number;
  };
  
  // Additional options
  className?: string;
  linkToProfile?: boolean;
  onClick?: () => void;
  profilePath?: string;
  showEditButton?: boolean;
  actions?: React.ReactNode;
}

export function formatDisplayName(firstName: string | null | undefined, lastName: string | null | undefined, username: string, fullName?: string | null): string {
  if (fullName) return fullName;
  const constructedName = [firstName, lastName].filter(Boolean).join(' ');
  return constructedName || username;
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const m = today.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

export function UserProfileBase({
  username,
  fullName,
  firstName,
  lastName,
  imageUrl,
  bio,
  location,
  dateOfBirth,
  gender,
  livingStatus,
  privacySettings,
  variant = "card",
  hideFollow = false,
  isFollowing = false,
  showLocation = true,
  showStats = false,
  stats,
  className,
  linkToProfile = true,
  onClick,
  profilePath,
  showEditButton = false,
  actions,
}: UserProfileBaseProps) {
  const displayName = formatDisplayName(firstName, lastName, username, fullName);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from');
  
  const content = (
    <div className={cn(
      "flex items-center gap-4",
      variant === "full" && "flex-col w-full items-start sm:flex-row sm:items-center",
      className
    )}>
      <Avatar className={cn(
        "shrink-0",
        variant === "full" ? "h-20 w-20" : "h-10 w-10",
        variant === "compact" && "h-8 w-8"
      )}>
        <AvatarImage src={imageUrl || undefined} alt={displayName} />
        <AvatarFallback>{displayName && displayName[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className={cn(
        "flex-1 min-w-0",
        variant === "full" && "w-full"
      )}>
        {variant === "full" ? (
          <>
            <div className="flex items-start justify-between gap-4 mb-4 sm:mb-2">
              <div>
                <h2 className="text-2xl font-bold truncate">{displayName}</h2>
                <p className="text-muted-foreground">@{username}</p>
              </div>
              <div className="flex items-center gap-2">
                {showEditButton && (
                  <Link href="/profile">
                    <Button variant="outline" size="sm">
                      Edit Profile
                    </Button>
                  </Link>
                )}
                {!hideFollow && (
                  <FollowButton
                    username={username}
                    isFollowing={isFollowing}
                    variant="default"
                  />
                )}
              </div>
            </div>

            {showStats && stats && (
              <div className="flex gap-4 mt-2">
                {stats.followers !== undefined && (
                  <Link href={`/profile/${username}/followers${fromParam ? `?from=${fromParam}` : ''}`} className="text-sm">
                    <span className="font-semibold">{stats.followers}</span>{" "}
                    <span className="text-muted-foreground">Followers</span>
                  </Link>
                )}
                {stats.following !== undefined && (
                  <Link href={`/profile/${username}/following${fromParam ? `?from=${fromParam}` : ''}`} className="text-sm">
                    <span className="font-semibold">{stats.following}</span>{" "}
                    <span className="text-muted-foreground">Following</span>
                  </Link>
                )}
                {stats.lists !== undefined && (
                  <div className="text-sm">
                    <span className="font-semibold">{stats.lists}</span>{" "}
                    <span className="text-muted-foreground">Lists</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
              {showLocation && location && privacySettings?.showLocation && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{location}</span>
                </div>
              )}
              {dateOfBirth && privacySettings?.showDateOfBirth && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{calculateAge(new Date(dateOfBirth))} years old</span>
                </div>
              )}
              {gender && privacySettings?.showGender && gender !== 'prefer-not-to-say' && (
                <div className="flex items-center gap-1">
                   <UserCircle2Icon className="h-4 w-4" />
                  <span className="capitalize">{gender}</span>
                </div>
              )}
              {livingStatus && privacySettings?.showLivingStatus && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="capitalize">{livingStatus.replace('-', ' ')}</span>
                </div>
              )}
            </div>

            {bio && privacySettings?.showBio && (
              <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">
                {bio}
              </p>
            )}
          </>
        ) : (
          <div>
            <div className={cn(
              "font-semibold truncate",
              variant === "compact" && "text-sm"
            )}>
              {displayName}
            </div>
            <p className={cn(
              "text-muted-foreground truncate",
              variant === "compact" && "text-xs"
            )}>
              @{username}
            </p>
          </div>
        )}
      </div>

      {!hideFollow && variant !== "full" && (
        <FollowButton
          username={username}
          isFollowing={isFollowing}
          variant="outline"
        />
      )}

      {actions}
    </div>
  );

  if (linkToProfile && variant !== "full") {
    const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    return (
      <Link
        href={variant === "compact" ? (profilePath || `/profile/${username}`) : `/profile/${username}?from=${relativePath}`}
        className={cn(
          "block",
          onClick && "cursor-pointer",
          variant === "card" && "p-6 rounded-lg border bg-card hover:border-primary transition-colors"
        )}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  return content;
} 