import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { withAuth, getUserId } from "@/lib/auth/api-utils";
import { ClerkService } from "@/lib/services/authProvider.service";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const userId = getUserId(req);
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    await connectToMongoDB();
    const UserModel = await getUserModel();
    const FollowModel = await getFollowModel();

    // Get followers
    const [followers, total] = await Promise.all([
      FollowModel.find({ followingId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FollowModel.countDocuments({ followingId: userId })
    ]);

    // Get follower details
    const followerIds = followers.map((f: { followerId: string }) => f.followerId);
    const [followerDetails, clerkUsers] = await Promise.all([
      UserModel.find({
        clerkId: { $in: followerIds }
      })
        .select("username displayName bio followersCount followingCount")
        .lean(),
      ClerkService.getUserList(followerIds)
    ]);

    // Create maps for quick lookup
    const followerMap = new Map(
      followerDetails.map((f: { clerkId: string }) => [f.clerkId, f])
    );
    const clerkUserMap = new Map(
      clerkUsers.map((u) => [u.id, u])
    );

    // Combine the data
    const combinedFollowers = followerDetails.map((follower: {
      _id: string;
      clerkId: string;
      username: string;
      displayName: string;
      bio: string;
      followersCount: number;
      followingCount: number;
    }) => {
      const clerkUser = clerkUserMap.get(follower.clerkId);
      return {
        _id: follower._id,
        username: follower.username,
        displayName: follower.displayName,
        bio: follower.bio,
        imageUrl: clerkUser?.imageUrl ?? null,
        followersCount: follower.followersCount,
        followingCount: follower.followingCount,
      };
    });

    return NextResponse.json({
      followers: combinedFollowers,
      total,
      page,
      pageSize: limit
    });
  } catch (error) {
    console.error("Error fetching followers:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}); 