import { useAuth } from "@/contexts/auth.context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface UseAuthGuardProps {
  protected?: boolean;
  redirectIfAuthed?: boolean;
}

export function useAuthGuard({ protected: isProtected = false, redirectIfAuthed = false }: UseAuthGuardProps = {}) {
  const { isLoaded, isSignedIn, getToken, user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Auth pages should be immediately ready
  const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  
  useEffect(() => {
    let mounted = true;
    
    const validateSession = async () => {
      try {
        // Skip validation for auth pages
        if (isAuthPage) {
          if (mounted) {
            setIsValidating(false);
            setIsReady(true);
          }
          return;
        }

        // Reset ready state when session changes
        if (!isLoaded) {
          if (mounted) {
            setIsReady(false);
            setIsValidating(true);
          }
          return;
        }

        // Only redirect to home if this is a protected route
        if (isProtected && isLoaded && !isSignedIn && !isAuthPage && !user) {
          router.push('/');
          return;
        }

        // For non-protected routes, we're ready if the auth state is loaded
        if (!isProtected) {
          if (mounted) {
            setIsValidating(false);
            setIsReady(true);
          }
          return;
        }

        // Reset ready state when session changes on protected routes
        if (!user && isProtected) {
          if (mounted) {
            setIsReady(false);
            setIsValidating(true);
          }
          return;
        }

        // Special handling for mobile browsers
        const isMobile = typeof window !== 'undefined' && 
          /Mobile|Android|iPhone/i.test(window.navigator.userAgent);

        // Validate token with retries for mobile
        let token = null;
        if (isMobile) {
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            token = await getToken();
            if (token) break;
            
            // Wait before retry with exponential backoff
            await new Promise(resolve => 
              setTimeout(resolve, Math.min(100 * Math.pow(2, retryCount), 1000))
            );
            retryCount++;
          }
        } else {
          token = await getToken();
        }
        
        if (mounted) {
          setIsValidating(false);
          
          if (isProtected && !token) {
            // Store current path for return after sign in
            if (typeof window !== 'undefined' && pathname !== '/' && !pathname.startsWith('/sign-in')) {
              const returnUrl = encodeURIComponent(pathname);
              router.push(`/sign-in?fallbackRedirectUrl=${returnUrl}`);
            } else {
              router.push('/sign-in');
            }
            return;
          }

          if (redirectIfAuthed && token) {
            // Get stored return URL if available
            const returnUrl = typeof window !== 'undefined' ? 
              sessionStorage.getItem('returnUrl') : null;
            
            // Redirect to stored URL or home
            router.push(returnUrl || '/');
            return;
          }

          // Only set ready if we have a valid token or it's not required
          setIsReady(!isProtected || !!token);
        }
      } catch (error) {
        console.error('Auth validation failed:', error);
        if (mounted) {
          setIsValidating(false);
          setIsReady(false);
          if (isProtected) {
            // Store current path for return after sign in
            if (typeof window !== 'undefined' && pathname !== '/' && !pathname.startsWith('/sign-in')) {
              sessionStorage.setItem('returnUrl', pathname);
            }
            router.push('/sign-in');
          }
        }
      }
    };

    validateSession();

    return () => {
      mounted = false;
    };
  }, [isLoaded, isSignedIn, user, isProtected, redirectIfAuthed, pathname, router, getToken, isAuthPage]);

  return {
    isReady: isAuthPage || (isLoaded && isReady && !isValidating),
    isSignedIn,
    isLoaded,
    getToken
  };
} 