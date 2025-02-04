'use server';

import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";

interface UserResponse {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  imageUrl: string | null;
  followersCount: number;
  followingCount: number;
}

interface ErrorResponse {
  error: string;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<UserResponse[] | ErrorResponse>> {
  try {
    const { userIds } = await req.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json<ErrorResponse>(
        { error: "User IDs array is required" },
        { status: 400 }
      );
    }

    await connectToMongoDB();
    const UserModel = await getUserModel();

    // Get users from MongoDB
    const users = await UserModel.find({
      clerkId: { $in: userIds }
    })
      .select("clerkId username displayName bio imageUrl followersCount followingCount")
      .lean();

    // Create map for quick lookup
    const userMap = new Map(users.map(user => [user.clerkId, {
      id: user.clerkId,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio || "",
      imageUrl: user.imageUrl || null,
      followersCount: user.followersCount || 0,
      followingCount: user.followingCount || 0
    }]));

    // Convert map to array in the same order as requested
    const result = userIds.map(id => userMap.get(id)).filter(Boolean);

    return NextResponse.json<UserResponse[]>(result);
  } catch (error) {
    console.error("Error in batch user fetch:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
} 