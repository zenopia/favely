import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const files = [
  'src/app/api/users/followers/route.ts',
  'src/app/api/users/[username]/following/route.ts',
  'src/app/api/users/following/route.ts',
  'src/app/api/lists/[listId]/collaborators/[userId]/route.ts',
  'src/scripts/cleanup/deleted-users.ts',
  'src/scripts/migrations/add-user-image-urls.ts',
  'src/lib/actions/lists.ts'
];

function updateImports(content: string): string {
  // Replace @clerk/backend imports with @clerk/nextjs/server
  return content.replace(
    /import\s*{\s*([^}]*clerkClient[^}]*)\s*}\s*from\s*["']@clerk\/backend["']/g,
    'import { $1 } from "@clerk/nextjs/server"'
  );
}

// Process each file
for (const file of files) {
  try {
    const filePath = join(process.cwd(), file);
    const content = readFileSync(filePath, 'utf8');
    const updatedContent = updateImports(content);
    writeFileSync(filePath, updatedContent);
    console.log(`Updated ${file}`);
  } catch (error) {
    console.error(`Error processing ${file}:`, error);
  }
}

console.log('Import updates complete!'); 