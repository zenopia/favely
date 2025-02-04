"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ListChecks,
  Users2,
  UserPlus,
  PlusCircle,
  ListIcon,
  MessageSquare,
  InfoIcon,
  Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NavItem } from "@/types/nav";
import { useAuthService } from "@/lib/services/auth.service";

const menuItems: NavItem[] = [
  {
    title: "Lists",
    href: "/",
    public: true,
    icon: ListIcon,
    description: "All lists",
    id: "lists"
  },
  {
    title: "My Lists",
    href: "/profile/lists",
    public: false,
    icon: ListChecks,
    description: "View your created lists",
    indent: true
  },
  {
    title: "Pinned Lists",
    href: "/profile/lists/pinned",
    public: false,
    icon: Pin,
    description: "View your pinned lists",
    indent: true
  },
  {
    title: "Collab",
    href: "/profile/lists/collab",
    public: false,
    icon: Users2,
    description: "View collaborative lists",
    indent: true
  },
  {
    title: "About",
    href: "/about",
    public: true,
    icon: InfoIcon,
    description: "About RankShare"
  },
  {
    title: "Feedback",
    href: "/feedback",
    public: true,
    icon: MessageSquare,
    description: "Send us feedback"
  }
];

interface SidebarProps {
  className?: string;
  isMobile?: boolean;
}

export function Sidebar({ className, isMobile = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [followingItems, setFollowingItems] = useState<NavItem[]>([]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
  const { user, isSignedIn } = useAuthService();

  useEffect(() => {
    if (isSignedIn && user?.username) {
      setFollowingItems([
        {
          title: "Following",
          href: `/profile/${user.username}/following`,
          public: false,
          icon: Users2,
          description: "Users you follow",
          id: "following"
        },
        {
          title: "Followers",
          href: `/profile/${user.username}/followers`,
          public: false,
          icon: UserPlus,
          description: "Users following you"
        },
        {
          title: "Create List",
          href: "/profile/lists/create",
          public: false,
          icon: PlusCircle,
          description: "Create a new list",
          primary: true
        }
      ]);
    } else {
      setFollowingItems([]);
    }
  }, [isSignedIn, user?.username]);

  return (
    <div
      className={cn(
        "flex h-[calc(100vh-64px)] flex-col border-r bg-background transition-all duration-300",
        isMobile ? "w-full" : collapsed ? "w-16" : "w-64",
        className
      )}
      role="navigation"
    >
      <div className="flex flex-col h-full min-h-0">
        {!isMobile && (
          <div className="flex h-14 items-center justify-between px-4 border-b shrink-0">
            {!collapsed && <span className="text-sm font-semibold">Menu</span>}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", collapsed && "w-full")}
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 transition-all",
                  collapsed && "rotate-180"
                )}
              />
            </Button>
          </div>
        )}

        <div className="flex-1 space-y-1 p-2 overflow-y-auto min-h-0">
          {[...menuItems, ...followingItems]
            .filter(item => item.title !== 'Feedback' && item.title !== 'About')
            .map((item, index) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent hover:text-accent-foreground",
                    isActive ? "bg-accent text-accent-foreground" : item.primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground",
                    item.indent && !collapsed && "ml-4"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {!collapsed && (
                    <span className="truncate">{item.title}</span>
                  )}
                </Link>
              );
            })}
        </div>

        <div className="p-2 border-t shrink-0 space-y-1">
          {menuItems
            .filter(item => item.title === 'About' || item.title === 'Feedback')
            .sort((a, _b) => a.title === 'About' ? -1 : 1)
            .map((item, index) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={index}
                  href={item.title === 'Feedback' ? `/feedback?from=${encodeURIComponent(currentUrl)}` : item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent hover:text-accent-foreground",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {!collapsed && (
                    <span className="truncate">{item.title}</span>
                  )}
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
} 