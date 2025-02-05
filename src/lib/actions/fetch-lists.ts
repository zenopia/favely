'use server';

import { getEnhancedLists, getPinnedLists, getSharedLists } from "./lists";

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

export async function fetchMorePinnedLists(
  userId: string,
  cursor?: string,
  sortOrder: 'newest' | 'oldest' = 'newest'
) {
  const result = await getPinnedLists(userId);
  return {
    ...result,
    lists: result.lists.sort((a, b) => {
      if (sortOrder === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
  };
}

export async function fetchMoreCollaboratedLists(
  userId: string,
  cursor?: string,
  sortOrder: 'newest' | 'oldest' = 'newest'
) {
  const result = await getSharedLists(userId);
  return {
    ...result,
    lists: result.lists.sort((a, b) => {
      if (sortOrder === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
  };
} 