'use server';

import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";

interface UserResponse {
  id: string;
  username: string;
  displayName: string;
  imageUrl: string | null;
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
      .select("clerkId username displayName imageUrl")
      .lean();

    // Transform users for response
    const result = userIds.map(id => {
      const user = users.find(u => u.clerkId === id);
      return user ? {
        id: user.clerkId,
        username: user.username || '',
        displayName: user.displayName || user.username || '',
        imageUrl: user.imageUrl || null
      } : {
        id,
        username: 'Unknown User',
        displayName: 'Unknown User',
        imageUrl: null
      };
    });

    return NextResponse.json<UserResponse[]>(result);
  } catch (error) {
    console.error("Error in batch user fetch:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
} 