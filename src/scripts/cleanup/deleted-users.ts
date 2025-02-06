import { connectToDatabase } from "@/lib/db/mongodb";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getUserProfileModel } from "@/lib/db/models-v2/user-profile";
import { getListModel } from "@/lib/db/models-v2/list";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { ClerkService } from "@/lib/services/authProvider.service";

async function cleanupDeletedUsers() {
  try {
    console.log('Starting cleanup of deleted users...');
    
    // Connect to MongoDB
    await connectToDatabase();
    
    // Get all models
    const UserModel = await getUserModel();
    const UserProfileModel = await getUserProfileModel();
    const ListModel = await getListModel();
    const FollowModel = await getFollowModel();
    
    // Get all users from our database
    const dbUsers = await UserModel.find({});
    console.log(`Found ${dbUsers.length} users in database`);
    
    // Track cleanup statistics
    const stats = {
      deletedUsers: 0,
      deletedProfiles: 0,
      deletedLists: 0,
      updatedCollaborations: 0,
      deletedFollows: 0
    };

    // Process each user
    for (const dbUser of dbUsers) {
      try {
        // Try to get user from Clerk
        try {
          await ClerkService.getUser(dbUser.clerkId);
          // If successful, user still exists in Clerk, skip to next
          continue;
        } catch (error: any) {
          // If error is not 404, skip this user
          if (error?.status !== 404) {
            console.warn(`Unexpected error checking Clerk user ${dbUser.clerkId}:`, error);
            continue;
          }
          // If 404, user is deleted in Clerk, proceed with cleanup
        }

        console.log(`Cleaning up deleted user: ${dbUser.username} (${dbUser.clerkId})`);

        // Delete user's lists
        const deleteListsResult = await ListModel.deleteMany({ userId: dbUser._id });
        stats.deletedLists += deleteListsResult.deletedCount;

        // Update collaborator records to remove user from lists
        const collaboratorUpdateResult = await ListModel.updateMany(
          { 'collaborators.clerkId': dbUser.clerkId },
          { 
            $pull: { 
              collaborators: { clerkId: dbUser.clerkId }
            }
          }
        );
        stats.updatedCollaborations += collaboratorUpdateResult.modifiedCount;

        // Delete user's profile
        const deleteProfileResult = await UserProfileModel.deleteOne({ userId: dbUser._id });
        if (deleteProfileResult.deletedCount > 0) stats.deletedProfiles++;

        // Delete user's follows (both as follower and following)
        const deleteFollowsResult = await FollowModel.deleteMany({
          $or: [
            { followerId: dbUser._id },
            { followingId: dbUser._id }
          ]
        });
        stats.deletedFollows += deleteFollowsResult.deletedCount;

        // Finally, delete the user
        await UserModel.deleteOne({ _id: dbUser._id });
        stats.deletedUsers++;

      } catch (error) {
        console.error(`Error processing user ${dbUser.clerkId}:`, error);
      }
    }

    // Log cleanup results
    console.log('Cleanup completed. Results:', {
      deletedUsers: stats.deletedUsers,
      deletedProfiles: stats.deletedProfiles,
      deletedLists: stats.deletedLists,
      updatedCollaborations: stats.updatedCollaborations,
      deletedFollows: stats.deletedFollows
    });

  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// If running directly (not imported)
if (require.main === module) {
  cleanupDeletedUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error during cleanup:', error);
      process.exit(1);
    });
}

export { cleanupDeletedUsers }; 