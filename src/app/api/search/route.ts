import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel } from "@/lib/db/models-v2/list";
import { getUserModel } from "@/lib/db/models-v2/user";
import { FilterQuery } from "mongoose";
import { MongoListDocument } from "@/types/mongo";
import { withAuth, getUserId } from "@/lib/auth/api-utils";

export const dynamic = 'force-dynamic';

type RouteParams = Record<string, never>;

export const GET = withAuth<RouteParams>(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "all";
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
    const [ListModel, UserModel] = await Promise.all([
      getListModel(),
      getUserModel()
    ]);

    let lists: any[] = [];
    let users: any[] = [];
    let total = 0;

    if (type === "lists" || type === "all") {
      const searchQuery: FilterQuery<MongoListDocument> = {
        $and: [
          {
            $or: [
              { title: { $regex: query, $options: "i" } },
              { description: { $regex: query, $options: "i" } }
            ]
          }
        ]
      };

      // If not authenticated, only show public lists
      if (!userId) {
        (searchQuery.$and as any[]).push({
          visibility: "public"
        });
      } else {
        // If authenticated, show public lists and lists where user is owner/collaborator
        (searchQuery.$and as any[]).push({
          $or: [
            { visibility: "public" },
            { "owner.clerkId": userId },
            {
              collaborators: {
                $elemMatch: {
                  clerkId: userId,
                  status: "accepted"
                }
              }
            }
          ]
        });
      }

      [lists, total] = await Promise.all([
        ListModel.find(searchQuery)
          .select("title description category visibility owner stats")
          .skip(skip)
          .limit(limit)
          .lean(),
        ListModel.countDocuments(searchQuery)
      ]);
    }

    if (type === "users" || type === "all") {
      const userQuery = {
        $or: [
          { username: { $regex: query, $options: "i" } },
          { displayName: { $regex: query, $options: "i" } }
        ]
      };

      [users, total] = await Promise.all([
        UserModel.find(userQuery)
          .select("username displayName imageUrl")
          .skip(skip)
          .limit(limit)
          .lean(),
        UserModel.countDocuments(userQuery)
      ]);
    }

    return NextResponse.json({
      results: type === "users" ? users : type === "lists" ? lists : [...lists, ...users],
      total,
      page,
      limit
    });
  } catch (error) {
    console.error("Error in search:", error);
    return NextResponse.json(
      { error: "Failed to search" },
      { status: 500 }
    );
  }
}, { requireAuth: false }); 