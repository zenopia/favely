import { z } from 'zod';

export const searchParamsSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  pageSize: z.coerce.number().min(1).max(100).optional().default(20),
  sort: z.enum(['newest', 'oldest', 'most-viewed']).optional(),
  category: z.string().optional(),
});

export const listCreateSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string(),
  visibility: z.enum(['public', 'private']),
  items: z.array(z.object({
    title: z.string().min(1).max(100),
    comment: z.string().max(500).optional(),
    properties: z.array(z.object({
      type: z.string(),
      label: z.string(),
      value: z.string()
    })).optional()
  }))
});

export type CreateListInput = z.infer<typeof listCreateSchema>;

export const listUpdateSchema = listCreateSchema.partial();

export const profileUpdateSchema = z.object({
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say']).optional(),
  livingStatus: z.enum(['single', 'couple', 'family', 'shared', 'other']).optional(),
  privacySettings: z.object({
    showBio: z.boolean(),
    showLocation: z.boolean(),
    showPersonalDetails: z.boolean()
  }).optional()
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>; 