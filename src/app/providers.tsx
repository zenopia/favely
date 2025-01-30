'use client';

import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/contexts/auth.context";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
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