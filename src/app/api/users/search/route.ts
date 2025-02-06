import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";
import { AuthServerService } from "@/lib/services/auth.server";

export const dynamic = 'force-dynamic';

interface UserSearchResponse {
  users: Array<{
    id: string;
    username: string;
    displayName: string;
    imageUrl: string | null;
  }>;
}

interface ErrorResponse {
  error: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<UserSearchResponse | ErrorResponse>> {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const currentUser = await AuthServerService.getCurrentUser();

    if (!query) {
      return NextResponse.json({ users: [] });
    }

    await connectToMongoDB();
    const UserModel = await getUserModel();

    // Search for users
    const users = await UserModel.find({
      $and: [
        {
          $or: [
            { username: { $regex: query, $options: "i" } },
            { displayName: { $regex: query, $options: "i" } }
          ]
        },
        // Exclude current user from results
        currentUser ? { clerkId: { $ne: currentUser.id } } : {}
      ]
    })
      .select("clerkId username displayName imageUrl")
      .limit(10)
      .lean();

    console.log('Search query:', query);
    console.log('Found users:', users);

    // Transform users for response
    const transformedUsers = users.map(user => ({
      id: user.clerkId,
      username: user.username || '',
      displayName: user.displayName || user.username || '',
      imageUrl: user.imageUrl || null
    }));

    console.log('Transformed users:', transformedUsers);

    return NextResponse.json<UserSearchResponse>({ users: transformedUsers });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
} 