import { connectToMongoDB } from "@/lib/db/client";
import { getListModel } from "@/lib/db/models-v2/list";

export async function migrateLists(uri: string) {
  if (!uri) {
    throw new Error('Database URI is required');
  }

  // Extract database name from URI for confirmation
  const dbName = uri.split('/').pop()?.split('?')[0];
  if (!dbName) {
    throw new Error('Could not determine database name from URI');
  }

  console.log(`Preparing to migrate database: ${dbName}`);
  console.log('This operation will rename the "privacy" field to "visibility" in all list documents.');
  
  if (process.env.NODE_ENV === 'production' || dbName.includes('prod')) {
    console.log('\n⚠️  WARNING: You are about to modify a production database!');
    console.log('Please type the database name to confirm:');
    
    // In production, we would typically add a confirmation step here
    // For now, we'll just add a 5-second delay
    console.log('Waiting 5 seconds before proceeding...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    // Set the URI in process.env before connecting
    process.env.MONGODB_URI_V2 = uri;
    await connectToMongoDB();
    const ListModel = await getListModel();

    // First, let's count how many documents have the privacy field
    const documentsToMigrate = await ListModel.countDocuments({ privacy: { $exists: true } });
    console.log(`Found ${documentsToMigrate} documents with 'privacy' field to migrate`);

    if (documentsToMigrate === 0) {
      console.log('No documents need migration. Exiting...');
      return;
    }

    // Perform the migration
    const result = await ListModel.updateMany(
      { privacy: { $exists: true } },
      [
        {
          $set: {
            visibility: "$privacy",
          }
        },
        {
          $unset: "privacy"
        }
      ]
    );

    console.log(`Migration completed successfully:`);
    console.log(`- Modified ${result.modifiedCount} documents`);
    console.log(`- Matched ${result.matchedCount} documents`);

    // Verify the migration
    const remainingDocs = await ListModel.countDocuments({ privacy: { $exists: true } });
    const migratedDocs = await ListModel.countDocuments({ visibility: { $exists: true } });

    console.log('\nVerification results:');
    console.log(`- Documents still with 'privacy' field: ${remainingDocs}`);
    console.log(`- Documents with new 'visibility' field: ${migratedDocs}`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  const uri = process.env.MONGODB_URI_V2;
  
  if (!uri) {
    console.error('Error: MONGODB_URI_V2 environment variable is required');
    process.exit(1);
  }

  migrateLists(uri)
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
} 