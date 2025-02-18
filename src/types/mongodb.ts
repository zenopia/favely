import type { ListCategory } from './list';

export interface MongoListDocument {
  _id: string;
  title: string;
  description?: string;
  category: ListCategory;
  visibility: 'public' | 'private';
  owner: {
    userId: string;
    clerkId: string;
    username: string;
    joinedAt: Date;
  };
  items: Array<{
    title: string;
    comment?: string;
    rank: number;
    properties?: Array<{
      type?: 'text' | 'link';
      label: string;
      value: string;
    }>;
  }>;
  stats: {
    viewCount: number;
    pinCount: number;
    copyCount: number;
  };
  collaborators?: Array<{
    userId: string;
    clerkId: string;
    username: string;
    email?: string;
    role: string;
    status: string;
    invitedAt: Date;
    acceptedAt?: Date;
  }>;
  lastEditedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoListFilter {
  'owner.clerkId'?: string;
  'owner.userId'?: string;
  'collaborators.userId'?: string;
  'collaborators.clerkId'?: string;
  category?: ListCategory;
  visibility?: 'public' | 'private';
}

export interface MongoSortOptions {
  createdAt?: 1 | -1;
  'stats.viewCount'?: 1 | -1;
  'stats.pinCount'?: 1 | -1;
  'stats.copyCount'?: 1 | -1;
  lastEditedAt?: 1 | -1;
}