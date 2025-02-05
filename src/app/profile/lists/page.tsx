import { redirect } from "next/navigation";
import { AuthService } from "@/lib/services/auth.service";
import { getEnhancedLists } from "@/lib/actions/lists";
import { ListsPageClient } from "./lists-page-client";
import { ListCategory } from "@/types/list";
import { fetchMoreLists } from "@/lib/actions/fetch-lists";

interface PageProps {
  searchParams: {
    q?: string;
    category?: ListCategory;
    sort?: string;
  };
}

export default async function ProfileListsPage({ searchParams }: PageProps) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  try {
    // Get initial page of lists
    const { lists: initialLists, nextCursor, hasMore } = await getEnhancedLists(
      { 'owner.clerkId': user.id },
      {
        sort: {
          _id: -1, // Always sort by _id for cursor pagination
          ...(searchParams.sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 })
        }
      },
      undefined,
      20
    );

    return (
      <ListsPageClient 
        initialLists={initialLists}
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
        pageType="owned"
      />
    );
  } catch (error) {
    console.error('Error loading profile lists page:', error);
    return (
      <div className="p-4">
        <p className="text-red-500">Error loading lists. Please try again later.</p>
      </div>
    );
  }
} 