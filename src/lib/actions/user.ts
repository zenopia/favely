"use server"

import { AuthService } from "@/lib/services/auth.service";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { MongoUserDocument } from "@/types/mongo";
import { AuthServerService } from "@/lib/services/auth.server";

export async function getUser(clerkId: string): Promise<MongoUserDocument | null> {
  await connectToDatabase();
  const UserModel = await getUserModel();
  return UserModel.findOne({ clerkId }).lean() as unknown as MongoUserDocument;
}

export async function getFollowersCount(clerkId: string): Promise<number> {
  await connectToDatabase();
  const FollowModel = await getFollowModel();
  return FollowModel.countDocuments({ followingId: clerkId, status: 'accepted' });
}

export async function getFollowingCount(clerkId: string): Promise<number> {
  await connectToDatabase();
  const FollowModel = await getFollowModel();
  return FollowModel.countDocuments({ followerId: clerkId, status: 'accepted' });
}

export async function getFollowStatus(targetUserId: string): Promise<boolean> {
  const user = await AuthServerService.getCurrentUser();
  if (!user) return false;

  await connectToDatabase();
  const FollowModel = await getFollowModel();
  const follow = await FollowModel.findOne({
    followerId: user.id,
    followingId: targetUserId,
    status: 'accepted'
  });
  return !!follow;
}

export async function updateUser(clerkId: string, data: Partial<MongoUserDocument>): Promise<void> {
  await connectToDatabase();
  const UserModel = await getUserModel();
  await UserModel.updateOne({ clerkId }, { $set: data });
}

export async function deleteUser(clerkId: string): Promise<void> {
  await connectToDatabase();
  const UserModel = await getUserModel();
  await UserModel.deleteOne({ clerkId });
}

export async function ensureUserExists() {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  await connectToDatabase();
  const UserModel = await getUserModel();

  const existingUser = await UserModel.findOne({ clerkId: user.id });
  if (!existingUser) {
    // Create new user document
    const newUser = await UserModel.create({
      clerkId: user.id,
      username: user.username || '',
      displayName: user.fullName || user.username || '',
      searchIndex: `${user.username || ''} ${user.fullName || ''}`.toLowerCase(),
      followersCount: 0,
      followingCount: 0,
      listCount: 0
    });

    return newUser;
  }

  return existingUser;
} 