import mongoose, { Schema, Document } from 'mongoose';
import connectToDatabase from '../mongodb';

export interface UserProfileDocument extends Document {
  userId: mongoose.Types.ObjectId;
  bio?: string;
  location?: string;
  dateOfBirth?: Date;
  gender?: string;
  livingStatus?: string;
  profileComplete: boolean;
  privacySettings: {
    showBio: boolean;
    showLocation: boolean;
    showDateOfBirth: boolean;
    showGender: boolean;
    showLivingStatus: boolean;
  };
}

const userProfileSchema = new Schema<UserProfileDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio: { type: String },
  location: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String },
  livingStatus: { type: String },
  profileComplete: { type: Boolean, default: false },
  privacySettings: {
    showBio: { type: Boolean, default: true },
    showLocation: { type: Boolean, default: true },
    showDateOfBirth: { type: Boolean, default: false },
    showGender: { type: Boolean, default: true },
    showLivingStatus: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Keep the middleware to update profileComplete status
// This will still track if all fields are filled, but they're not required
userProfileSchema.pre('save', function(next) {
  this.profileComplete = !!(
    this.location &&
    this.dateOfBirth &&
    this.gender &&
    this.livingStatus
  );
  next();
});

// Remove redundant index since unique: true already creates an index
// userProfileSchema.index({ userId: 1 });

// Initialize model
let UserProfileModel: mongoose.Model<UserProfileDocument> | null = null;

export const getUserProfileModel = async () => {
  if (!UserProfileModel) {
    const connection = await connectToDatabase();
    try {
      UserProfileModel = connection.model<UserProfileDocument>('UserProfile', userProfileSchema);
    } catch (error) {
      UserProfileModel = connection.model<UserProfileDocument>('UserProfile');
    }
  }
  return UserProfileModel;
}; 