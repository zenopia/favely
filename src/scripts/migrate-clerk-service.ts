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

function updateClerkUsage(content: string): string {
  // Add ClerkService import if it's not already there
  if (!content.includes('ClerkService')) {
    const importStatement = `import { ClerkService } from "@/lib/services/clerk.service";`;
    if (content.includes('import')) {
      // Add after the last import
      const lines = content.split('\n');
      let lastImportIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import')) {
          lastImportIndex = i;
        }
      }
      if (lastImportIndex !== -1) {
        lines.splice(lastImportIndex + 1, 0, importStatement);
        content = lines.join('\n');
      }
    } else {
      // Add at the beginning of the file
      content = `${importStatement}\n${content}`;
    }
  }

  // Replace direct clerkClient usage with ClerkService
  content = content.replace(
    /clerkClient\.users\.getUser\((.*?)\)/g,
    'ClerkService.getUser($1)'
  );
  content = content.replace(
    /clerkClient\.users\.getUserList\((.*?)\)/g,
    'ClerkService.getUserList($1)'
  );

  // Remove clerkClient import if it's no longer used
  if (!content.includes('clerkClient.')) {
    content = content.replace(/import\s*{\s*([^}]*clerkClient[^}]*)\s*}\s*from\s*["']@clerk\/nextjs\/server["'];?\n?/g, '');
  }

  return content;
}

// Process each file
for (const file of files) {
  try {
    const filePath = join(process.cwd(), file);
    const content = readFileSync(filePath, 'utf8');
    const updatedContent = updateClerkUsage(content);
    writeFileSync(filePath, updatedContent);
    console.log(`Updated ${file}`);
  } catch (error) {
    console.error(`Error processing ${file}:`, error);
  }
}

console.log('Migration to ClerkService complete!'); 