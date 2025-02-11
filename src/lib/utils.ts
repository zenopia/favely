import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { List, ListCategory } from "@/types/list";
import type { MongoListDocument, MongoUserDocument } from "@/types/mongo";
import type { UserProfileDocument } from "@/lib/db/models-v2/user-profile";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function serializeList(list: MongoListDocument): List {
  return {
    id: list._id.toString(),
    title: list.title,
    description: list.description,
    category: list.category as ListCategory,
    privacy: list.privacy,
    listType: list.listType || 'ordered',
    owner: {
      id: list.owner.userId.toString(),
      clerkId: list.owner.clerkId,
      username: list.owner.username,
      joinedAt: list.owner.joinedAt?.toISOString() || new Date().toISOString()
    },
    items: (list.items || []).map(item => ({
      id: crypto.randomUUID(),
      title: item.title,
      comment: item.comment,
      properties: item.properties?.map(prop => ({
        id: crypto.randomUUID(),
        type: (prop.type || 'text') as 'text' | 'link',
        tag: prop.tag,
        value: prop.value
      }))
    })),
    stats: {
      viewCount: list.stats?.viewCount || 0,
      pinCount: list.stats?.pinCount || 0,
      copyCount: list.stats?.copyCount || 0
    },
    collaborators: list.collaborators?.map(collab => ({
      id: collab.userId?.toString() || collab.clerkId || crypto.randomUUID(),
      clerkId: collab.clerkId || '',
      username: collab.username || '',
      role: collab.role,
      status: collab.status,
      invitedAt: collab.invitedAt.toISOString(),
      acceptedAt: collab.acceptedAt?.toISOString()
    })),
    createdAt: list.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: list.updatedAt?.toISOString() || new Date().toISOString(),
    editedAt: list.editedAt?.toISOString()
  };
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function serializeLists(lists: MongoListDocument[]): List[] {
  return lists.map(serializeList);
}

export function serializeUser(user: MongoUserDocument | null) {
  if (!user) return null;

  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    location: user.location,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    livingStatus: user.livingStatus,
    privacySettings: user.privacySettings,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    listCount: user.listCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function isProfileComplete(profile: Partial<UserProfileDocument> | null): boolean {
  if (!profile) return false;
  
  const requiredFields = ['location', 'dateOfBirth', 'gender', 'livingStatus'];
  return requiredFields.every(field => profile[field as keyof typeof profile] !== undefined && profile[field as keyof typeof profile] !== null && profile[field as keyof typeof profile] !== '');
}

export function formatDisplayName(firstName: string | null | undefined, lastName: string | null | undefined, username: string): string {
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return fullName || username;
}

/**
 * Detects URLs in text and wraps them in anchor tags that open in a new tab
 */
export function wrapUrlsInAnchors(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${url}</a>`;
  });
} 