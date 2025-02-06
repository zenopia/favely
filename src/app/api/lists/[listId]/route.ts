import { NextResponse } from "next/server";
import { AuthService } from "@/lib/services/auth.service";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel, ListDocument, ListCollaborator } from "@/lib/db/models-v2/list";
import { getEnhancedLists } from "@/lib/actions/lists";
import { getUserModel } from "@/lib/db/models-v2/user";
import { Types } from "mongoose";
import { AuthServerService } from "@/lib/services/auth.server";

interface ListItem {
  title: string;
  comment?: string;
  properties?: Array<{
    type?: string;
    label: string;
    value: string;
  }>;
}

// Helper function to check if user has access to the list
async function hasListAccess(list: ListDocument, userId: string | null) {
  if (!userId) return list.privacy === 'public';
  
  return (
    list.privacy === 'public' ||
    list.owner.clerkId === userId ||
    list.collaborators.some((c: ListCollaborator) => 
      c.clerkId === userId && c.status === 'accepted'
    )
  );
}

// Helper function to check if user can edit the list
async function canEditList(list: ListDocument, userId: string | null) {
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

export async function GET(
  request: Request,
  { params }: { params: { listId: string } }
) {
  const user = await AuthServerService.getCurrentUser();

  try {
    const { listId } = params;
    await connectToMongoDB();
    const ListModel = await getListModel();

    // First, get the basic list data to check ownership
    const list = await ListModel.findById(listId).lean();
    if (!list) {
      return new NextResponse("List not found", { status: 404 });
    }

    // Check if the list is accessible
    const hasAccess = list.privacy === "public" ||
      (user && (
        list.owner.clerkId === user.id ||
        list.collaborators?.some(c => c.clerkId === user.id && c.status === "accepted")
      ));

    if (!hasAccess) {
      return new NextResponse("List not found", { status: 404 });
    }

    // Increment view count if viewer is not the owner
    if (!user || user.id !== list.owner.clerkId) {
      await ListModel.findByIdAndUpdate(listId, {
        $inc: { "stats.viewCount": 1 }
      });
    }

    // Get the enhanced list data with updated view count
    const { lists } = await getEnhancedLists({
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
    });

    if (lists.length === 0) {
      return new NextResponse("List not found", { status: 404 });
    }

    return NextResponse.json({ list: lists[0] });
  } catch (error) {
    console.error("Error fetching list:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { listId: string } }
) {
  try {
    const currentUser = await AuthServerService.getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { listId } = params;
    const data = await request.json();
    const { title, description, category, privacy, items } = data;

    await connectToMongoDB();
    const ListModel = await getListModel();
    const UserModel = await getUserModel();

    const list = await ListModel.findById(listId).lean();

    if (!list) {
      return NextResponse.json(
        { error: "List not found" },
        { status: 404 }
      );
    }

    // Check edit permissions
    if (!await canEditList(list, currentUser.id)) {
      return NextResponse.json(
        { error: "Not authorized to edit this list" },
        { status: 403 }
      );
    }

    // Get user for username
    const ownerUser = await UserModel.findOne({ clerkId: list.owner.clerkId }).lean();
    if (!ownerUser) {
      return NextResponse.json(
        { error: "List owner not found" },
        { status: 404 }
      );
    }

    // Process items to ensure they have valid structure
    const processedItems = items.map((item: ListItem, index: number) => ({
      title: item.title,
      rank: index + 1,
      comment: item.comment,
      properties: (item.properties || []).map(prop => ({
        type: prop.type || 'text',
        label: prop.label || '',
        value: prop.value || ''
      }))
    }));

    // Update list
    const updatedList = await ListModel.findByIdAndUpdate(
      params.listId,
      {
        title,
        description,
        category,
        privacy,
        items: processedItems,
        editedAt: new Date()
      },
      { 
        new: true
      }
    ).lean();

    if (!updatedList) {
      return NextResponse.json(
        { error: "List not found" },
        { status: 404 }
      );
    }

    // Convert _id to string for the response
    const { _id, ...rest } = updatedList;
    const responseList = {
      ...rest,
      id: _id.toString(),
      username: ownerUser.username,
      createdAt: updatedList.createdAt?.toISOString(),
      updatedAt: updatedList.updatedAt?.toISOString(),
      editedAt: updatedList.editedAt?.toISOString(),
      owner: {
        ...updatedList.owner,
        id: updatedList.owner.userId?.toString()
      },
      collaborators: updatedList.collaborators?.map((c: { _id?: { toString(): string } } & Record<string, unknown>) => ({
        ...c,
        id: c._id?.toString()
      }))
    };

    return NextResponse.json(responseList);
  } catch (error) {
    console.error('Error updating list:', error);
    return NextResponse.json(
      { error: "Failed to update list" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { listId: string } }
) {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { listId } = params;
    await connectToMongoDB();
    const ListModel = await getListModel();

    // Find the list and check permissions
    const list = await ListModel.findById(listId);
    if (!list) {
      return new NextResponse("List not found", { status: 404 });
    }

    // Only the owner can delete the list
    if (list.owner.clerkId !== user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Delete the list
    await ListModel.findByIdAndDelete(listId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting list:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { listId: string } }
) {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { listId } = params;
    const body = await request.json();
    const { title, description, category, privacy, items } = body;

    await connectToMongoDB();
    const ListModel = await getListModel();

    // Find the list and check permissions
    const list = await ListModel.findById(listId);
    if (!list) {
      return new NextResponse("List not found", { status: 404 });
    }

    // Check if user is owner or collaborator with edit permissions
    const isOwner = list.owner.clerkId === user.id;
    const isEditor = list.collaborators?.some(
      (c) => c.clerkId === user.id && c.status === "accepted" && c.role === "editor"
    );

    if (!isOwner && !isEditor) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Update the list
    const updatedList = await ListModel.findByIdAndUpdate(
      listId,
      {
        $set: {
          title,
          description,
          category,
          privacy,
          items,
          editedAt: new Date()
        }
      },
      { new: true }
    ).lean();

    return NextResponse.json({ list: updatedList });
  } catch (error) {
    console.error("Error updating list:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 