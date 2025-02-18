export type ListCategory = 
  | 'movies' 
  | 'tv-shows' 
  | 'books' 
  | 'restaurants' 
  | 'recipes' 
  | 'things-to-do' 
  | 'other' 
  | 'all';

export const LIST_CATEGORIES: ListCategory[] = [
  'movies',
  'tv-shows',
  'books',
  'restaurants',
  'recipes',
  'things-to-do',
  'other'
];

export const PRIVACY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'private', label: 'Private' }
] as const;

export const OWNER_FILTER_OPTIONS = [
  { value: 'all', label: 'All Lists' },
  { value: 'owned', label: 'My Lists' },
  { value: 'collaborated', label: 'Collaborated Lists' }
] as const;

export type ListVisibility = 'public' | 'unlisted' | 'private';
export type ListType = 'ordered' | 'bullet';

export interface ListItem {
  id: string;
  title: string;
  comment?: string;
  completed?: boolean;
  childItems?: Array<{
    title: string;
    tag?: string;
  }>;
}

export interface ListOwner {
  id: string;
  clerkId: string;
  username: string;
  displayName?: string;
  imageUrl?: string | null;
  joinedAt: string;
}

export interface ListCollaborator {
  id: string;
  clerkId: string;
  username: string;
  email?: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'rejected';
  invitedAt: string;
  acceptedAt?: string;
}

export interface ListStats {
  viewCount: number;
  pinCount: number;
  copyCount: number;
}

export interface List {
  id: string;
  title: string;
  description?: string;
  category: ListCategory;
  visibility: ListVisibility;
  listType: ListType;
  owner: ListOwner;
  items?: ListItem[];
  stats: ListStats;
  collaborators?: ListCollaborator[];
  lastEditedAt?: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  isPinned?: boolean;
}

export interface ItemDetails {
  title: string;
  comment?: string;
  properties?: Array<{
    id?: string;
    type?: 'text' | 'link';
    tag?: string;
    value: string;
  }>;
}

export interface EnhancedListOwner extends ListOwner {
  displayName: string;
  imageUrl: string | null;
}

export interface EnhancedList extends Omit<List, 'owner'> {
  owner: EnhancedListOwner;
  isPinned?: boolean;
}
