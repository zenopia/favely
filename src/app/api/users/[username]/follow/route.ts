import { NextRequest, NextResponse } from "next/server";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { getUserModel } from "@/lib/db/models-v2/user";
import { AuthService } from "@/lib/services/auth.service";

interface RouteParams {
  username: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Remove @ if present and decode the username
    const username = decodeURIComponent(params.username).replace(/^@/, '');

    const UserModel = await getUserModel();
    const userToFollow = await UserModel.findOne({ username }).lean();

    if (!userToFollow) {
      return NextResponse.json(
        { error: "User to follow not found" },
        { status: 404 }
      );
    }

    const FollowModel = await getFollowModel();

    // Check if already following
    const existingFollow = await FollowModel.findOne({
      followerId: user.id,
      followingId: userToFollow.clerkId,
    });

    if (existingFollow) {
      return NextResponse.json(
        { error: "Already following this user" },
        { status: 400 }
      );
    }

    // Get current user details
    const currentUser = await UserModel.findOne({ clerkId: user.id }).lean();
    if (!currentUser) {
      return NextResponse.json(
        { error: "Current user not found" },
        { status: 404 }
      );
    }

    // Create follow relationship
    await FollowModel.create({
      followerId: user.id,
      followingId: userToFollow.clerkId,
      followerInfo: {
        username: currentUser.username || "",
        displayName: currentUser.displayName || "",
      },
      followingInfo: {
        username: userToFollow.username,
        displayName: userToFollow.displayName,
      },
      status: 'accepted',
      createdAt: new Date(),
      acceptedAt: new Date(),
    });

    // Update follower counts
    await Promise.all([
      UserModel.updateOne(
        { clerkId: user.id },
        { $inc: { followingCount: 1 } }
      ),
      UserModel.updateOne(
        { clerkId: userToFollow.clerkId },
        { $inc: { followersCount: 1 } }
      ),
    ]);

    return NextResponse.json({
      message: `Now following @${username}`,
    });
  } catch (error) {
    console.error("[FOLLOW_POST]", error);
    return NextResponse.json(
      { error: "Failed to follow user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Remove @ if present and decode the username
    const username = decodeURIComponent(params.username).replace(/^@/, '');

    const UserModel = await getUserModel();
    const userToUnfollow = await UserModel.findOne({ username }).lean();

    if (!userToUnfollow) {
      return NextResponse.json(
        { error: "User to unfollow not found" },
        { status: 404 }
      );
    }

    const FollowModel = await getFollowModel();

    // Delete follow relationship
    const result = await FollowModel.deleteOne({
      followerId: user.id,
      followingId: userToUnfollow.clerkId,
      status: 'accepted'
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Not following this user" },
        { status: 400 }
      );
    }

    // Update follower counts
    await Promise.all([
      UserModel.updateOne(
        { clerkId: user.id },
        { $inc: { followingCount: -1 } }
      ),
      UserModel.updateOne(
        { clerkId: userToUnfollow.clerkId },
        { $inc: { followersCount: -1 } }
      ),
    ]);

    return NextResponse.json({
      message: `Unfollowed @${username}`,
    });
  } catch (error) {
    console.error("[FOLLOW_DELETE]", error);
    return NextResponse.json(
      { error: "Failed to unfollow user" },
      { status: 500 }
    );
  }
} 