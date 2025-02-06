import { auth as getAuth } from "@clerk/nextjs/server";
import { AuthUser } from "@/types/auth";
import connectToMongoDB from "@/lib/db/mongodb";
import { getUserModel } from "@/lib/db/models-v2/user";
import { ClerkService } from "./authProvider.service";

// Define projection for user queries to only select needed fields
const USER_PROJECTION = {
  clerkId: 1,
  email: 1,
  username: 1,
  displayName: 1,
  imageUrl: 1,
  _id: 0
};

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 100; // ms

const withRetry = async <T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * INITIAL_RETRY_DELAY));
    }
  }
  throw new Error('Max retries reached');
};

const transformUser = (user: any): AuthUser => ({
  id: user.clerkId,
  email: user.email || null,
  username: user.username,
  firstName: null,
  lastName: null,
  fullName: user.displayName,
  imageUrl: user.imageUrl,
});

export class AuthServerService {
  static async getCurrentUser(userId?: string | null): Promise<AuthUser | null> {
    // If userId is not provided, try to get it from auth context
    if (!userId) {
      try {
        const { userId: authUserId } = getAuth();
        userId = authUserId;
      } catch (error) {
        console.debug('Failed to get auth:', error);
        return null;
      }
    }

    if (!userId) return null;

    try {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne(
        { clerkId: userId },
        USER_PROJECTION
      ).lean();

      if (!user) {
        // If user not found in our DB, try to get from Clerk
        const clerkUser = await ClerkService.getUser(userId);
        if (clerkUser) {
          // Create user in our DB
          const newUser = (await UserModel.create({
            clerkId: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress,
            username: clerkUser.username || clerkUser.id,
            displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || '',
            imageUrl: clerkUser.imageUrl,
          })).toObject();
          return transformUser(newUser);
        }
      }
      
      return user ? transformUser(user) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async getUserByUsername(username: string): Promise<AuthUser | null> {
    return withRetry(async () => {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne(
        { username },
        USER_PROJECTION
      ).lean();

      if (!user) {
        // If user not found in our DB, try to get from Clerk
        const clerkUser = await ClerkService.getUserByUsername(username);
        if (clerkUser) {
          // Create user in our DB
          const newUser = await UserModel.create({
            clerkId: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress,
            username: clerkUser.username || clerkUser.id,
            displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || '',
            imageUrl: clerkUser.imageUrl,
          });
          return transformUser(newUser);
        }
      }
      
      return user ? transformUser(user) : null;
    });
  }

  static async getUserByClerkId(clerkId: string): Promise<AuthUser | null> {
    return withRetry(async () => {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne(
        { clerkId },
        USER_PROJECTION
      ).lean();

      if (!user) {
        // If user not found in our DB, try to get from Clerk
        const clerkUser = await ClerkService.getUser(clerkId);
        if (clerkUser) {
          // Create user in our DB
          const newUser = (await UserModel.create({
            clerkId: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress,
            username: clerkUser.username || clerkUser.id,
            displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || '',
            imageUrl: clerkUser.imageUrl,
          })).toObject();
          return transformUser(newUser);
        }
      }
      
      return user ? transformUser(user) : null;
    });
  }

  static async getUserById(userId: string): Promise<AuthUser | null> {
    return this.getUserByClerkId(userId);
  }

  static async getUserByEmail(email: string): Promise<AuthUser | null> {
    return withRetry(async () => {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const user = await UserModel.findOne(
        { email },
        USER_PROJECTION
      ).lean();

      if (!user) {
        // If user not found in our DB, try to get from Clerk
        const clerkUser = await ClerkService.getUserByEmail(email);
        if (clerkUser) {
          // Create user in our DB
          const newUser = await UserModel.create({
            clerkId: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress,
            username: clerkUser.username || clerkUser.id,
            displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || '',
            imageUrl: clerkUser.imageUrl,
          });
          return transformUser(newUser);
        }
      }
      
      return user ? transformUser(user) : null;
    });
  }

  static async getUsersByIds(userIds: string[]): Promise<AuthUser[]> {
    return withRetry(async () => {
      await connectToMongoDB();
      const UserModel = await getUserModel();
      const users = await UserModel.find(
        { clerkId: { $in: userIds } },
        USER_PROJECTION
      ).lean();

      // Find missing users
      const foundUserIds = new Set(users.map(u => u.clerkId));
      const missingUserIds = userIds.filter(id => !foundUserIds.has(id));

      if (missingUserIds.length > 0) {
        // Get missing users from Clerk
        const clerkUsers = await ClerkService.getUserList(missingUserIds);
        
        // Create missing users in our DB
        const newUsers = await Promise.all(
          clerkUsers.map(async clerkUser => {
            const doc = await UserModel.create({
              clerkId: clerkUser.id,
              email: clerkUser.emailAddresses[0]?.emailAddress,
              username: clerkUser.username || clerkUser.id,
              displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || '',
              imageUrl: clerkUser.imageUrl,
            });
            return doc.toObject();
          })
        );

        users.push(...(newUsers as any[]));
      }
      
      return users.map(transformUser);
    });
  }
} 