import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { List } from "@/types/list";
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
    category: list.category,
    privacy: list.privacy,
    owner: {
      id: list.owner.userId.toString(),
      clerkId: list.owner.clerkId,
      username: list.owner.username,
      joinedAt: list.owner.joinedAt.toISOString()
    },
    items: list.items.map(item => ({
      id: crypto.randomUUID(),
      title: item.title,
      comment: item.comment,
      rank: item.rank,
      properties: item.properties?.map(prop => ({
        id: crypto.randomUUID(),
        type: prop.type,
        label: prop.label,
        value: prop.value
      }))
    })),
    stats: {
      viewCount: list.stats.viewCount,
      pinCount: list.stats.pinCount,
      copyCount: list.stats.copyCount
    },
    collaborators: list.collaborators?.map(collab => ({
      id: collab.clerkId,
      clerkId: collab.clerkId,
      username: collab.username,
      role: collab.role,
      status: collab.status,
      invitedAt: collab.invitedAt.toISOString(),
      acceptedAt: collab.acceptedAt?.toISOString()
    })),
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    editedAt: list.editedAt.toISOString()
  };
}

export function formatDate(input: string | number | Date): string {
  const date = new Date(input);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(input: string | number | Date): string {
  const date = new Date(input);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

export function absoluteUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL}${path}`;
}

export function serializeLists(lists: MongoListDocument[]): List[] {
  return lists.map(serializeList);
}

export function serializeUser(user: MongoUserDocument | null) {
  if (!user) return null;

  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.profile.displayName,
    bio: user.profile.bio,
    location: user.profile.location,
    dateOfBirth: user.profile.dateOfBirth,
    gender: user.profile.gender,
    livingStatus: user.profile.livingStatus,
    privacySettings: user.profile.privacySettings,
    followersCount: user.stats.followersCount,
    followingCount: user.stats.followingCount,
    listCount: user.stats.listCount,
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