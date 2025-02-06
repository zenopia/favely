"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare } from "lucide-react";

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/collab', '/my-lists', '/pinned'];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isSignIn = pathname === "/sign-in";
  const currentUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
  const fallbackRedirectUrl = searchParams.get("fallbackRedirectUrl");

  const handleBack = () => {
    // If we have history and we're not at the first page
    if (window.history.length > 2) {
      router.back();
    } else if (fallbackRedirectUrl) {
      // If we have a fallbackRedirectUrl but no history
      const isProtectedRoute = PROTECTED_ROUTES.some(route => 
        decodeURIComponent(fallbackRedirectUrl).startsWith(route)
      );

      if (isProtectedRoute) {
        router.push('/');
      } else {
        router.push(decodeURIComponent(fallbackRedirectUrl));
      }
    } else {
      // Fallback to homepage
      router.push('/');
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Sub-nav */}
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
          <h1 className="text-lg font-semibold">
            {isSignIn ? "Sign In" : "Sign Up"}
          </h1>
        </div>
        <Link href={`/feedback?from=${encodeURIComponent(currentUrl)}`}>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        {children}
      </div>

      {/* Bottom link */}
      <div className="sticky bottom-0 border-t bg-muted/50 backdrop-blur-sm">
        <div className="flex justify-center p-4">
          <p className="text-sm text-muted-foreground">
            {isSignIn ? "Don't have an account? " : "Already have an account? "}
            <Link
              href={`${isSignIn ? "/sign-up" : "/sign-in"}${fallbackRedirectUrl ? `?fallbackRedirectUrl=${fallbackRedirectUrl}` : ''}`}
              className="font-medium text-primary hover:underline"
            >
              {isSignIn ? "Sign up" : "Sign in"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 