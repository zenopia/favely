import { NextResponse } from "next/server";
import { AuthService } from "@/lib/services/auth.service";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel, type ListDocument, type ListCollaborator } from "@/lib/db/models-v2/list";
import type { ListItem } from "@/types/list";
import { Types } from "mongoose";
import { AuthServerService } from "@/lib/services/auth.server";

// Helper function to convert mongoose list item to external ListItem interface
function convertToListItem(mongoItem: { title: string; comment?: string; rank: number; properties?: Array<{ type?: 'text' | 'link'; label: string; value: string; }> }): ListItem {
  return {
    id: crypto.randomUUID(),
    title: mongoItem.title,
    comment: mongoItem.comment,
    rank: mongoItem.rank,
    properties: mongoItem.properties?.map(prop => ({
      id: crypto.randomUUID(),
      type: prop.type as 'text' | 'link',
      label: prop.label,
      value: prop.value
    }))
  };
}

export async function GET(
  request: Request,
  { params }: { params: { username: string; listId: string; itemId: string } }
) {
  try {
    const user = await AuthServerService.getCurrentUser();
    await connectToMongoDB();
    const ListModel = await getListModel();

    const list = await ListModel.findById(params.listId).lean() as ListDocument;
    if (!list) {
      return new NextResponse("List not found", { status: 404 });
    }

    // Check if user has access to the list
    const hasAccess = list.privacy === 'public' || 
      (user && (
        list.owner.clerkId === user.id ||
        list.collaborators?.some((c: ListCollaborator) => 
          c.clerkId === user.id && 
          c.status === 'accepted'
        )
      ));

    if (!hasAccess) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Find the item by rank
    const mongoItem = list.items?.find(item => item.rank === parseInt(params.itemId));
    if (!mongoItem) {
      return new NextResponse("Item not found", { status: 404 });
    }

    // Convert MongoDB item to ListItem interface
    const item = convertToListItem(mongoItem);

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching list item:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { username: string; listId: string; itemId: string } }
) {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await connectToMongoDB();
    const ListModel = await getListModel();

    const list = await ListModel.findById(params.listId).lean() as ListDocument;
    if (!list) {
      return new NextResponse("List not found", { status: 404 });
    }

    // Check if user has edit permissions
    const canEdit = list.owner.clerkId === user.id ||
      list.collaborators?.some((c: ListCollaborator) => 
        c.clerkId === user.id && 
        c.status === 'accepted' &&
        ['admin', 'editor'].includes(c.role)
      );

    if (!canEdit) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const itemIndex = list.items?.findIndex(item => item.rank === parseInt(params.itemId));
    if (itemIndex === undefined || itemIndex === -1) {
      return new NextResponse("Item not found", { status: 404 });
    }

    const updates = await request.json();
    const updatedList = await ListModel.findByIdAndUpdate(
      params.listId,
      { 
        $set: { 
          [`items.${itemIndex}`]: {
            ...list.items[itemIndex],
            ...updates,
            rank: parseInt(params.itemId)
          }
        },
        editedAt: new Date()
      },
      { new: true }
    ).lean() as ListDocument;

    if (!updatedList) {
      return new NextResponse("Failed to update item", { status: 500 });
    }

    const updatedItem = updatedList.items[itemIndex];
    const item = convertToListItem(updatedItem);

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating list item:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { username: string; listId: string; itemId: string } }
) {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await connectToMongoDB();
    const ListModel = await getListModel();

    const list = await ListModel.findById(params.listId).lean() as ListDocument;
    if (!list) {
      return new NextResponse("List not found", { status: 404 });
    }

    // Check if user has edit permissions
    const canEdit = list.owner.clerkId === user.id ||
      list.collaborators?.some((c: ListCollaborator) => 
        c.clerkId === user.id && 
        c.status === 'accepted' &&
        ['admin', 'editor'].includes(c.role)
      );

    if (!canEdit) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const itemIndex = list.items?.findIndex(item => item.rank === parseInt(params.itemId));
    if (itemIndex === undefined || itemIndex === -1) {
      return new NextResponse("Item not found", { status: 404 });
    }

    // Remove the item and reorder remaining items
    const updatedItems = list.items.filter(item => item.rank !== parseInt(params.itemId))
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    const updatedList = await ListModel.findByIdAndUpdate(
      params.listId,
      { 
        $set: { 
          items: updatedItems,
          editedAt: new Date()
        }
      },
      { new: true }
    ).lean() as ListDocument;

    if (!updatedList) {
      return new NextResponse("Failed to delete item", { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting list item:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 