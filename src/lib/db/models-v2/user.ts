import mongoose, { Schema, Document } from 'mongoose';
import connectToDatabase from '../mongodb';

export interface UserDocument extends Document {
  clerkId: string;
  username: string;
  displayName: string;
  imageUrl: string;
  searchIndex: string;
  email?: string;
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

const userSchema = new Schema<UserDocument>({
  clerkId: { type: String, required: true },
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  imageUrl: { type: String, required: true },
  searchIndex: { type: String },
  email: { type: String },
  bio: { type: String },
  location: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String },
  livingStatus: { type: String },
  privacySettings: {
    showDateOfBirth: { type: Boolean, default: false },
    showGender: { type: Boolean, default: true },
    showLivingStatus: { type: Boolean, default: true }
  },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  listCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Create indexes for frequently queried fields
userSchema.index({ clerkId: 1 }, { unique: true }); // For getCurrentUser and getUserById
userSchema.index({ email: 1 }, { sparse: true });   // For getUserByEmail, sparse because email is optional
userSchema.index({ username: 1 }, { unique: true }); // For getUserByUsername

// Create text search indexes
userSchema.index({ searchIndex: 'text' });
userSchema.index({ 
  username: 'text', 
  displayName: 'text' 
}, {
  weights: {
    username: 10,     // Higher priority
    displayName: 5    // Lower priority
  }
});

// Create compound indexes for common query patterns
userSchema.index({ username: 1, displayName: 1 }); // For profile lookups
userSchema.index({ createdAt: -1 });               // For sorting by newest

// Create searchIndex before saving
userSchema.pre('save', function(next) {
  if (this.isModified('username') || this.isModified('displayName')) {
    this.searchIndex = `${this.username} ${this.displayName}`.toLowerCase();
  }
  next();
});

// Initialize model
let UserModel: mongoose.Model<UserDocument> | null = null;

export const getUserModel = async () => {
  if (!UserModel) {
    const connection = await connectToDatabase();
    try {
      UserModel = connection.model<UserDocument>('User', userSchema);
    } catch (error) {
      UserModel = connection.model<UserDocument>('User');
    }
  }
  return UserModel;
}; 