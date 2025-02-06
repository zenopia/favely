"use client";

import { ArrowLeft, MessageSquare } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Sidebar } from "@/components/layout/nav/sidebar";

function FeedbackButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

  return (
    <Link href={`/feedback?from=${encodeURIComponent(currentUrl)}`}>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
      >
        <MessageSquare className="h-4 w-4" />
      </Button>
    </Link>
  );
}

export interface SubLayoutProps {
  children?: React.ReactNode;
  title?: string;
  subtext?: string;
  hideBottomNav?: boolean;
  action?: {
    label: string;
    href: string;
  };
}

export function SubLayout({ children, title = "Page", action }: SubLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleBack = () => {
    const from = searchParams.get('from');
    
    // If we're on a sign-in or sign-up page
    if (pathname.includes('/sign-in') || pathname.includes('/sign-up')) {
      router.back();
      return;
    }

    // If we're on the feedback page and have a from parameter
    if (pathname === '/feedback' && from) {
      router.push(decodeURIComponent(from));
      return;
    }

    // If we're on the edit page, just use browser history
    if (pathname.includes('/profile/lists/edit/')) {
      router.back();
      return;
    }

    // If we're on a following/followers page
    if (pathname.includes('/following') || pathname.includes('/followers')) {
      // Extract the username from the path segments
      const pathSegments = pathname.split('/');
      const username = pathSegments[2]; // profile/[username]/following or followers
      // Go to the user's profile with the from parameter preserved if it exists
      router.push(`/profile/${username}${from ? `?from=${from}` : ''}`);
    } 
    // If we're on a profile page
    else if (pathname.startsWith('/profile/') || pathname.startsWith('/profile/@')) {
      if (from) {
        // Ensure the from parameter starts with a slash
        const decodedPath = decodeURIComponent(from);
        const path = decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
        router.push(path);
      } else {
        // If no from parameter, go to the lists page
        router.push('/lists');
      }
    }
    // For any other page
    else {
      router.back();
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between h-14 px-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {title && (
            <div>
              <h1 className="text-lg font-semibold leading-tight">{title} <FeedbackButton /></h1>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {action && (
            <Link href={action.href}>
              <Button variant="outline" size="sm">
                {action.label}
              </Button>
            </Link>
          )}
          
        </div>
      </div>
      <div className="flex flex-1">
        <Sidebar className="hidden md:flex" />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
} 