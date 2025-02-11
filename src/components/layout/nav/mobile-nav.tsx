"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Portal } from "@radix-ui/react-portal";
import { 
  Menu,
  Home,
  ListChecks,
  Users2,
  UserPlus,
  MessageSquare,
  Info,
  Pin,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthService } from "@/lib/services/auth.service";
import type { NavItem } from "@/types/nav";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";

// Additional nav items only for mobile
const mobileOnlyNavItems: NavItem[] = [
  {
    title: "All Lists",
    href: "/",
    public: true,
    icon: Home,
    description: "Return to homepage"
  },
];

const navItems: NavItem[] = [
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
  }
];

function FeedbackButton({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

  return (
    <Link
      href={`/feedback?from=${encodeURIComponent(currentUrl)}`}
      onClick={onClose}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent text-muted-foreground"
    >
      <MessageSquare className="h-4 w-4" aria-hidden="true" />
      <span>Feedback</span>
    </Link>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [followingItems, setFollowingItems] = useState<NavItem[]>([]);
  const { user, isSignedIn } = useAuthService();

  const handleClose = () => setOpen(false);

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
          icon: Plus,
          description: "Create a new list",
          primary: true
        }
      ]);
    } else {
      setFollowingItems([]);
    }
  }, [isSignedIn, user?.username]);

  const renderNavLink = (item: NavItem, index: number) => {
    const Icon = item.icon;
    return (
      <Link
        key={`${item.href}-${index}`}
        href={item.href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          item.primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-accent",
          item.indent && "ml-4"
        )}
        aria-label={item.description}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{item.title}</span>
      </Link>
    );
  };

  return (
    <>
      <Button
        variant="ghost"
        className="md:hidden"
        aria-label="Open navigation menu"
        size="icon"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>

      <Portal>
        {/* Backdrop */}
        <div 
          className={cn(
            "fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={handleClose}
          style={{ zIndex: 9999 }}
        />

        {/* Navigation Menu */}
        <div 
          className={cn(
            "fixed inset-y-0 left-0 h-full w-[280px] bg-white dark:bg-background p-6 shadow-lg transition-transform duration-300 ease-in-out border-r",
            open ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ zIndex: 10000 }}
        >
          <div className="flex flex-col h-full">
            <div className="flex justify-left mb-6">
              <div className="flex flex-col items-start">
                <Image
                  src="/Favely-logo.svg"
                  alt="Favely"
                  className="h-[30px] w-[120px]"
                  width={120}
                  height={30}
                  priority
                />
                <span className="text-[10px] font-semibold tracking-wider text-[#801CCC] bg-[#801CCC]/10 px-2 py-0.5 rounded-full mt-1">BETA</span>
              </div>
            </div>

            {isSignedIn && (
              <div className="h-px bg-border my-4" />
            )}

            <nav 
              className="flex flex-col space-y-4 overflow-y-auto flex-1"
              aria-label="Mobile navigation"
            >
              {mobileOnlyNavItems.map((item, index) =>
                ((item.public || isSignedIn) || (!isSignedIn && item.showWhenSignedOut)) && renderNavLink(item, index)
              )}
              {isSignedIn && [...navItems, ...followingItems].map((item, index) => renderNavLink(item, index))}
              
              {!isSignedIn && (
                <>
                  <Link
                    href="/sign-in"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    <span>Sign In</span>
                  </Link>
                  <Link
                    href="/sign-up"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    <span>Sign Up</span>
                  </Link>
                </>
              )}
            </nav>

            {/* About and Feedback links at bottom */}
            <div className="mt-auto pt-4 border-t">
              <Link
                href="/about"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent text-muted-foreground"
              >
                <Info className="h-4 w-4" aria-hidden="true" />
                <span>About</span>
              </Link>
              <FeedbackButton onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      </Portal>
    </>
  );
} 