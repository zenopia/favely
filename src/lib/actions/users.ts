import { AuthService } from "@/lib/services/auth.service";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { getUserProfileModel } from "@/lib/db/models-v2/user-profile";
import { getUserCacheModel } from "@/lib/db/models-v2/user-cache";
import { MongoUserDocument } from "@/types/mongo";
import { AuthServerService } from "@/lib/services/auth.server";

export interface EnhancedUser {
  id: string;
  clerkId: string;
  username: string;
  displayName: string;
  imageUrl: string | null;
  bio?: string;
  isFollowing: boolean;
}

export async function getEnhancedUsers(filter: any = {}, options: { sort?: any } = {}): Promise<EnhancedUser[]> {
  let user = null;
  try {
    user = await AuthServerService.getCurrentUser();
  } catch (error) {
    // Ignore auth errors - function should work without authentication
    console.debug('No authenticated user found');
  }
  
  await connectToMongoDB();
  
  // Get model instances
  const UserModel = await getUserModel();
  const UserProfileModel = await getUserProfileModel();
  const UserCacheModel = await getUserCacheModel();
  const FollowModel = await getFollowModel();
  
  // Fetch users with the given filter
  const users = await UserModel.find(filter).lean();
  
  // Get user cache data for all users
  const userCaches = await UserCacheModel.find({
    clerkId: { $in: users.map(user => user.clerkId) }
  }).lean();
  
  // Create a map for quick lookup
  const userCacheMap = userCaches.reduce((acc, cache) => {
    acc[cache.clerkId] = cache;
    return acc;
  }, {} as Record<string, any>);
  
  // Get user profiles
  const userProfiles = await UserProfileModel.find({
    userId: { $in: users.map(user => user._id) }
  }).lean();
  
  // Create a map for quick lookup
  const userProfileMap = userProfiles.reduce((acc, profile) => {
    acc[profile.userId.toString()] = profile;
    return acc;
  }, {} as Record<string, any>);
  
  // If authenticated, get follow data
  let followMap: Record<string, boolean> = {};
  if (user) {
    const follows = await FollowModel.find({
      followerId: user.id,
      followingId: { $in: users.map(user => user.clerkId) },
      status: 'accepted'
    }).lean();
    
    followMap = follows.reduce((acc, follow) => {
      acc[follow.followingId] = true;
      return acc;
    }, {} as Record<string, boolean>);
  }
  
  // Enhance users with cache and follow data
  return users.map(user => {
    const cache = userCacheMap[user.clerkId];
    const profile = userProfileMap[user._id.toString()];
    
    return {
      id: user._id.toString(),
      clerkId: user.clerkId,
      username: user.username,
      displayName: cache?.displayName || user.username,
      imageUrl: cache?.imageUrl || null,
      bio: profile?.bio,
      isFollowing: !!followMap[user.clerkId]
    };
  });
} 