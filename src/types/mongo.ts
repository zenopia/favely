import type { Types } from 'mongoose';
import type { ListCategory, ListType } from './list';

export interface MongoListDocument {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  category: string;
  visibility: 'public' | 'private' | 'unlisted';
  listType: 'ordered' | 'bullet';
  owner: {
    userId: Types.ObjectId;
    clerkId: string;
    username: string;
    joinedAt: Date;
  };
  collaborators?: Array<{
    userId?: Types.ObjectId;
    clerkId?: string;
    username?: string;
    email?: string;
    role: 'admin' | 'editor' | 'viewer';
    status: 'pending' | 'accepted' | 'rejected';
    invitedAt: Date;
    acceptedAt?: Date;
  }>;
  items?: Array<{
    title: string;
    comment?: string;
    completed?: boolean;
    rank?: number;
    properties?: Array<{
      type?: string;
      tag?: string;
      value: string;
    }>;
  }>;
  stats?: {
    viewCount: number;
    pinCount: number;
    copyCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
}

export interface MongoUserDocument {
  _id: Types.ObjectId;
  clerkId: string;
  username: string;
  displayName: string;
  bio?: string;
  location?: string;
  dateOfBirth?: Date;
  gender?: string;
  livingStatus?: string;
  privacySettings: {
    showDateOfBirth: boolean;
    showGender: boolean;
    showLivingStatus: boolean;
  };
  followersCount: number;
  followingCount: number;
  listCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoFollowDocument {
  _id: Types.ObjectId;
  followerId: string;
  followingId: string;
  status: 'pending' | 'accepted';
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoPinDocument {
  _id: Types.ObjectId;
  userId: string;
  listId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoListFilter {
  'owner.clerkId'?: string;
  'owner.userId'?: string;
  'collaborators.userId'?: string;
  'collaborators.clerkId'?: string;
  category?: ListCategory;
  visibility?: 'public' | 'private' | 'unlisted';
} 