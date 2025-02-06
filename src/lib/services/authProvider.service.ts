// Clerk is a service that provides a client for the Clerk API.
import { clerkClient as createClerkClient } from "@clerk/nextjs/server";
import type { ClerkUser as User } from "@clerk/nextjs/server";

// Type definition for paginated responses
interface PaginatedResponse<T> {
  data: T[];
  total_count: number;
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

// In-memory cache for server
const userCache = new Map<string, CacheEntry<User>>();
const userListCache = new Map<string, CacheEntry<User[]>>();

export class ClerkService {
  private static getClient() {
    return createClerkClient();
  }

  /**
   * Get a single user by ID with caching
   */
  static async getUser(userId: string): Promise<User | null> {
    // Check cache first
    const cached = userCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const user = await this.getClient().users.getUser(userId);
      // Update cache
      userCache.set(userId, { data: user, timestamp: Date.now() });
      return user;
    } catch (error: any) {
      if (error?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get multiple users by IDs with caching
   */
  static async getUserList(userIds: string[]): Promise<User[]> {
    // Create a cache key from sorted userIds to ensure consistent caching
    const cacheKey = userIds.slice().sort().join(',');
    
    // Check cache first
    const cached = userListCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const response = await this.getClient().users.getUserList({
      userId: userIds,
    }) as User[] | PaginatedResponse<User>;

    // Handle both array and paginated response
    const users = Array.isArray(response) ? response : response.data;
    
    // Update cache
    userListCache.set(cacheKey, { data: users, timestamp: Date.now() });
    
    return users;
  }

  /**
   * Get a user by username
   */
  static async getUserByUsername(username: string): Promise<User | null> {
    try {
      const users = await this.getClient().users.getUserList({
        username: [username],
      });
      return (Array.isArray(users) ? users[0] : users.data[0]) || null;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  /**
   * Get a user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    try {
      const users = await this.getClient().users.getUserList({
        emailAddress: [email],
      });
      return (Array.isArray(users) ? users[0] : users.data[0]) || null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  /**
   * Clear all caches
   */
  static clearCache() {
    userCache.clear();
    userListCache.clear();
  }
} 