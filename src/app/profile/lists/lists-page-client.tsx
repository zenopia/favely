'use client';

import { MyListsLayout } from "@/components/lists/my-lists-layout";
import { EnhancedList } from "@/types/list";
import { fetchMoreLists, fetchMorePinnedLists, fetchMoreCollaboratedLists } from "@/lib/actions/fetch-lists";

interface ListsPageClientProps {
  initialLists: EnhancedList[];
  nextCursor?: string;
  hasMore: boolean;
  userId: string;
  sortOrder: 'newest' | 'oldest';
  initialUser: {
    id: string;
    username: string | null;
    fullName: string | null;
    imageUrl: string;
  };
  pageType?: 'owned' | 'pinned' | 'collab';
}

export function ListsPageClient({
  initialLists,
  nextCursor,
  hasMore,
  userId,
  sortOrder,
  initialUser,
  pageType = 'owned'
}: ListsPageClientProps) {
  const getFetchFunction = () => {
    switch (pageType) {
      case 'pinned':
        return (cursor?: string) => fetchMorePinnedLists(userId, cursor, sortOrder);
      case 'collab':
        return (cursor?: string) => fetchMoreCollaboratedLists(userId, cursor, sortOrder);
      default:
        return (cursor?: string) => fetchMoreLists(userId, cursor, sortOrder);
    }
  };

  return (
    <MyListsLayout 
      lists={initialLists}
      nextCursor={nextCursor}
      hasMore={hasMore}
      fetchMore={getFetchFunction()}
      initialUser={initialUser}
    />
  );
} 