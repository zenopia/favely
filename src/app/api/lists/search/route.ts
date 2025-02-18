import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel } from "@/lib/db/models-v2/list";
import { getEnhancedLists } from "@/lib/actions/lists";
import { FilterQuery } from "mongoose";
import { MongoListDocument } from "@/types/mongo";
import { withAuth, getUserId } from "@/lib/auth/api-utils";

export const dynamic = 'force-dynamic';

type RouteParams = Record<string, never>;

export const GET = withAuth<RouteParams>(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const category = searchParams.get("category");
    const visibility = searchParams.get("visibility");
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Get user ID if authenticated
    let userId: string | undefined;
    try {
      userId = getUserId(req);
    } catch {
      // User is not authenticated - this is fine for search
    }

    await connectToMongoDB();
    const ListModel = await getListModel();

    // Build the search query
    const searchQuery: FilterQuery<MongoListDocument> = {
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } }
      ]
    };

    if (category) {
      searchQuery.category = category;
    }

    if (visibility) {
      searchQuery.visibility = visibility;
    }

    // If not authenticated or visibility filter is not "private",
    // only show public lists and lists where user is owner/collaborator
    if (!userId || visibility !== "private") {
      searchQuery.$or = [
        { visibility: "public" },
        ...(userId ? [
          { "owner.clerkId": userId },
          {
            collaborators: {
              $elemMatch: {
                clerkId: userId,
                status: "accepted"
              }
            }
          }
        ] : [])
      ];
    }

    // Get lists and total count
    const [lists, total] = await Promise.all([
      ListModel.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ListModel.countDocuments(searchQuery)
    ]);

    // Enhance lists with additional data
    const { lists: enhancedLists } = await getEnhancedLists(lists);

    return NextResponse.json({
      lists: enhancedLists,
      total,
      page,
      limit,
      hasMore: total > skip + lists.length
    });
  } catch (error) {
    console.error("Error searching lists:", error);
    return NextResponse.json(
      { error: "Failed to search lists" },
      { status: 500 }
    );
  }
}, { requireAuth: false }); 