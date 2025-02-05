'use client';

import { MyListsLayout } from "@/components/lists/my-lists-layout";
import { EnhancedList } from "@/types/list";
import { fetchMoreLists } from "@/lib/actions/fetch-lists";

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
}

export function ListsPageClient({
  initialLists,
  nextCursor,
  hasMore,
  userId,
  sortOrder,
  initialUser
}: ListsPageClientProps) {
  return (
    <MyListsLayout 
      lists={initialLists}
      nextCursor={nextCursor}
      hasMore={hasMore}
      fetchMore={(cursor) => fetchMoreLists(userId, cursor, sortOrder)}
      initialUser={initialUser}
    />
  );
} 