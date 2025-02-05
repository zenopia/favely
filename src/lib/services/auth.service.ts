import { auth as getAuth } from "@clerk/nextjs/server";
import { useAuth as useClerkAuth, useClerk } from "@clerk/nextjs";
import { AuthUser } from "@/types/auth";
import connectToMongoDB from "@/lib/db/mongodb";
import { getUserModel } from "@/lib/db/models-v2/user";
import type { ActiveSessionResource } from '@clerk/types';
import React from 'react';
import { headers } from 'next/headers';

// Define projection for user queries to only select needed fields
const USER_PROJECTION = {
  clerkId: 1,
  email: 1,
  username: 1,
  displayName: 1,
  imageUrl: 1,
  _id: 0
};

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 100; // ms

const withRetry = async <T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * INITIAL_RETRY_DELAY));
    }
  }
  throw new Error('Max retries reached');
};

const transformUser = (user: any): AuthUser => ({
  id: user.clerkId,
  email: user.email || null,
  username: user.username,
  firstName: null,
  lastName: null,
  fullName: user.displayName,
  imageUrl: user.imageUrl,
});

// Add cache configuration
const CACHE_TTL = 60 * 1000; // 1 minute
type CacheEntry = {
  data: AuthUser | null;
  timestamp: number;
};
const userCache = new Map<string, CacheEntry>();

export class AuthService {
  static async getCurrentUser(userId?: string | null): Promise<AuthUser | null> {
    // If userId is not provided, try to get it from auth context
    if (!userId) {
      try {
        // Only try to get auth on server side
        if (typeof window === 'undefined') {
          const { userId: authUserId } = getAuth();
          userId = authUserId;
        }
      } catch (error) {
        console.debug('Failed to get auth:', error);
        return null;
      }
    }

    if (!userId) return null;

    // Check cache first
    const cached = userCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // If we're in a browser environment, fetch through the API
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch('/api/users/me', {
          cache: 'no-store'
        });
        if (!response.ok) return null;
        const data = await response.json();
        // Update cache
        userCache.set(userId, { data, timestamp: Date.now() });
        return data;
      } catch (error) {
        console.error("Error fetching current user:", error);
        return null;
      }
    }

    // Server-side: direct DB access with retry
    return withRetry(async () => {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne(
        { clerkId: userId },
        USER_PROJECTION
      ).lean();
      
      const transformedUser = user ? transformUser(user) : null;
      // Update cache
      userCache.set(userId, { data: transformedUser, timestamp: Date.now() });
      return transformedUser;
    });
  }

  static async getUserByUsername(username: string): Promise<AuthUser | null> {
    return withRetry(async () => {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne(
        { username },
        USER_PROJECTION
      ).lean();
      
      return user ? transformUser(user) : null;
    });
  }

  static async getUserByClerkId(clerkId: string): Promise<AuthUser | null> {
    return withRetry(async () => {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne(
        { clerkId },
        USER_PROJECTION
      ).lean();
      
      return user ? transformUser(user) : null;
    });
  }

  static async getUserById(userId: string): Promise<AuthUser | null> {
    return withRetry(async () => {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne(
        { clerkId: userId },
        USER_PROJECTION
      ).lean();
      
      return user ? transformUser(user) : null;
    });
  }

  static async getUserByEmail(email: string): Promise<AuthUser | null> {
    return withRetry(async () => {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne(
        { email },
        USER_PROJECTION
      ).lean();
      
      return user ? transformUser(user) : null;
    });
  }

  static async getUsersByIds(userIds: string[]): Promise<AuthUser[]> {
    return withRetry(async () => {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const users = await UserModel.find(
        { clerkId: { $in: userIds } },
        USER_PROJECTION
      ).lean();
      
      return users.map(transformUser);
    });
  }

  // Hook for client-side auth state
  static useAuth() {
    const clerk = useClerk();
    const { isSignedIn, isLoaded: clerkLoaded } = useClerkAuth();
    const [user, setUser] = React.useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
      // Only run on the client side
      if (typeof window === 'undefined') return;

      let mounted = true;

      const fetchUser = async () => {
        try {
          if (isSignedIn && clerk.session?.id) {
            const response = await fetch('/api/users/me');
            if (!response.ok) throw new Error('Failed to fetch user');
            const userData = await response.json();
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
    }, [isSignedIn, clerkLoaded, clerk.session?.id]);

    const signOut = React.useCallback(async () => {
      try {
        await clerk.signOut();
        setUser(null);
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
}

// Client-side hooks
export function useAuthService() {
  const { isLoaded, isSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const clerk = useClerk();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);

  // Cache user data in memory
  const userCache = React.useRef<{
    id: string;
    data: AuthUser;
    timestamp: number;
  } | null>(null);

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
        // Check cache first
        if (userCache.current && 
            userCache.current.id === clerk.session.user?.id &&
            Date.now() - userCache.current.timestamp < 5 * 60 * 1000) { // 5 minutes cache
          if (isMounted) {
            setUser(userCache.current.data);
            setIsInitialLoad(false);
          }
          return;
        }

        const userData = await AuthService.getCurrentUser(clerk.session.user?.id);
        if (isMounted) {
          setUser(userData);
          setIsInitialLoad(false);
          
          // Update cache
          if (userData) {
            userCache.current = {
              id: clerk.session.user?.id as string,
              data: userData,
              timestamp: Date.now()
            };
          }
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
    userCache.current = null;
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
