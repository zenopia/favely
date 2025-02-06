import { AuthService } from "@/lib/services/auth.service";
import { notFound } from "next/navigation";
import { getListModel } from "@/lib/db/models-v2/list";
import { connectToMongoDB } from "@/lib/db/client";
import { MongoListDocument } from "@/types/mongo";
import { AuthServerService } from "@/lib/services/auth.server";

export async function getAuthorizedList(listId: string): Promise<MongoListDocument> {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    notFound();
  }

  await connectToMongoDB();
  const ListModel = await getListModel();

  const list = await ListModel.findById(listId).lean() as unknown as MongoListDocument;
  if (!list) {
    notFound();
  }

  // Check if user is owner or collaborator
  const isOwner = list.owner.clerkId === user.id;
  const isCollaborator = list.collaborators?.some(c => c.clerkId === user.id && c.status === 'accepted');
  
  if (!isOwner && !isCollaborator) {
    notFound();
  }

  return list;
}

export async function getAuthorizedListForView(listId: string): Promise<MongoListDocument> {
  const user = await AuthServerService.getCurrentUser();

  await connectToMongoDB();
  const ListModel = await getListModel();

  const list = await ListModel.findById(listId).lean() as unknown as MongoListDocument;
  if (!list) {
    notFound();
  }

  // Public lists can be viewed by anyone
  if (list.privacy === 'public') {
    return list;
  }

  // Private lists can only be viewed by owner or collaborators
  if (!user) {
    notFound();
  }

  const isOwner = list.owner.clerkId === user.id;
  const isCollaborator = list.collaborators?.some(c => c.clerkId === user.id && c.status === 'accepted');
  
  if (!isOwner && !isCollaborator) {
    notFound();
  }

  return list;
} 