"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { SubLayout } from "@/components/layout/sub-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useAuthService } from "@/lib/services/auth.service";

interface ProtectedPageWrapperProps {
  children: React.ReactNode;
  initialUser: {
    id: string;
    username: string | null;
    fullName: string | null;
    imageUrl: string;
  };
  layoutType?: "main" | "sub";
  title?: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-full" />
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ProtectedPageWrapper({ 
  children, 
  initialUser,
  layoutType = "main",
  title
}: ProtectedPageWrapperProps) {
  const { isLoaded, isSignedIn, user, getToken } = useAuthService();
  const [shouldShowSkeleton, setShouldShowSkeleton] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const router = useRouter();
  const clerk = useClerk();

  // Validate session token
  useEffect(() => {
    let mounted = true;

    const validateSession = async () => {
      try {
        // If we have initial data, we don't need to show a skeleton
        if (initialUser) {
          setIsValidating(false);
          return;
        }

        if (!isLoaded || !isSignedIn) {
          return;
        }

        const token = await getToken();
        if (!token && mounted) {
          router.push('/sign-in');
          return;
        }

        if (mounted) {
          setIsValidating(false);
        }
      } catch (error) {
        console.error('Error validating session:', error);
        if (mounted) {
          router.push('/sign-in');
        }
      }
    };

    validateSession();

    return () => {
      mounted = false;
    };
  }, [isLoaded, isSignedIn, router, getToken, initialUser]);

  // Only show skeleton after a delay if still validating and no initial data
  useEffect(() => {
    if (!isValidating || initialUser) {
      return;
    }

    const timer = setTimeout(() => {
      if (isValidating && !initialUser) {
        setShouldShowSkeleton(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isValidating, initialUser]);

  if (!shouldShowSkeleton && isValidating && !initialUser) {
    return null;
  }

  if (shouldShowSkeleton && !initialUser) {
    return layoutType === "main" ? (
      <MainLayout>
        <LoadingSkeleton />
      </MainLayout>
    ) : (
      <SubLayout>
        <LoadingSkeleton />
      </SubLayout>
    );
  }

  return layoutType === "main" ? (
    <MainLayout>
      {children}
    </MainLayout>
  ) : (
    <SubLayout title={title || ""}>
      {children}
    </SubLayout>
  );
} 