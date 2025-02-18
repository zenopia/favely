import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel, ListDocument } from "@/lib/db/models-v2/list";
import { getUserModel } from "@/lib/db/models-v2/user";
import { withAuth, getUserId } from "@/lib/auth/api-utils";

export const dynamic = 'force-dynamic';

interface RouteParams {
  listId: string;
}

export const POST = withAuth<RouteParams>(async (
  req: NextRequest,
  { params }: { params: RouteParams }
) => {
  try {
    const userId = getUserId(req);
    
    await connectToMongoDB();
    const [ListModel, UserModel] = await Promise.all([
      getListModel(),
      getUserModel()
    ]);

    // Get MongoDB user document
    const mongoUser = await UserModel.findOne({ clerkId: userId });
    if (!mongoUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Find the original list
    const originalList = await ListModel.findById(params.listId).lean();
    if (!originalList) {
      return NextResponse.json(
        { error: "List not found" },
        { status: 404 }
      );
    }

    // Check if the list is public or if the user has access
    const hasAccess =
      originalList.visibility === "public" ||
      originalList.owner.clerkId === userId ||
      originalList.collaborators?.some(
        (c) => c.clerkId === userId && c.status === "accepted"
      );

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Create a copy of the list
    const list = await ListModel.create({
      title: `${originalList.title} (Copy)`,
      description: originalList.description,
      category: originalList.category,
      visibility: "private", // Always create copies as private
      listType: originalList.listType,
      items: originalList.items || [],
      owner: {
        clerkId: userId,
        userId: mongoUser._id,
        username: mongoUser.username || "",
        joinedAt: new Date()
      },
      collaborators: [],
      stats: {
        viewCount: 0,
        pinCount: 0,
        copyCount: 0
      }
    }) as ListDocument;

    // Increment copy count on original list
    await ListModel.findByIdAndUpdate(originalList._id, {
      $inc: { "stats.copyCount": 1 }
    });

    // Convert _id to string for the response
    const { _id, ...rest } = list.toObject();
    const responseList = {
      ...rest,
      id: _id.toString(),
      createdAt: list.createdAt?.toISOString(),
      updatedAt: list.updatedAt?.toISOString(),
      editedAt: list.editedAt?.toISOString(),
      owner: {
        ...list.owner,
        id: list.owner.userId?.toString()
      }
    };

    return NextResponse.json(responseList);
  } catch (error) {
    console.error("Error copying list:", error);
    return NextResponse.json(
      { error: "Failed to copy list" },
      { status: 500 }
    );
  }
}, { requireAuth: true }); 