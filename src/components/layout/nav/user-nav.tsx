"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Settings, LogOut } from "lucide-react";
import { useState, useMemo } from "react";
import { Portal } from "@radix-ui/react-portal";
import { cn } from "@/lib/utils";
import { useAuthService } from "@/lib/services/auth.service";

export function UserNav() {
  const { isSignedIn, isLoaded, user, signOut } = useAuthService();
  const [open, setOpen] = useState(false);

  const initials = useMemo(() => {
    if (!user?.fullName && !user?.username) return "U";
    return user.fullName
      ? user.fullName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : user.username?.[0]?.toUpperCase() || "U";
  }, [user?.fullName, user?.username]);

  if (!isLoaded) {
    return (
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
    );
  }

  if (!isSignedIn || !user) {
    return (
      <Button asChild variant="outline">
        <Link href="/sign-in">Sign In</Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        className="relative h-8 w-8 rounded-full"
        onClick={() => setOpen(true)}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage 
            src={user.imageUrl || undefined} 
            alt={user.fullName || user.username || ""}
            loading="eager"
          />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </Button>

      {open && (
        <Portal>
          <div 
            className={cn(
              "fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300",
              open ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={() => setOpen(false)}
            style={{ zIndex: 9999 }}
          />

          <div 
            className={cn(
              "fixed inset-y-0 right-0 h-full w-[280px] bg-white dark:bg-background p-6 shadow-lg transition-transform duration-300 ease-in-out border-l",
              open ? "translate-x-0" : "translate-x-full"
            )}
            style={{ zIndex: 10000 }}
          >
            <div className="flex flex-col h-full">
              <div className="flex flex-col items-end space-y-2 mb-6">
                <Avatar className="h-16 w-16">
                  <AvatarImage 
                    src={user.imageUrl || undefined} 
                    alt={user.fullName || user.username || ""}
                    loading="eager"
                  />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-end">
                  <p className="text-sm font-medium leading-none">{user.fullName || user.username}</p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="h-px bg-border my-4" />

              <nav className="flex flex-col space-y-4">
                <Link
                  href={`/profile/${user.username}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </Link>
                <Link
                  href="/profile/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>

                <div className="h-px bg-border my-2" />

                <button
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent w-full text-left"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </nav>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
} 