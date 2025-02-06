import { redirect } from "next/navigation";
import { getPinnedLists } from "@/lib/actions/lists";
import { ListCategory } from "@/types/list";
import { ListsPageClient } from "../lists-page-client";
import { AuthServerService } from "@/lib/services/auth.server";

interface PageProps {
  searchParams: {
    q?: string;
    category?: ListCategory;
    sort?: string;
  };
}

export default async function PinnedListsPage({ searchParams }: PageProps) {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  try {
    // Get initial page of pinned lists
    const { lists: initialLists, nextCursor, hasMore } = await getPinnedLists(user.id);

    // Sort lists if needed
    const sortedLists = [...initialLists].sort((a, b) => {
      if (searchParams.sort === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return (
      <ListsPageClient 
        initialLists={sortedLists}
        nextCursor={nextCursor}
        hasMore={hasMore}
        userId={user.id}
        sortOrder={searchParams.sort === 'oldest' ? 'oldest' : 'newest'}
        initialUser={{
          id: user.id,
          username: user.username || null,
          fullName: user.fullName || null,
          imageUrl: user.imageUrl || "",
        }}
        pageType="pinned"
      />
    );
  } catch (error) {
    console.error('Error loading pinned lists page:', error);
    return (
      <div className="p-4">
        <p className="text-red-500">Error loading pinned lists. Please try again later.</p>
      </div>
    );
  }
} 