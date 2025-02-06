import { clerkClient as createClerkClient } from "@clerk/nextjs/server";
import connectToDatabase from "@/lib/db/mongodb";
import { getUserModel } from "@/lib/db/models-v2/user";
import * as dotenv from 'dotenv';
import path from 'path';
import { ClerkService } from "@/lib/services/authProvider.service";

// Determine which env file to use
const envFile = process.env.ENV_FILE || '.env.local';
const envPath = path.resolve(process.cwd(), envFile);

console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

// Get the client instance
const clerkClient = createClerkClient();

async function migrateUserImageUrls() {
  try {
    console.log('Starting user image URL migration...');
    
    // Verify environment variables
    const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URI_V2;
    if (!mongoUri) {
      throw new Error('MongoDB URI environment variable (MONGODB_URI or MONGODB_URI_V2) is not set');
    }
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY environment variable is not set');
    }

    console.log('Using MongoDB URI:', mongoUri.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, 'mongodb+srv://[hidden]@'));
    
    // Connect to MongoDB
    const connection = await connectToDatabase();
    const UserModel = await getUserModel();
    
    // Get all users from our database
    const dbUsers = await UserModel.find({}).lean();
    console.log(`Found ${dbUsers.length} users in database`);
    
    // Track migration statistics
    const stats = {
      total: dbUsers.length,
      updated: 0,
      failed: 0,
      notFound: 0
    };

    // Process users in batches of 50 to avoid rate limits
    const batchSize = 50;
    for (let i = 0; i < dbUsers.length; i += batchSize) {
      const batch = dbUsers.slice(i, i + batchSize);
      const clerkIds = batch.map(user => user.clerkId);
      
      try {
        // Fetch users from Clerk
        const clerkUsers = await clerkClient.users.getUserList({
          userId: clerkIds,
        });

        // Create a map of Clerk users for quick lookup
        const clerkUserMap = new Map(
          // Handle both array and paginated response
          (Array.isArray(clerkUsers) ? clerkUsers : clerkUsers.data).map((u: any) => [u.id, u])
        );

        // Update users with image URLs
        const bulkOps = batch.map((user) => ({
          updateOne: {
            filter: { _id: user._id },
            update: {
              $set: {
                imageUrl: (clerkUserMap.get(user.clerkId) as { imageUrl?: string } | undefined)?.imageUrl ?? null,
              }
            }
          }
        }));

        if (bulkOps.length > 0) {
          await UserModel.bulkWrite(bulkOps);
          console.log(`Updated ${bulkOps.length} users with image URLs`);
          stats.updated += bulkOps.length;
        }
        
        // Log progress
        console.log(`Processed ${Math.min(i + batchSize, dbUsers.length)}/${dbUsers.length} users`);
        
        // Add a small delay between batches to avoid rate limits
        if (i + batchSize < dbUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error processing batch starting at index ${i}:`, error);
        stats.failed += batch.length;
      }
    }

    // Log final statistics
    console.log('\nMigration completed:');
    console.log(`Total users: ${stats.total}`);
    console.log(`Successfully updated: ${stats.updated}`);
    console.log(`Not found in Clerk: ${stats.notFound}`);
    console.log(`Failed to update: ${stats.failed}`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Ensure the process exits
    process.exit(0);
  }
}

// Run the migration
migrateUserImageUrls(); 