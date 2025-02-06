import { getEnhancedUsers } from "@/lib/actions/users";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { notFound } from "next/navigation";
import { PeoplePageLayout } from "@/components/users/people-page-layout";
import type { Follow } from "@/types/follow";
import { getUserModel } from "@/lib/db/models-v2/user";
import { AuthService } from "@/lib/services/auth.service";
import { connectToMongoDB } from "@/lib/db/client";
import { AuthServerService } from "@/lib/services/auth.server";

interface PageProps {
  params: { username: string };
  searchParams: { q?: string };
}

export default async function UserFollowingPage({ params, searchParams }: PageProps) {
  try {
    // Remove @ if present and decode the username
    const username = decodeURIComponent(params.username).replace(/^@/, '');
    const searchQuery = searchParams.q;

    // Get MongoDB user first
    await connectToMongoDB();
    const UserModel = await getUserModel();
    const mongoUser = await UserModel.findOne({ username: username.toLowerCase() }).lean();
    
    if (!mongoUser) {
      console.error(`User not found in MongoDB: ${username}`);
      notFound();
    }

    // Get current user if logged in (for follow status)
    const currentUser = await AuthServerService.getCurrentUser();
    
    // Get following IDs for the profile user
    const followModel = await getFollowModel();
    const following = await followModel
      .find({ followerId: mongoUser.clerkId, status: 'accepted' })
      .select("followingId")
      .lean();
    const followingIds = following.map((f: Follow) => f.followingId);

    // Get all users that match the search query
    const filter = searchQuery 
      ? { 
          $or: [
            { username: { $regex: searchQuery, $options: "i" } },
            { displayName: { $regex: searchQuery, $options: "i" } }
          ]
        }
      : {};
    
    // Get enhanced user data
    const users = await getEnhancedUsers(filter);

    // Filter users to show only those being followed if there's no search query
    const filteredUsers = searchQuery 
      ? users.map(user => ({
          ...user,
          isFollowing: currentUser ? followingIds.includes(user.clerkId) : false
        }))
      : users.filter(user => followingIds.includes(user.clerkId))
          .map(user => ({
            ...user,
            isFollowing: currentUser ? followingIds.includes(user.clerkId) : false
          }));

    // Get follow counts
    const followerCount = await followModel.countDocuments({ followingId: mongoUser.clerkId, status: 'accepted' });
    const followingCount = await followModel.countDocuments({ followerId: mongoUser.clerkId, status: 'accepted' });

    return (
      <PeoplePageLayout
        profileUserId={mongoUser.clerkId}
        displayName={mongoUser.displayName || username}
        username={username}
        followerCount={followerCount}
        followingCount={followingCount}
        users={filteredUsers}
        searchQuery={searchQuery}
      />
    );
  } catch (error) {
    console.error('Error in UserFollowingPage:', error);
    notFound();
  }
} 