"use client"

import { ArrowLeft, UserPlus, MessageSquare } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useAuthService } from "@/lib/services/auth.service"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useUsers } from "@/hooks/use-users"
import { ListCollaborator } from "@/types/list"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger,
  TooltipProvider 
} from "@/components/ui/tooltip"
import Link from "next/link"

interface ListViewNavProps {
  returnPath?: string;
  title: string;
  onCollaboratorsClick?: () => void;
  showCollaborators?: boolean;
  isOwner?: boolean;
  isCollaborator?: boolean;
  collaborators?: ListCollaborator[];
}

function FeedbackButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

  return (
    <Link href={`/feedback?from=${encodeURIComponent(currentUrl)}`}>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
      >
        <MessageSquare className="h-4 w-4" />
      </Button>
    </Link>
  );
}

export function ListViewNav({ 
  returnPath, 
  title,
  onCollaboratorsClick,
  showCollaborators,
  isOwner,
  isCollaborator,
  collaborators = []
}: ListViewNavProps) {
  const router = useRouter();
  const { user, isSignedIn } = useAuthService();
  const acceptedCollaborators = collaborators.filter(c => c.status === 'accepted');
  const { data: userData } = useUsers(acceptedCollaborators.map(c => c.clerkId).filter((id): id is string => !!id));

  const handleBack = () => {
    if (returnPath) {
      router.push(returnPath);
    } else {
      router.back();
    }
  };

  return (
    <div className="flex items-center justify-between h-14 px-4 border-b">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="mr-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold truncate">{title}</h1>
        {isSignedIn && <FeedbackButton />}
      </div>
      
      <div className="flex items-center gap-2">
        {isSignedIn && user && (isOwner || isCollaborator) && (
          <TooltipProvider>
            <Button
              variant="outline"
              size="icon"
              onClick={onCollaboratorsClick}
              className={cn(
                "h-10 px-3 min-w-fit flex items-center gap-3 whitespace-nowrap",
                showCollaborators && "bg-accent"
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    {acceptedCollaborators.length > 0 && userData && (
                      <div className="flex -space-x-3 mr-3">
                        {acceptedCollaborators.length > 5 ? (
                          <>
                            {userData.slice(0, 5).map((user) => (
                              <Avatar key={user.id} className="h-6 w-6 border-2 border-background ring-0">
                                <AvatarImage src={user.imageUrl ?? undefined} alt={user.username || ''} />
                                <AvatarFallback>{user.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                              </Avatar>
                            ))}
                            <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                              +{acceptedCollaborators.length - 5}
                            </div>
                          </>
                        ) : (
                          userData.map((user) => (
                            <Avatar key={user.id} className="h-6 w-6 border-2 border-background ring-0">
                              <AvatarImage src={user.imageUrl ?? undefined} alt={user.username || ''} />
                              <AvatarFallback>{user.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                            </Avatar>
                          ))
                        )}
                      </div>
                    )}
                    {user && isOwner && (
                      <div className="flex items-center">
                        <UserPlus className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isOwner ? "Manage collaborators" : "View collaborators"}</p>
                </TooltipContent>
              </Tooltip>
            </Button>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
} 