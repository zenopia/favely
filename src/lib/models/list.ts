import mongoose, { Schema } from 'mongoose';
import type { ListDocument } from '@/lib/db/models-v2/list';

const listSchema = new Schema<ListDocument>({
  title: { type: String, required: true },
  description: { type: String },
  category: { 
    type: String, 
    required: true, 
    enum: ['movies', 'tv-shows', 'books', 'restaurants', 'recipes', 'things-to-do', 'other'],
    default: 'movies'
  },
  privacy: { 
    type: String, 
    required: true, 
    enum: ['public', 'private'],
    default: 'public'
  },
  listType: {
    type: String,
    required: true,
    enum: ['ordered', 'bullet'],
    default: 'bullet'
  },
  owner: {
    userId: { type: Schema.Types.ObjectId, required: true },
    clerkId: { type: String, required: true },
    username: { type: String, required: true },
    joinedAt: { type: Date, required: true }
  },
  collaborators: [{
    userId: Schema.Types.ObjectId,
    clerkId: String,
    username: String,
    email: String,
    role: {
      type: String,
      enum: ['admin', 'editor', 'viewer']
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected']
    },
    invitedAt: Date,
    acceptedAt: Date
  }],
  items: [{
    title: String,
    comment: String,
    completed: Boolean,
    properties: [{
      type: String,
      tag: String,
      value: String
    }]
  }],
  stats: {
    viewCount: { type: Number, default: 0 },
    pinCount: { type: Number, default: 0 },
    copyCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

export const ListModel = mongoose.models.List || mongoose.model<ListDocument>('List', listSchema); 