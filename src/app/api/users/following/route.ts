import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { AuthService } from "@/lib/services/auth.service";

export const dynamic = 'force-dynamic';

interface FollowingResponse {
  following: Array<{
    id: string;
    followerId: string;
    followingId: string;
    createdAt: Date;
    following: {
      id: string;
      username: string;
      displayName: string;
      bio: string;
      imageUrl: string | null;
      followersCount: number;
      followingCount: number;
    } | null;
  }>;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface ErrorResponse {
  error: string;
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<FollowingResponse | ErrorResponse>> {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    await connectToMongoDB();
    const UserModel = await getUserModel();
    const FollowModel = await getFollowModel();

    // Get following relationships
    const [following, total] = await Promise.all([
      FollowModel.find({ followerId: user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FollowModel.countDocuments({ followerId: user.id })
    ]);

    // Get user details for each followed user
    const followingIds = following.map((f) => f.followingId);
    const [followingDetails, clerkUsers] = await Promise.all([
      UserModel.find({
        clerkId: { $in: followingIds }
      })
        .select("username displayName bio followersCount followingCount")
        .lean(),
      clerkClient.users.getUserList({
        userId: followingIds,
      })
    ]);

    // Create maps for quick lookup
    const followingMap = new Map(
      followingDetails.map((f) => [f.clerkId, f])
    );
    const clerkUserMap = new Map(
      clerkUsers.map((u) => [u.id, u])
    );

    // Combine follow data with user details
    const enhancedFollowing = following.map((follow) => {
      const followedUser = followingMap.get(follow.followingId);
      const clerkUser = clerkUserMap.get(follow.followingId);
      return {
        id: follow._id.toString(),
        followerId: follow.followerId,
        followingId: follow.followingId,
        createdAt: follow.createdAt,
        following: followedUser
          ? {
              id: followedUser._id.toString(),
              username: followedUser.username,
              displayName: followedUser.displayName,
              bio: followedUser.bio || "",
              imageUrl: clerkUser?.imageUrl || null,
              followersCount: followedUser.followersCount || 0,
              followingCount: followedUser.followingCount || 0
            }
          : null
      };
    });

    return NextResponse.json<FollowingResponse>({
      following: enhancedFollowing,
      total,
      page,
      limit,
      hasMore: total > skip + following.length
    });
  } catch (error) {
    console.error("Error fetching following:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to fetch following" },
      { status: 500 }
    );
  }
} 