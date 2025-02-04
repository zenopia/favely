import { auth as getAuth } from "@clerk/nextjs/server";
import { useAuth as useClerkAuth, useClerk } from "@clerk/nextjs";
import { AuthUser } from "@/types/auth";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";
import type { ActiveSessionResource, TokenResource } from '@clerk/types';
import React from 'react';
import { headers } from 'next/headers';

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

    // Server-side: direct DB access
    try {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne({ clerkId: userId }).lean();
      
      if (!user) return null;
      
      return {
        id: user.clerkId,
        email: user.email || null,
        username: user.username,
        firstName: null,
        lastName: null,
        fullName: user.displayName,
        imageUrl: user.imageUrl,
      };
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  static async getUserByUsername(username: string): Promise<AuthUser | null> {
    try {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne({ username }).lean();
      
      if (!user) return null;
      
      return {
        id: user.clerkId,
        email: user.email || null,
        username: user.username,
        firstName: null, // We don't store these separately
        lastName: null,  // We don't store these separately
        fullName: user.displayName,
        imageUrl: user.imageUrl,
      };
    } catch (error) {
      console.error("Error getting user by username:", error);
      return null;
    }
  }

  static async getUserByClerkId(clerkId: string): Promise<AuthUser | null> {
    try {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne({ clerkId }).lean();
      
      if (!user) return null;
      
      return {
        id: user.clerkId,
        email: user.email || null,
        username: user.username,
        firstName: null, // We don't store these separately
        lastName: null,  // We don't store these separately
        fullName: user.displayName,
        imageUrl: user.imageUrl,
      };
    } catch (error) {
      console.error("Error getting user by clerk ID:", error);
      return null;
    }
  }

  static async getUserById(userId: string): Promise<AuthUser | null> {
    try {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne({ clerkId: userId }).lean();
      
      if (!user) return null;
      
      return {
        id: user.clerkId,
        email: user.email || null,
        username: user.username,
        firstName: null,
        lastName: null,
        fullName: user.displayName,
        imageUrl: user.imageUrl,
      };
    } catch (error) {
      console.error("Error getting user by ID:", error);
      return null;
    }
  }

  static async getUserByEmail(email: string): Promise<AuthUser | null> {
    try {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne({ email }).lean();
      
      if (!user) return null;
      
      return {
        id: user.clerkId,
        email: user.email || null,
        username: user.username,
        firstName: null,
        lastName: null,
        fullName: user.displayName,
        imageUrl: user.imageUrl,
      };
    } catch (error) {
      console.error("Error getting user by email:", error);
      return null;
    }
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
