"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useAuthService } from "@/lib/services/auth.service";

export function CreateListFAB() {
  const router = useRouter();
  const { isSignedIn } = useAuthGuard();
  const { user } = useAuthService();

  const handleClick = () => {
    if (!isSignedIn) {
      const returnUrl = encodeURIComponent('/profile/lists/create');
      router.push(`/sign-in?returnUrl=${returnUrl}`);
      return;
    }

    if (!user?.username) return;
    router.push(`/profile/lists/create`);
  };

  return (
    <Button
      size="lg"
      onClick={handleClick}
      className="fixed bottom-20 right-4 z-[60] sm:bottom-8 sm:right-8 h-14 px-6 shadow-lg flex items-center gap-2 fab-button"
    >
      <Plus className="h-5 w-5" />
      <span>Create list</span>
    </Button>
  );
} 