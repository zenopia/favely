import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { getUserModel } from "@/lib/db/models-v2/user";
import { AuthService } from "@/lib/services/auth.service";
import { AuthServerService } from "@/lib/services/auth.server";

interface RouteParams {
  username: string;
}

interface FollowStatusResponse {
  isFollowing: boolean;
}

interface ErrorResponse {
  error: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse<FollowStatusResponse | ErrorResponse>> {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { username } = params;

    await connectToMongoDB();
    const [FollowModel, UserModel] = await Promise.all([
      getFollowModel(),
      getUserModel()
    ]);

    // Get target user's Clerk ID from username
    const targetUser = await UserModel.findOne({ username }).lean();
    if (!targetUser) {
      return NextResponse.json<ErrorResponse>(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if current user is following target user
    const isFollowing = await FollowModel.exists({
      followerId: user.id,
      followingId: targetUser.clerkId,
      status: 'accepted'
    });

    return NextResponse.json<FollowStatusResponse>({
      isFollowing: !!isFollowing
    });
  } catch (error) {
    console.error("Error checking follow status:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to check follow status" },
      { status: 500 }
    );
  }
} 