"use server";

import { AuthService } from "@/lib/services/auth.service";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel } from "@/lib/db/models-v2/list";
import { getEnhancedLists } from "@/lib/actions/lists";
import { notFound } from "next/navigation";
import { EnhancedList } from "@/types/list";
import { FilterQuery, QueryOptions } from "mongoose";
import { MongoListDocument } from "@/types/mongo";
import { AuthServerService } from "@/lib/services/auth.server";

export async function getList(listId: string) {
  const user = await AuthServerService.getCurrentUser();

  await connectToMongoDB();
  const ListModel = await getListModel();

  // Get the list with enhanced data
  const query: FilterQuery<MongoListDocument> = {
    _id: listId,
    $or: [
      { privacy: "public" },
      ...(user
        ? [
            { "owner.clerkId": user.id },
            {
              collaborators: {
                $elemMatch: {
                  clerkId: user.id,
                  status: "accepted"
                }
              }
            }
          ]
        : [])
    ]
  };

  const options: QueryOptions<MongoListDocument> = {};
  const { lists } = await getEnhancedLists(query, options);

  if (lists.length === 0) {
    notFound();
  }

  return lists[0];
}

export async function updateList(
  listId: string,
  data: {
    title?: string;
    description?: string;
    category?: string;
    privacy?: string;
    items?: Array<{
      id: string;
      title: string;
      checked: boolean;
      childItems?: Array<{
        title: string;
        tag?: string;
      }>;
    }>;
  }
) {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  await connectToMongoDB();
  const ListModel = await getListModel();

  // Find the list and check permissions
  const list = await ListModel.findById(listId);
  if (!list) {
    throw new Error("List not found");
  }

  // Check if user is owner or collaborator with edit permissions
  const isOwner = list.owner.clerkId === user.id;
  const isEditor = list.collaborators?.some(
    (c) => c.clerkId === user.id && c.status === "accepted" && c.role === "editor"
  );

  if (!isOwner && !isEditor) {
    throw new Error("Unauthorized");
  }

  // Transform items to map checked to completed if items are being updated
  const transformedItems = data.items?.map(({ checked, id, ...item }) => ({
    id,
    title: item.title,
    completed: checked,
    childItems: item.childItems?.map(child => ({
      title: child.title,
      tag: child.tag
    }))
  }));

  // Create the update operation with explicit typing
  const updateOperation: {
    $set: {
      title?: string;
      description?: string;
      category?: string;
      privacy?: string;
      items?: typeof transformedItems;
    };
    $currentDate: { editedAt: true };
  } = {
    $set: {
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.category && { category: data.category }),
      ...(data.privacy && { privacy: data.privacy }),
      ...(transformedItems && { items: transformedItems })
    },
    $currentDate: { editedAt: true }
  };

  // Update the list
  const updatedList = await ListModel.findByIdAndUpdate(
    listId,
    updateOperation,
    { 
      new: true,
      runValidators: true  // This ensures our schema validation runs
    }
  ).lean();

  if (!updatedList) {
    throw new Error("Failed to update list");
  }

  return updatedList;
}

export async function deleteList(listId: string) {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  await connectToMongoDB();
  const ListModel = await getListModel();

  // Find the list and check permissions
  const list = await ListModel.findById(listId);
  if (!list) {
    throw new Error("List not found");
  }

  // Only the owner can delete the list
  if (list.owner.clerkId !== user.id) {
    throw new Error("Unauthorized");
  }

  // Delete the list
  await ListModel.findByIdAndDelete(listId);
} 