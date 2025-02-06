import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const files = [
  'src/lib/auth.ts',
  'src/app/api/profile/route.ts',
  'src/app/api/users/following/route.ts',
  'src/app/api/users/[username]/follow/route.ts',
  'src/app/api/users/search/route.ts',
  'src/app/api/users/[username]/follow/status/route.ts',
  'src/app/api/[username]/lists/[listId]/items/[itemId]/route.ts',
  'src/app/profile/page.tsx',
  'src/app/api/lists/[listId]/route.ts',
  'src/app/profile/settings/page.tsx',
  'src/app/profile/lists/page.tsx',
  'src/app/api/lists/[listId]/pin/route.ts',
  'src/app/profile/[username]/page.tsx',
  'src/app/profile/lists/shared/page.tsx',
  'src/app/api/lists/[listId]/collaborators/route.ts',
  'src/app/profile/lists/create/page.tsx',
  'src/app/profile/lists/collab/page.tsx',
  'src/app/api/lists/[listId]/collaborators/[userId]/route.ts',
  'src/app/profile/lists/pinned/page.tsx',
  'src/app/profile/[username]/following/page.tsx',
  'src/app/profile/[username]/followers/page.tsx',
  'src/app/profile/lists/edit/[listId]/page.tsx',
  'src/app/feedback/page.tsx',
  'src/app/(protected)/dashboard/page.tsx',
  'src/lib/actions/users.ts',
  'src/lib/actions/user.ts',
  'src/lib/actions/lists.ts',
  'src/lib/actions/list.ts',
  'src/lib/services/__tests__/auth.service.perf.test.ts',
  'src/app/lists/[listId]/items/[itemId]/page.tsx',
  'src/lib/auth/list-auth.ts'
];

function updateImports(content: string): string {
  // Add AuthServerService import if it's not already there
  if (!content.includes('AuthServerService')) {
    const importStatement = `import { AuthServerService } from "@/lib/services/auth.server";`;
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

  // Replace AuthService with AuthServerService for server-side methods
  content = content.replace(/AuthService\.getCurrentUser/g, 'AuthServerService.getCurrentUser');
  content = content.replace(/AuthService\.getUserBy/g, 'AuthServerService.getUserBy');
  content = content.replace(/AuthService\.getUsersBy/g, 'AuthServerService.getUsersBy');

  return content;
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

console.log('Migration complete!'); 