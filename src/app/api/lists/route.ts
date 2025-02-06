import { NextRequest, NextResponse } from "next/server";
import connectToMongoDB from "@/lib/db/mongodb";
import { getListModel, ListDocument } from "@/lib/db/models-v2/list";
import { getEnhancedLists } from "@/lib/actions/lists";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getUserId } from "@/lib/auth/api-utils";
import { auth } from "@clerk/nextjs/server";

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Record<string, string>;
}

export async function GET(req: NextRequest) {
  const { userId } = auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const privacy = searchParams.get("privacy");
    const query: any = { "owner.clerkId": userId };

    if (category) {
      query.category = category;
    }
    if (privacy) {
      query.privacy = privacy;
    }

    const { lists } = await getEnhancedLists(query);
    return NextResponse.json({ lists });
  } catch (error) {
    console.error("Error fetching lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch lists" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, description, category, privacy, items, listType = 'ordered' } = body;

    if (!title || !category || !privacy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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

    const list = await ListModel.create({
      title,
      description,
      category,
      privacy,
      listType,
      items: items || [],
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
    console.error("Error creating list:", error);
    return NextResponse.json(
      { error: "Failed to create list" },
      { status: 500 }
    );
  }
} 