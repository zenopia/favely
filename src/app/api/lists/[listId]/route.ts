import { NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel, ListDocument, ListCollaborator } from "@/lib/db/models-v2/list";
import { getEnhancedLists } from "@/lib/actions/lists";
import { getUserModel } from "@/lib/db/models-v2/user";
import { AuthServerService } from "@/lib/services/auth.server";

interface ListItem {
  title: string;
  comment?: string;
  completed?: boolean;
  properties?: Array<{
    tag?: string;
    value: string;
  }>;
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
    const hasAccess = list.visibility === "public" ||
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
        { visibility: "public" },
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
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { listId } = params;
    const data = await request.json();
    const { title, description, category, visibility, items, listType } = data;

    await connectToMongoDB();
    const ListModel = await getListModel();

    // Get the list to check ownership
    const list = await ListModel.findById(listId);
    if (!list) {
      return new NextResponse("List not found", { status: 404 });
    }

    // Check if user can edit the list
    const canEdit = await canEditList(list, user.id);
    if (!canEdit) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Process items before updating
    const processedItems = items.map((item: ListItem) => {
      const properties = Array.isArray(item.properties)
        ? item.properties.map(prop => ({
            tag: prop.tag || undefined,
            value: prop.value
          }))
        : [];

      return {
        title: item.title,
        comment: item.comment,
        completed: item.completed || false,
        properties
      };
    });

    // Update the list
    const updatedList = await ListModel.findByIdAndUpdate(
      listId,
      {
        $set: {
          title,
          description,
          category,
          visibility,
          listType,
          items: processedItems,
          editedAt: new Date()
        }
      },
      { new: true }
    );

    // Get enhanced list data
    const { lists } = await getEnhancedLists({ _id: listId });
    if (lists.length === 0) {
      return new NextResponse("List not found", { status: 404 });
    }

    return NextResponse.json({ list: lists[0] });
  } catch (error) {
    console.error("Error updating list:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
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
    const { title, description, category, visibility, items } = body;

    await connectToMongoDB();
    const ListModel = await getListModel();

    // Get the list to check ownership
    const list = await ListModel.findById(listId);
    if (!list) {
      return new NextResponse("List not found", { status: 404 });
    }

    // Check if user can edit the list
    const canEdit = await canEditList(list, user.id);
    if (!canEdit) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Build update object with only provided fields
    const updateData: any = {
      editedAt: new Date()
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (items !== undefined) {
      updateData.items = items.map((item: ListItem) => {
        const properties = Array.isArray(item.properties)
          ? item.properties.map(prop => ({
              tag: prop.tag || undefined,
              value: prop.value
            }))
          : [];

        return {
          title: item.title,
          comment: item.comment,
          completed: item.completed || false,
          properties
        };
      });
    }

    // Update the list
    await ListModel.findByIdAndUpdate(listId, { $set: updateData });

    // Get enhanced list data
    const { lists } = await getEnhancedLists({ _id: listId });
    if (lists.length === 0) {
      return new NextResponse("List not found", { status: 404 });
    }

    return NextResponse.json({ list: lists[0] });
  } catch (error) {
    console.error("Error updating list:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 