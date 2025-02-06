import { z } from 'zod';
import type { ListCategory, ListPrivacy } from '@/types/list';

export const itemPropertySchema = z.object({
  id: z.string().optional(),
  type: z.enum(['text', 'link']),
  label: z.string().min(1, 'Label is required').max(50, 'Label is too long'),
  value: z.string().min(1, 'Value is required').max(500, 'Value is too long')
});

export const listItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  comment: z.string().max(1000, 'Comment is too long').optional(),
  properties: z.array(itemPropertySchema).optional()
});

export const listSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title is too long'),
  category: z.enum(['movies', 'tv-shows', 'books', 'restaurants', 'recipes', 'things-to-do', 'other'] as const) satisfies z.ZodType<ListCategory>,
  description: z.string().max(500, 'Description is too long').optional(),
  privacy: z.enum(['public', 'private'] as const) satisfies z.ZodType<ListPrivacy>,
  listType: z.enum(['ordered', 'bullet']).default('ordered'),
  items: z.array(listItemSchema)
    .min(1, 'List must have at least one item')
    .max(100, 'List cannot have more than 100 items'),
  ownerId: z.string(),
  ownerName: z.string(),
  ownerImageUrl: z.string().url().optional()
});

export const userProfileSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot be longer than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string().email('Invalid email address'),
  bio: z.string().max(500, 'Bio cannot be longer than 500 characters').optional(),
  location: z.string().max(100, 'Location cannot be longer than 100 characters').optional(),
  dateOfBirth: z.date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  livingStatus: z.enum(['alive', 'deceased']).optional(),
  privacySettings: z.object({
    showEmail: z.boolean(),
    showLocation: z.boolean(),
    showDateOfBirth: z.boolean()
  })
});

export type ListSchemaType = z.infer<typeof listSchema>;
export type UserProfileSchemaType = z.infer<typeof userProfileSchema>; 