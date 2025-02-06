"use client";

import useSWR from "swr";

interface UserData {
  id: string;
  username: string;
  displayName: string;
  imageUrl: string | null;
}

interface UserResponse {
  id: string;
  username: string;
  displayName: string;
  imageUrl: string | null;
}

interface UseUsersReturn {
  data: UserData[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

// Cache for storing user data
const userCache = new Map<string, { data: UserData; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute cache duration

// Function to get cached and missing users
function getCachedAndMissingUsers(userIdentifiers: string[]) {
  const now = Date.now();
  const cachedUsers: UserData[] = [];
  const missingUserIds: string[] = [];

  userIdentifiers.forEach(id => {
    const cached = userCache.get(id);
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      cachedUsers.push(cached.data);
    } else {
      missingUserIds.push(id);
    }
  });

  return { cachedUsers, missingUserIds };
}

// Type the fetcher to ensure it always returns UserData[]
const fetcher = async (key: string): Promise<UserData[]> => {
  const userIdentifiers = JSON.parse(key) as string[];
  
  // Get cached users and identify missing ones
  const { cachedUsers, missingUserIds } = getCachedAndMissingUsers(userIdentifiers);
  
  // If all users are cached, return them
  if (missingUserIds.length === 0) {
    return cachedUsers;
  }

  // Fetch only the missing users
  const response = await fetch('/api/users/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userIds: missingUserIds }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  const users = (await response.json()) as UserResponse[];
  
  // Transform and cache the new users
  const now = Date.now();
  const transformedUsers = users.map((user: UserResponse): UserData => {
    const userData: UserData = {
      id: user.id,
      username: user.username || '',
      displayName: user.displayName || user.username || '',
      imageUrl: user.imageUrl
    };
    
    // Cache the user data
    userCache.set(user.id, { data: userData, timestamp: now });
    
    return userData;
  });

  // Create a map for quick lookup of newly fetched users
  const userMap = new Map<string, UserData>(
    transformedUsers.map((user: UserData): [string, UserData] => [user.id, user])
  );

  // Combine cached and newly fetched users in the original order
  return userIdentifiers.map(id => {
    const cached = userCache.get(id);
    if (cached) {
      return cached.data;
    }
    const fetched = userMap.get(id);
    if (!fetched) {
      // If a user is not found, return a placeholder to maintain array length
      return {
        id,
        username: 'Unknown User',
        displayName: 'Unknown User',
        imageUrl: null
      };
    }
    return fetched;
  });
};

export function useUsers(userIdentifiers?: string[]): UseUsersReturn {
  const { data, error, isLoading } = useSWR<UserData[]>(
    userIdentifiers?.length ? JSON.stringify(userIdentifiers) : null,
    fetcher,
    {
      revalidateOnFocus: false, // Disable revalidation on window focus
      revalidateOnReconnect: false, // Disable revalidation on reconnect
      dedupingInterval: 30000, // Dedupe requests within 30 seconds
    }
  );

  return {
    data,
    isLoading,
    error: error as Error | null
  };
} 