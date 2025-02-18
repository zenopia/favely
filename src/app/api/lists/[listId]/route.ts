import { NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel, ListDocument, ListCollaborator } from "@/lib/db/models-v2/list";
import { getEnhancedLists } from "@/lib/actions/lists";
import { AuthServerService } from "@/lib/services/auth.server";

interface ListItem {
  id: string;
  title: string;
  comment?: string;
  completed?: boolean;
  checked?: boolean;
  childItems?: Array<{
    title: string;
    tag?: string;
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

// Add this helper function after canEditList
async function migrateListItemSchema(list: ListDocument) {
  // Convert old properties array to new childItems array if needed
  if (list.items) {
    list.items = list.items.map(item => {
      const itemAny = item as any;
      if (itemAny.properties) {
        const { properties, ...rest } = itemAny;
        return {
          ...rest,
          childItems: properties || []
        };
      }
      return item;
    });
    await list.save();
  }
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
    const processedItems = items.map((item: ListItem, index: number) => ({
      id: item.id,
      title: item.title,
      comment: item.comment,
      completed: item.checked ?? item.completed ?? false,
      index: index, // Add index to preserve order
      childItems: Array.isArray(item.childItems)
        ? item.childItems.map((child, childIndex) => ({
            title: child.title,
            tag: child.tag || undefined,
            index: childIndex // Add index to preserve child order
          }))
        : []
    }));

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

    if (!updatedList) {
      console.error('Failed to update list');
      return new NextResponse("Failed to update list", { status: 500 });
    }

    // Get enhanced list data
    const { lists } = await getEnhancedLists({ _id: listId });
    if (lists.length === 0) {
      return new NextResponse("List not found", { status: 404 });
    }

    return NextResponse.json({ list: lists[0] });
  } catch (error) {
    console.error("Error updating list:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message, error.stack);
    }
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

    // Migrate the schema if needed
    await migrateListItemSchema(list);

    // Build update object with only provided fields
    const updateData: Partial<Pick<ListDocument, 'title' | 'description' | 'category' | 'visibility' | 'items' | 'editedAt'>> = {
      editedAt: new Date()
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (items !== undefined) {
      updateData.items = items.map((item: ListItem) => ({
        id: item.id,
        title: item.title,
        comment: item.comment,
        completed: item.completed || false,
        childItems: Array.isArray(item.childItems)
          ? item.childItems.map(child => ({
              title: child.title,
              tag: child.tag || undefined
            }))
          : []
      }));
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