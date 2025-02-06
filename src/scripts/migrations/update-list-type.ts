import { config } from 'dotenv';
import path from 'path';
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel } from "@/lib/db/models-v2/list";

// Load environment variables based on NODE_ENV
const env = process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production' : '.env.development';
config({ path: path.resolve(process.cwd(), envFile) });

async function main() {
  try {
    console.log(`Starting migration in ${env} environment: Updating listType from "bullets" to "bullet"...`);
    
    // Connect to MongoDB
    await connectToMongoDB();
    const ListModel = await getListModel();
    
    // Update all documents that have listType 'bullets'
    const result = await ListModel.updateMany(
      { listType: 'bullets' },
      { $set: { listType: 'bullet' } }
    );
    
    console.log(`Migration complete! Updated ${result.modifiedCount} lists.`);
    console.log(`${result.matchedCount} lists matched the query.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main(); 