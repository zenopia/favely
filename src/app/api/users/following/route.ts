import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { AuthService } from "@/lib/services/auth.service";
import { AuthServerService } from "@/lib/services/auth.server";
import { withAuth, getUserId } from "@/lib/auth/api-utils";
import { ClerkService } from "@/lib/services/authProvider.service";

export const dynamic = 'force-dynamic';

interface FollowingResponse {
  following: Array<{
    id: string;
    username: string;
    displayName: string;
    imageUrl: string | null;
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
    const user = await AuthServerService.getCurrentUser();
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
    const followingIds = following.map((f: { followingId: string }) => f.followingId);
    const followingDetails = await UserModel.find({
      clerkId: { $in: followingIds }
    })
      .select("clerkId username displayName imageUrl")
      .lean();

    // Transform the data
    const transformedFollowing = followingDetails.map(user => ({
      id: user.clerkId,
      username: user.username || '',
      displayName: user.displayName || user.username || '',
      imageUrl: user.imageUrl || null
    }));

    return NextResponse.json<FollowingResponse>({
      following: transformedFollowing,
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