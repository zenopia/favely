"use client";

import { Button } from "@/components/ui/button";
import { Share2, Pin, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import { useAuthService } from "@/lib/services/auth.service";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ListActionBarProps {
  listId: string;
  isPinned: boolean;
  onPinChange: (isPinned: boolean) => void;
}

export default function ListActionBar({ 
  listId, 
  isPinned, 
  onPinChange,
}: ListActionBarProps) {
  const router = useRouter();
  const { user } = useAuthService();
  const [isPinning, setIsPinning] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const handleShare = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      toast.success("List URL copied to clipboard");
    } catch (error) {
      console.error("Failed to copy URL:", error);
      toast.error("Failed to copy URL to clipboard");
    }
  };

  const handlePin = async () => {
    if (!user) {
      router.push(`/sign-in?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    try {
      setIsPinning(true);
      const response = await fetch(`/api/lists/${listId}/pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ pinned: !isPinned })
      });

      if (!response.ok) {
        if (response.headers.get("content-type")?.includes("application/json")) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update pin");
        }
        throw new Error("Failed to update pin");
      }

      onPinChange?.(!isPinned);
      toast.success(isPinned ? "List unpinned" : "List pinned");
    } catch (error) {
      console.error("Failed to update pin:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update pin");
    } finally {
      setIsPinning(false);
    }
  };

  const handleCopy = async () => {
    if (!user) {
      router.push(`/sign-in?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    try {
      setIsCopying(true);
      const response = await fetch(`/api/lists/${listId}/copy`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Failed to copy list");
      }

      const data = await response.json();
      toast.success("List copied successfully");
      router.push(`/profile/lists/edit/${data.list.id}`);
    } catch (error) {
      console.error("Failed to copy list:", error);
      toast.error(error instanceof Error ? error.message : "Failed to copy list");
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Share list</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isPinned ? "default" : "outline"}
              size="icon"
              onClick={handlePin}
              disabled={isPinning}
            >
              <Pin className={`h-4 w-4 ${isPinned ? "fill-current" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isPinned ? "Unpin list" : "Pin list"}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              disabled={isCopying}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy list</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
} 