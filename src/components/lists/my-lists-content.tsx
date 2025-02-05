"use client";

import { ListGrid } from "@/components/lists/list-grid";
import { ListTabs } from "@/components/layout/nav/list-tabs";
import { CreateListFAB } from "@/components/layout/FABs/create-list-fab";
import type { EnhancedList } from "@/types/list";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Spinner } from "@/components/ui/spinner";

interface MyListsContentProps {
  initialLists: EnhancedList[];
  initialCursor?: string;
  initialHasMore: boolean;
  fetchMore: (cursor?: string) => Promise<{
    lists: EnhancedList[];
    nextCursor?: string;
    hasMore: boolean;
  }>;
}

export function MyListsContent({ 
  initialLists,
  initialCursor,
  initialHasMore,
  fetchMore
}: MyListsContentProps) {
  const { 
    data: lists,
    isLoading,
    hasMore,
    loadingRef
  } = useInfiniteScroll({
    initialData: initialLists,
    initialCursor,
    initialHasMore,
    fetchMore: async (cursor) => {
      const result = await fetchMore(cursor);
      return {
        data: result.lists,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore
      };
    }
  });

  return (
    <div className="relative">
      <ListTabs />
      <div className="px-4 md:px-6 lg:px-8 pt-4 pb-20 sm:pb-8">
        <div className="max-w-7xl mx-auto">
          <ListGrid lists={lists} />
          {hasMore && (
            <div 
              ref={loadingRef}
              className="flex justify-center py-4"
            >
              {isLoading && <Spinner />}
            </div>
          )}
        </div>
      </div>
      <CreateListFAB />
    </div>
  );
} 