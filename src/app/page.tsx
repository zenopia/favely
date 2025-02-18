import { MainLayout } from "@/components/layout/main-layout";
import { ListGrid } from "@/components/lists/list-grid";
import { ListTabs } from "@/components/layout/nav/list-tabs";
import { getEnhancedLists } from "@/lib/actions/lists";
import { CreateListFAB } from "@/components/layout/FABs/create-list-fab";
import { SessionRedirect } from "@/components/home/session-redirect";
import { FilterQuery } from "mongoose";
import type { MongoListDocument } from "@/types/mongo";
import type { ListCategory } from "@/types/list";

interface SearchParams {
  q?: string;
  category?: ListCategory;
  sort?: string;
}

interface PageProps {
  searchParams: SearchParams;
}

export default async function HomePage({ searchParams }: PageProps) {
  // Build filter
  const filter: FilterQuery<MongoListDocument> = {
    visibility: 'public',
    ...(searchParams.q ? {
      $text: { $search: searchParams.q }
    } : {}),
    ...(searchParams.category ? { category: searchParams.category } : {})
  };

  // Get enhanced lists with owner data and last viewed timestamps
  const { lists: unsortedLists, lastViewedMap } = await getEnhancedLists(filter, {
    ...(searchParams.q ? {
      score: { $meta: 'textScore' },
      sort: { score: { $meta: 'textScore' } }
    } : {})
  });

  // Only apply manual sort if no search query (text search already sorts by relevance)
  const sortedLists = searchParams.q ? unsortedLists : [...unsortedLists].sort((a, b) => {
    switch (searchParams.sort) {
      case 'views':
        return (b.stats.viewCount || 0) - (a.stats.viewCount || 0);
      case 'pins':
        return (b.stats.pinCount || 0) - (a.stats.pinCount || 0);
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      default: // newest
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  return (
    <MainLayout>
      <SessionRedirect />
      <div className="relative">
        <ListTabs />
        <div className="px-4 md:px-6 lg:px-8 pt-4 pb-20 sm:pb-8">
          <div className="max-w-7xl mx-auto">
            <ListGrid 
              lists={sortedLists}
              searchParams={searchParams}
              lastViewedMap={lastViewedMap}
              showSearch
            />
          </div>
        </div>
        <CreateListFAB />
      </div>
    </MainLayout>
  );
}
