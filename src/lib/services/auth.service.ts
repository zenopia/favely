'use client';

import { useAuth as useClerkAuth, useClerk } from "@clerk/nextjs";
import { AuthUser } from "@/types/auth";
import React from 'react';

// Add cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
type CacheEntry = {
  data: AuthUser | null;
  timestamp: number;
};

// Global cache for client
const userCache = new Map<string, CacheEntry>();

// Global promise cache to prevent duplicate in-flight requests
const requestCache = new Map<string, Promise<AuthUser | null>>();

async function getCurrentUser(userId?: string | null): Promise<AuthUser | null> {
  if (!userId) return null;

  // Check memory cache first
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Check if there's an in-flight request
  const pendingRequest = requestCache.get(userId);
  if (pendingRequest) {
    return pendingRequest;
  }

  // Create new request promise
  const request = (async () => {
    try {
      const response = await fetch('/api/users/me', {
        cache: 'no-store'
      });
      const userData = response.ok ? await response.json() : null;

      // Update cache
      userCache.set(userId, { data: userData, timestamp: Date.now() });
      return userData;
    } finally {
      // Clean up request cache
      requestCache.delete(userId);
    }
  })();

  // Store the promise in the request cache
  requestCache.set(userId, request);
  return request;
}

// Custom hook for auth state
export function useAuth() {
  const clerk = useClerk();
  const { isSignedIn, isLoaded: clerkLoaded } = useClerkAuth();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      try {
        if (isSignedIn && clerk.session?.id) {
          const userData = await getCurrentUser(clerk.session.user?.id);
          if (mounted) setUser(userData);
        } else {
          if (mounted) setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    if (clerkLoaded) {
      fetchUser();
    }

    return () => {
      mounted = false;
    };
  }, [isSignedIn, clerkLoaded, clerk.session?.id, clerk.session?.user?.id]);

  const signOut = React.useCallback(async () => {
    try {
      await clerk.signOut();
      setUser(null);
      // Clear cache on sign out
      userCache.clear();
      requestCache.clear();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [clerk]);

  return {
    isSignedIn,
    isLoaded: clerkLoaded && !isLoading,
    user,
    signOut
  };
}

// Export the class for backward compatibility
export class AuthService {
  static getCurrentUser = getCurrentUser;
  static useAuth = useAuth;
}

// Client-side hooks
export function useAuthService() {
  const { isLoaded, isSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const clerk = useClerk();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);

  // Get token with retry logic
  const getToken = React.useCallback(async () => {
    try {
      if (!clerk.session) {
        console.warn("[Auth] No clerk session found");
        return null;
      }

      // Try to get token with persistence
      const getTokenWithPersistence = async () => {
        try {
          // First try to get the token directly
          const token = await clerk.session?.getToken();
          if (token) return token;

          // If no token, try to restore session
          await clerk.session?.touch();
          await new Promise(resolve => setTimeout(resolve, 100));
          return await clerk.session?.getToken();
        } catch (error) {
          console.warn('[Auth] Error getting token:', error);
          return null;
        }
      };

      let token = await getTokenWithPersistence();

      // If still no token and we're on mobile, try more aggressive recovery
      if (!token && typeof window !== 'undefined' && /Mobile|Android|iPhone/i.test(window.navigator.userAgent)) {
        try {
          await clerk.session?.end();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (clerk.session) {
            await clerk.session.touch();
            await new Promise(resolve => setTimeout(resolve, 100));
            token = await clerk.session.getToken();
          }
        } catch (error) {
          console.warn('[Auth] Error in mobile recovery:', error);
        }
      }

      return token;
    } catch (error) {
      console.error('[Auth] Error getting token:', error);
      return null;
    }
  }, [clerk.session]);

  // Fetch user data when signed in
  React.useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      if (!isSignedIn || !clerk.session?.id) {
        if (isMounted) {
          setUser(null);
          setIsInitialLoad(false);
        }
        return;
      }

      try {
        const userData = await getCurrentUser(clerk.session.user?.id);
        if (isMounted) {
          setUser(userData);
          setIsInitialLoad(false);
        }
      } catch (error) {
        console.error('[Auth] Error fetching user data:', error);
        if (isMounted) {
          setUser(null);
          setIsInitialLoad(false);
        }
      }
    };

    if (isLoaded) {
      fetchUser();
    }

    return () => {
      isMounted = false;
    };
  }, [isSignedIn, isLoaded, clerk.session]);

  // Clear cache on sign out
  const handleSignOut = React.useCallback(async () => {
    userCache.clear();
    requestCache.clear();
    setUser(null);
    await clerkSignOut();
  }, [clerkSignOut]);

  return {
    isSignedIn,
    isLoaded: isLoaded && !isInitialLoad,
    user,
    signOut: handleSignOut,
    getToken
  };
}

// Remove the duplicate useAuthService hook since it's redundant with useAuth 
