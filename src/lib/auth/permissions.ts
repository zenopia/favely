import type { ListDocument, ListCollaborator } from "@/lib/db/models-v2/list";

// Helper function to check if user has access to the list
export async function hasListAccess(list: ListDocument, userId: string | null) {
  if (!userId) return list.visibility === 'public';
  
  return (
    list.visibility === 'public' ||
    list.owner.clerkId === userId ||
    list.collaborators.some((c: ListCollaborator) => 
      c.clerkId === userId && c.status === 'accepted'
    )
  );
}

// Helper function to check if user can edit the list
export async function canEditList(list: ListDocument, userId: string | null) {
  if (!userId) return false;
  
  return (
    list.owner.clerkId === userId ||
    list.collaborators.some((c: ListCollaborator) => 
      c.clerkId === userId && 
      c.status === 'accepted' && 
      ['admin', 'editor'].includes(c.role)
    )
  );
} 