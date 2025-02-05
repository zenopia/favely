"use client";

import { ProtectedPageWrapper } from "@/components/auth/protected-page-wrapper";
import { EnhancedList } from "@/types/list";
import { MyListsContent } from "@/components/lists/my-lists-content";

interface MyListsLayoutProps {
  lists: EnhancedList[];
  nextCursor?: string;
  hasMore: boolean;
  fetchMore: (cursor: string) => Promise<{
    lists: EnhancedList[];
    nextCursor?: string;
    hasMore: boolean;
  }>;
  initialUser: {
    id: string;
    username: string | null;
    fullName: string | null;
    imageUrl: string;
  };
}

export function MyListsLayout({ 
  lists: initialLists,
  nextCursor: initialCursor,
  hasMore: initialHasMore,
  fetchMore,
  initialUser 
}: MyListsLayoutProps) {
  return (
    <ProtectedPageWrapper 
      initialUser={initialUser}
      layoutType="main"
      title="My Lists"
    >
      <MyListsContent 
        initialLists={initialLists}
        initialCursor={initialCursor}
        initialHasMore={initialHasMore}
        fetchMore={fetchMore}
      />
    </ProtectedPageWrapper>
  );
} 