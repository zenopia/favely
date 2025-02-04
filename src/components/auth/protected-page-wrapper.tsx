"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { SubLayout } from "@/components/layout/sub-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useAuthService } from "@/lib/services/auth.service";

interface ProtectedPageWrapperProps {
  children: React.ReactNode;
  initialUser: {
    id: string;
    username: string | null;
    fullName: string | null;
    imageUrl: string;
  };
  layoutType?: "main" | "sub";
  title?: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-full" />
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ProtectedPageWrapper({ 
  children, 
  initialUser,
  layoutType = "main",
  title
}: ProtectedPageWrapperProps) {
  const { isLoaded, isSignedIn, user, getToken } = useAuthService();
  const [shouldShowSkeleton, setShouldShowSkeleton] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const router = useRouter();
  const clerk = useClerk();

  // Validate session token
  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout;

    const validateSession = async () => {
      try {
        if (!isLoaded || !isSignedIn || !user) {
          if (mounted) {
            setIsValidated(false);
          }
          return;
        }

        // Special handling for mobile browsers
        const isMobile = typeof window !== 'undefined' && 
          /Mobile|Android|iPhone/i.test(window.navigator.userAgent);

        // Get token with retries for mobile
        let token = null;
        let retryCount = 0;
        const maxRetries = 3;

        const tryGetToken = async () => {
          try {
            // Try to get a fresh session first
            if (isMobile && clerk.session) {
              await clerk.session.touch();
              // Small delay to allow session update
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            token = await getToken();
            
            if (!token && retryCount < maxRetries) {
              retryCount++;
              // Exponential backoff
              const delay = Math.min(100 * Math.pow(2, retryCount), 1000);
              retryTimeout = setTimeout(tryGetToken, delay);
              return;
            }

            if (!token) {
              // Store current path for return after sign in
              if (typeof window !== 'undefined' && window.location.pathname !== '/' && !window.location.pathname.startsWith('/sign-in')) {
                sessionStorage.setItem('returnUrl', window.location.pathname);
              }

              // For mobile browsers, try to force a new sign-in session
              if (isMobile) {
                try {
                  // Remove the current session
                  await clerk.session?.remove();
                  // Open sign-in with the current URL as return URL
                  const returnUrl = window.location.pathname;
                  await clerk.openSignIn({
                    redirectUrl: returnUrl,
                    appearance: {
                      variables: {
                        colorPrimary: '#0F172A',
                      }
                    }
                  });
                  return;
                } catch (e) {
                  console.warn('Failed to handle mobile sign-in:', e);
                }
              }

              router.push('/sign-in');
              return;
            }

            // Verify user matches
            if (user.id !== initialUser.id) {
              console.warn('User mismatch, redirecting to sign in');
              if (typeof window !== 'undefined' && window.location.pathname !== '/' && !window.location.pathname.startsWith('/sign-in')) {
                sessionStorage.setItem('returnUrl', window.location.pathname);
              }
              router.push('/sign-in');
              return;
            }

            if (mounted) {
              setIsValidated(true);
            }
          } catch (error) {
            console.error('Token fetch failed:', error);
            if (retryCount < maxRetries) {
              retryCount++;
              // Exponential backoff
              const delay = Math.min(100 * Math.pow(2, retryCount), 1000);
              retryTimeout = setTimeout(tryGetToken, delay);
            } else {
              throw error;
            }
          }
        };

        await tryGetToken();
      } catch (error) {
        console.error('Session validation failed:', error);
        if (mounted) {
          // Store return URL before redirecting
          if (typeof window !== 'undefined' && window.location.pathname !== '/' && !window.location.pathname.startsWith('/sign-in')) {
            sessionStorage.setItem('returnUrl', window.location.pathname);
          }
          router.push('/sign-in');
        }
      }
    };

    validateSession();

    return () => {
      mounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [isLoaded, isSignedIn, user, initialUser.id, router, getToken, clerk]);

  // Only show skeleton after a delay if still loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoaded || !isValidated) {
        setShouldShowSkeleton(true);
      }
    }, 200); // Small delay to prevent flash

    return () => clearTimeout(timer);
  }, [isLoaded, isValidated]);

  // Show nothing during initial load to prevent flash
  if (!isLoaded || !isValidated) {
    if (!shouldShowSkeleton) {
      return null;
    }
    return layoutType === "main" ? (
      <MainLayout>
        <LoadingSkeleton />
      </MainLayout>
    ) : (
      <SubLayout title={title || ""}>
        <LoadingSkeleton />
      </SubLayout>
    );
  }

  return layoutType === "main" ? (
    <MainLayout>
      {children}
    </MainLayout>
  ) : (
    <SubLayout title={title || ""}>
      {children}
    </SubLayout>
  );
} 