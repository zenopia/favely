'use client';

import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/contexts/auth.context";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  }

  // Ensure we're not using development keys in production
  if (process.env.NODE_ENV === 'production' && 
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_test_')) {
    console.error('Warning: Using Clerk development keys in production environment');
  }

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        elements: {
          footer: "hidden",
        }
      }}
    >
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </ClerkProvider>
  );
} 