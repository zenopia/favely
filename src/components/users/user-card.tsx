"use client";

import { useState, useEffect } from "react";
import { UserProfileBase } from "./user-profile-base";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useAuthService } from "@/lib/services/auth.service";

interface UserCardProps {
  username: string;
  displayName: string;
  imageUrl: string;
  isFollowing?: boolean;
  hideFollow?: boolean;
}

function UserCardSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card animate-pulse">
      <div className="flex items-center gap-3 min-w-0">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export function UserCard({ username, displayName, imageUrl, isFollowing: initialIsFollowing = false, hideFollow = false }: UserCardProps) {
  const { user, isLoaded } = useAuthService();
  const { getToken } = useAuthGuard();
  const [isLoading, setIsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const pathname = usePathname();
  const usernameWithAt = username.startsWith('@') ? username : `@${username}`;

  // Check follow status when component mounts and user is signed in
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user) {
        setIsFollowing(false);
        return;
      }
      
      try {
        // Get token with retry for mobile
        let token = await getToken();
        if (!token && /Mobile|Android|iPhone/i.test(window.navigator.userAgent)) {
          // Try one more time for mobile browsers
          await new Promise(resolve => setTimeout(resolve, 100));
          token = await getToken();
        }

        if (!token) {
          console.warn('No auth token available for follow status check');
          return;
        }

        const response = await fetch(`/api/users/${username}/follow/status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setIsFollowing(data.isFollowing);
        } else if (response.status === 401) {
          // Handle unauthorized specifically
          console.warn('Unauthorized when checking follow status');
          setIsFollowing(false);
        }
      } catch (error) {
        console.error("Error checking follow status:", error);
        setIsFollowing(false);
      }
    };

    if (isLoaded && user) {
      checkFollowStatus();
    }
  }, [username, user, isLoaded, getToken]);

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation when clicking the button
    e.stopPropagation(); // Stop event from bubbling up

    if (!user) {
      toast.error("Please sign in to follow users");
      return;
    }

    setIsLoading(true);
    try {
      // Get token with retry for mobile
      let token = await getToken();
      if (!token && /Mobile|Android|iPhone/i.test(window.navigator.userAgent)) {
        // Try one more time for mobile browsers
        await new Promise(resolve => setTimeout(resolve, 100));
        token = await getToken();
      }

      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/users/${username}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(isFollowing ? "Failed to unfollow user" : "Failed to follow user");
      }

      setIsFollowing(!isFollowing);
      toast.success(isFollowing ? "Successfully unfollowed user" : "Successfully followed user");
    } catch (error) {
      console.error(isFollowing ? "Error unfollowing user:" : "Error following user:", error);
      toast.error(isFollowing ? "Failed to unfollow user" : "Failed to follow user");
    } finally {
      setIsLoading(false);
    }
  };

  // Show nothing during initial load to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <Link 
      href={`/profile/${usernameWithAt}?from=${pathname.startsWith('/') ? pathname.slice(1) : pathname}`}
      className="block"
    >
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <UserProfileBase
            username={username}
            firstName={displayName}
            imageUrl={imageUrl}
            variant="compact"
            hideFollow={true}
            linkToProfile={false}
          />
        </div>
        {!hideFollow && user && user.username !== username && (
          <Button
            variant={isFollowing ? "outline" : "default"}
            size="sm"
            className="flex-shrink-0"
            onClick={handleFollowClick}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : (isFollowing ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Following
              </>
            ) : 'Follow')}
          </Button>
        )}
      </div>
    </Link>
  );
} 