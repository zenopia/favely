import { SubLayout, type SubLayoutProps } from "@/components/layout/sub-layout";
import { UserProfile } from "@/components/users/user-profile";
import { ListGrid } from "@/components/lists/list-grid";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { connectToMongoDB } from "@/lib/db/client";
import { serializeUser } from "@/lib/utils";
import { notFound } from "next/navigation";
import type { MongoUserDocument } from "@/types/mongo";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getUserProfileModel } from "@/lib/db/models-v2/user-profile";
import { getEnhancedLists } from "@/lib/actions/lists";
import type { ListCategory } from "@/types/list";
import { AuthService } from "@/lib/services/auth.service";

interface PageProps {
  params: {
    username: string;
  };
  searchParams: {
    q?: string;
    category?: ListCategory;
    sort?: string;
  };
}

export default async function UserPage({ params, searchParams }: PageProps) {
  try {
    // Get current user's auth state
    const currentUser = await AuthService.getCurrentUser();
    const currentUserId = currentUser?.id;

    // Remove @ if present and decode the username
    const username = decodeURIComponent(params.username).replace(/^@/, '');

    // Connect to MongoDB first
    await connectToMongoDB();
    const UserModel = await getUserModel();
    const UserProfileModel = await getUserProfileModel();
    const FollowModel = await getFollowModel();

    // Get user data from MongoDB
    const mongoUser = (await UserModel.findOne({ 
      username: username.toLowerCase()  // Exact match with lowercase
    }).lean()) as unknown as MongoUserDocument;

    if (!mongoUser) {
      console.error(`User not found in MongoDB: ${username}`);
      notFound();
    }

    // Get user from AuthService using the clerkId from MongoDB
    const profileUser = await AuthService.getUserById(mongoUser.clerkId);
    if (!profileUser) {
      console.error(`User not found: ${username}`);
      notFound();
    }

    // Get user profile data
    const userProfile = await UserProfileModel.findOne({ userId: mongoUser._id }).lean();

    // Build filter for lists
    const filter = { 
      $or: [
        { 'owner.clerkId': profileUser.id },
        { 'owner.userId': mongoUser._id }
      ],
      privacy: 'public',
      ...(searchParams.category ? { category: searchParams.category } : {})
    };

    // Get enhanced lists with owner data and last viewed timestamps
    const { lists, lastViewedMap } = await getEnhancedLists(filter);

    // Get follow counts
    const [followerCount, followingCount] = await Promise.all([
      FollowModel.countDocuments({ followingId: profileUser.id, status: 'accepted' }),
      FollowModel.countDocuments({ followerId: profileUser.id, status: 'accepted' })
    ]);

    // Get follow status if logged in
    const followStatus = currentUserId ? await FollowModel.findOne({
      followerId: currentUserId,
      followingId: profileUser.id
    }).lean() : null;

    // Serialize user data
    const baseUser = serializeUser(mongoUser);
    const serializedUser = {
      ...baseUser,
      bio: userProfile?.bio,
      location: userProfile?.location,
      dateOfBirth: userProfile?.dateOfBirth,
      gender: userProfile?.gender,
      livingStatus: userProfile?.livingStatus,
      privacySettings: userProfile?.privacySettings || {
        showBio: true,
        showLocation: true,
        showDateOfBirth: false,
        showGender: true,
        showLivingStatus: true
      }
    };

    // Check if this is the current user's profile
    const isOwnProfile = currentUserId === profileUser.id;

    const pageContent = (
      <div className="px-4 md:px-6 lg:px-8 pt-4 pb-20 sm:pb-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <UserProfile 
            username={profileUser.username || ""}
            fullName={profileUser.fullName || ""}
            firstName={profileUser.firstName || null}
            lastName={profileUser.lastName || null}
            bio={serializedUser?.bio || null}
            imageUrl={profileUser.imageUrl}
            stats={{
              followers: followerCount,
              following: followingCount,
              lists: lists.length,
            }}
            isFollowing={!!followStatus}
            hideFollow={isOwnProfile}
            userData={serializedUser}
            showEditButton={isOwnProfile}
            location={serializedUser?.location}
            dateOfBirth={serializedUser?.dateOfBirth}
            gender={serializedUser?.gender}
            livingStatus={serializedUser?.livingStatus}
            privacySettings={serializedUser?.privacySettings}
            variant="full"
            showLocation={true}
            showStats={true}
          />
          
          <div className="space-y-4">
            <ListGrid 
              lists={lists}
              searchParams={searchParams}
              showPrivacyBadge
              lastViewedMap={lastViewedMap}
            />
          </div>
        </div>
      </div>
    );

    const layoutProps: SubLayoutProps = {
      title: username,
      hideBottomNav: true,
      children: pageContent
    };

    return <SubLayout {...layoutProps} />;
  } catch (error) {
    console.error("Error in UserPage:", error);
    notFound();
  }
} 
