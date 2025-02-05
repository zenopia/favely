'use server';

import { getEnhancedLists } from "./lists";

export async function fetchMoreLists(
  userId: string,
  cursor?: string,
  sortOrder: 'newest' | 'oldest' = 'newest'
) {
  return getEnhancedLists(
    { 'owner.clerkId': userId },
    {
      sort: {
        _id: -1,
        ...(sortOrder === 'oldest' ? { createdAt: 1 } : { createdAt: -1 })
      }
    },
    cursor,
    20
  );
} 