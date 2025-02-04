import { auth as getAuth } from "@clerk/nextjs/server";
import { useAuth as useClerkAuth, useUser, useClerk } from "@clerk/nextjs";
import type { User } from "@clerk/backend";
import { AuthUser } from "@/types/auth";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";
import type { ActiveSessionResource, TokenResource } from '@clerk/types';
import React from 'react';
import { clerkClient } from "@clerk/clerk-sdk-node";

export class AuthService {
  static async getCurrentUser(): Promise<AuthUser | null> {
    const { userId } = getAuth();
    if (!userId) return null;

    try {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne({ clerkId: userId }).lean();
      
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
      
      if (!user) {
        // Try to get user from Clerk as fallback
        const clerkUser = await clerkClient.users.getUser(userId);
        if (!clerkUser) return null;
        
        return this.transformClerkUser(clerkUser);
      }
      
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
      
      if (!user) {
        // Try to get user from Clerk as fallback
        const users = await clerkClient.users.getUserList({
          emailAddress: [email]
        });
        if (users.length === 0) return null;
        
        return this.transformClerkUser(users[0]);
      }
      
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

  static transformClerkUser(user: { 
    id: string; 
    emailAddresses?: { emailAddress: string }[]; 
    username?: string | null; 
    firstName?: string | null; 
    lastName?: string | null; 
    imageUrl?: string | null; 
  }): AuthUser {
    return {
      id: user.id,
      email: user.emailAddresses?.[0]?.emailAddress || null,
      username: user.username || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || null,
      imageUrl: user.imageUrl || null,
    };
  }
}

// Client-side hooks
export function useAuthService() {
  const { isLoaded, isSignedIn: clerkIsSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();

  const user = clerkUser ? AuthService.transformClerkUser(clerkUser as unknown as User) : null;
  const isSignedIn = clerkIsSignedIn ?? false;

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

          // If still no token, try to sign in again
          if (!token) {
            console.debug('[Auth] No valid session found, redirecting to sign in');
            await clerk.openSignIn({
              redirectUrl: window.location.href,
              appearance: {
                variables: {
                  colorPrimary: '#0F172A',
                }
              }
            });
          }
        } catch (error) {
          console.warn('[Auth] Aggressive session recovery failed:', error);
        }
      }

      // If we still don't have a token, try one last session refresh
      if (!token) {
        try {
          console.debug('[Auth] Final attempt to refresh session');
          await clerk.session?.touch();
          token = await clerk.session?.getToken();
          if (token) {
            console.debug('[Auth] Got token after final refresh');
          }
        } catch (error) {
          console.warn('[Auth] Final session refresh failed:', error);
        }
      }

      return token;
    } catch (error) {
      console.error("[Auth] Error getting token:", error);
      return null;
    }
  };

  const handleSignIn = async (returnUrl?: string) => {
    try {
      console.debug('[Auth] Starting sign in process');
      // Store the current URL for return after sign in
      if (typeof window !== 'undefined' && returnUrl) {
        sessionStorage.setItem('returnUrl', returnUrl);
        console.debug('[Auth] Stored return URL:', returnUrl);
      }

      // Special handling for mobile browsers
      const isMobile = typeof window !== 'undefined' && 
        /Mobile|Android|iPhone/i.test(window.navigator.userAgent);

      if (isMobile && clerk.session) {
        console.debug('[Auth] Mobile browser detected, cleaning up session');
        try {
          await clerk.session.end();
        } catch (e) {
          console.warn('[Auth] Error cleaning up session:', e);
        }
      }

      const storedReturnUrl = typeof window !== 'undefined' ? 
        sessionStorage.getItem('returnUrl') : null;
      const finalReturnUrl = returnUrl || storedReturnUrl || "/";
      console.debug('[Auth] Final return URL:', finalReturnUrl);

      // Clear stored return URL
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('returnUrl');
      }

      console.debug('[Auth] Opening sign in modal');
      await clerk.openSignIn({
        redirectUrl: finalReturnUrl,
        appearance: {
          variables: {
            colorPrimary: '#0F172A',
          }
        }
      });
    } catch (error) {
      console.error("[Auth] Sign in error:", error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      console.debug('[Auth] Starting sign out process');
      // End current session to ensure clean state
      if (clerk.session) {
        console.debug('[Auth] Ending session:', clerk.session.id);
        await clerk.session.end();
      }
      
      // Perform the sign out
      await clerkSignOut();
      console.debug('[Auth] Signed out successfully');
      
      // Force a page reload to ensure clean state
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error("[Auth] Sign out error:", error);
      // Force a reload anyway to ensure clean state
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  return {
    isLoaded,
    isSignedIn,
    user,
    signIn: handleSignIn,
    signOut: handleSignOut,
    getToken,
  };
} 
