import { useAuth as useClerkAuth, useUser, useClerk } from "@clerk/nextjs";
import type { User } from "@clerk/backend";
import { AuthUser } from "@/types/auth";

/**
 * Transform a Clerk user to our AuthUser type
 */
function transformClerkUser(user: User): AuthUser {
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

/**
 * Hook for client-side auth functionality
 */
export function useAuth() {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();

  const signIn = async (returnUrl?: string) => {
    await clerk.redirectToSignIn({ 
      signInFallbackRedirectUrl: returnUrl || '/'
    });
  };

  const signUp = async (returnUrl?: string) => {
    await clerk.redirectToSignUp({ 
      signUpFallbackRedirectUrl: returnUrl || '/'
    });
  };

  const signOut = async () => {
    await clerk.signOut();
  };

  const getToken = async () => {
    return await clerk.session?.getToken() || null;
  };

  return {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    user: clerkUser ? transformClerkUser(clerkUser as unknown as User) : null,
    signIn,
    signUp,
    signOut,
    getToken,
  };
} 