import mongoose, { Schema, Document } from 'mongoose';
import connectToDatabase from '../mongodb';
import { LIST_CATEGORIES } from '@/types/list';

interface ListOwner {
  userId: mongoose.Types.ObjectId;
  clerkId: string;
}

export interface ListCollaborator {
  userId?: mongoose.Types.ObjectId;
  clerkId?: string;
  email?: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'rejected';
  invitedAt: Date;
  acceptedAt?: Date;
  _isEmailInvite?: boolean;
}

interface ListItem {
  title: string;
  comment?: string;
  completed: boolean;
  properties: Array<{
    tag?: string;
    value: string;
  }>;
}

export interface ListDocument extends Document {
  title: string;
  description?: string;
  category: string;
  privacy: 'public' | 'private';
  listType: 'ordered' | 'bullet';
  owner: ListOwner;
  collaborators: ListCollaborator[];
  items: ListItem[];
  stats: {
    viewCount: number;
    pinCount: number;
    copyCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
}

// Define sub-schemas first
const PropertySchema = new Schema({
  tag: { type: String },
  value: { type: String, required: true }
}, { _id: false });

const ListItemSchema = new Schema({
  title: { type: String, required: true },
  comment: { type: String },
  completed: { type: Boolean, default: false },
  properties: [PropertySchema]
}, { _id: false });

const OwnerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clerkId: { type: String, required: true }
}, { _id: false });

const CollaboratorSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  clerkId: { type: String },
  email: { type: String },
  role: { type: String, enum: ['admin', 'editor', 'viewer'], required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], required: true },
  invitedAt: { type: Date, required: true },
  acceptedAt: { type: Date },
  _isEmailInvite: { type: Boolean, default: false }
}, { _id: false });

const StatsSchema = new Schema({
  viewCount: { type: Number, default: 0 },
  pinCount: { type: Number, default: 0 },
  copyCount: { type: Number, default: 0 }
}, { _id: false });

const listSchema = new Schema<ListDocument>({
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String, enum: LIST_CATEGORIES, required: true },
  privacy: { type: String, enum: ['public', 'private'], default: 'public' },
  listType: { type: String, enum: ['ordered', 'bullet'], default: 'ordered' },
  owner: { type: OwnerSchema, required: true },
  collaborators: [CollaboratorSchema],
  items: [ListItemSchema],
  stats: { type: StatsSchema, default: () => ({}) },
  editedAt: { type: Date }
}, {
  timestamps: true,
  strict: true
});

// Create indexes
// Compound text index for list content with weights
listSchema.index({
  title: 'text',
  description: 'text',
  'items.title': 'text'
}, {
  weights: {
    title: 10,        // Highest priority
    'items.title': 5, // Medium priority
    description: 1    // Lower priority
  }
});

// Access control index
listSchema.index({ 
  privacy: 1,
  'owner.clerkId': 1,
  'collaborators.clerkId': 1,
  'collaborators.email': 1,
  'collaborators._isEmailInvite': 1,
  'collaborators.status': 1
});

// Initialize model
let ListModel: mongoose.Model<ListDocument> | null = null;

export const getListModel = async () => {
  if (!ListModel) {
    const connection = await connectToDatabase();
    try {
      ListModel = connection.model<ListDocument>('List', listSchema);
    } catch (error) {
      ListModel = connection.model<ListDocument>('List');
    }
  }
  return ListModel;
}; 