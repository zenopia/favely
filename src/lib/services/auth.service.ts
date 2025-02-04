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

export class AuthService {
  static async getCurrentUser(userId?: string | null): Promise<AuthUser | null> {
    // If userId is not provided, try to get it from auth context
    if (!userId) {
      try {
        const { userId: authUserId } = getAuth();
        userId = authUserId;
      } catch (error) {
        // If getAuth fails, return null (this happens in client-side or non-app router contexts)
        return null;
      }
    }

    if (!userId) return null;

    // If we're in a browser environment, fetch through the API
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch('/api/users/me');
        if (!response.ok) return null;
        return response.json();
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
      
      return user ? transformUser(user) : null;
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
    const { isSignedIn, isLoaded } = useClerkAuth();
    const [user, setUser] = React.useState<AuthUser | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
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
          if (mounted) setLoading(false);
        }
      };

      if (isLoaded) {
        fetchUser();
      }

      return () => {
        mounted = false;
      };
    }, [isSignedIn, isLoaded, clerk.session?.id]);

    const signOut = React.useCallback(async () => {
      try {
        await clerk.signOut();
      } catch (error) {
        console.error('Error signing out:', error);
      }
    }, [clerk]);

    return {
      isSignedIn,
      isLoaded: isLoaded && !loading,
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

  // Fetch user data when signed in
  React.useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      if (!isSignedIn || !clerk.session?.id) return;

      try {
        const userData = await AuthService.getCurrentUser(clerk.session.user?.id);
        if (isMounted) {
          setUser(userData);
        }
      } catch (error) {
        console.error('[Auth] Error fetching user data:', error);
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [isSignedIn, clerk.session]);

  // Log state changes
  React.useEffect(() => {
    console.debug('[Auth] State changed:', {
      isLoaded,
      isSignedIn,
      hasUser: !!user,
      hasSession: !!clerk.session,
      sessionId: clerk.session?.id
    });
  }, [isLoaded, isSignedIn, user, clerk.session]);

  const getToken = async () => {
    try {
      console.debug('[Auth] Getting token, current state:', {
        hasSession: !!clerk.session,
        sessionId: clerk.session?.id,
        isSignedIn
      });

      if (!clerk.session) {
        console.warn("[Auth] No clerk session found");
        return null;
      }

      // Try to get token with persistence
      const getTokenWithPersistence = async () => {
        try {
          // First try to get the token directly
          const token = await clerk.session?.getToken();
          if (token) {
            console.debug('[Auth] Got token directly');
            return token;
          }

          console.debug('[Auth] No token, attempting to restore session...');
          await clerk.session?.touch();
          
          // Wait for session to be touched
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try to get token again
          const newToken = await clerk.session?.getToken();
          if (newToken) {
            console.debug('[Auth] Got token after session touch');
          }
          return newToken;
        } catch (error) {
          console.warn('[Auth] Error in getTokenWithPersistence:', error);
          return null;
        }
      };

      let token = await getTokenWithPersistence();

      // If still no token and we're on mobile, try more aggressive recovery
      if (!token && /Mobile|Android|iPhone/i.test(window.navigator.userAgent)) {
        console.debug('[Auth] Mobile browser detected, attempting aggressive session recovery...');
        
        try {
          // Try to force a new session
          await clerk.session?.end();
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try to get current session
          if (clerk.session) {
            try {
              console.debug('[Auth] Trying to restore session:', clerk.session.id);
              await clerk.session.touch();
              await new Promise(resolve => setTimeout(resolve, 500));
              token = await clerk.session.getToken();
              if (token) {
                console.debug('[Auth] Successfully recovered session:', clerk.session.id);
              }
            } catch (e) {
              console.warn('[Auth] Failed to restore session:', clerk.session.id, e);
            }
          }
        } catch (error) {
          console.warn('[Auth] Error in aggressive recovery:', error);
        }
      }

      return token;
    } catch (error) {
      console.error('[Auth] Error getting token:', error);
      return null;
    }
  };

  return {
    isLoaded,
    isSignedIn,
    user,
    getToken,
    signOut: clerkSignOut
  };
} 
