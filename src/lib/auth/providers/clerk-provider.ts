import { auth as getAuth } from "@clerk/nextjs/server";
import { clerkClient as createClerkClient } from "@clerk/nextjs/server";
import type { User } from "@clerk/backend";
import { AuthUser } from "@/types/auth";
import { BaseAuthProvider } from "../base-provider";
import { AuthResult } from "../types";

// Get the client instance
const clerkClient = createClerkClient();

export class ClerkAuthProvider extends BaseAuthProvider {
  async getCurrentUser(): Promise<AuthUser | null> {
    const { userId } = getAuth();
    if (!userId) return null;

    try {
      const user = await this.getClerkUser();
      if (!user) return null;
      
      return this.transformClerkUser(user);
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  async getToken(): Promise<string | null> {
    try {
      const { getToken } = getAuth();
      return await getToken();
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }

  // These methods should not be called directly from the provider
  // They should be accessed through the useAuth hook on the client side
  async signIn(): Promise<void> {
    throw new Error('signIn must be called from the client side using the useAuth hook');
  }

  async signUp(): Promise<void> {
    throw new Error('signUp must be called from the client side using the useAuth hook');
  }

  async signOut(): Promise<void> {
    throw new Error('signOut must be called from the client side using the useAuth hook');
  }

  async validateSession(): Promise<AuthResult> {
    const { userId, sessionId } = getAuth();
    
    return {
      isAuthenticated: !!userId,
      userId: userId || undefined,
      sessionId: sessionId || undefined
    };
  }

  async getSessionState(): Promise<{
    isLoaded: boolean;
    isSignedIn: boolean;
    user: AuthUser | null;
  }> {
    // This should only be called server-side
    const { userId } = getAuth();
    const user = userId ? await this.getCurrentUser() : null;
    
    return {
      isLoaded: true,
      isSignedIn: !!userId,
      user
    };
  }

  async handleApiAuth(request: Request): Promise<AuthResult> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Check if the path is public
    if (this.isPublicApiPath(path)) {
      return { isAuthenticated: true };
    }

    // Get auth state from Clerk
    const { userId, sessionId } = getAuth();

    if (!userId) {
      return {
        isAuthenticated: false,
        error: 'Unauthorized'
      };
    }

    return {
      isAuthenticated: true,
      userId,
      sessionId
    };
  }

  private transformClerkUser(user: User): AuthUser {
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

  private async getClerkUser(): Promise<User | null> {
    const { userId } = getAuth();
    if (!userId) return null;
    
    try {
      return await clerkClient.users.getUser(userId);
    } catch (error) {
      console.error("Error fetching Clerk user:", error);
      return null;
    }
  }
} 