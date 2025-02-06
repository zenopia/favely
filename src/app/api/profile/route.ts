import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getUserProfileModel } from "@/lib/db/models-v2/user-profile";
import { getListModel } from "@/lib/db/models-v2/list";
import { AuthService } from "@/lib/services/auth.service";
import { AuthServerService } from "@/lib/services/auth.server";

export async function GET(req: NextRequest) {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Connect to MongoDB and get user profile
    await connectToMongoDB();
    const UserModel = await getUserModel();
    const UserProfileModel = await getUserProfileModel();
    const mongoUser = await UserModel.findOne({ clerkId: user.id }).lean();
    
    if (!mongoUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const profile = await UserProfileModel.findOne({ userId: mongoUser._id }).lean();
    return NextResponse.json({ user, profile });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Connect to MongoDB and update profile
    await connectToMongoDB();
    const UserModel = await getUserModel();
    const UserProfileModel = await getUserProfileModel();
    const mongoUser = await UserModel.findOne({ clerkId: user.id }).lean();

    if (!mongoUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Update or create user profile
    const updatedProfile = await UserProfileModel.findOneAndUpdate(
      { userId: mongoUser._id },
      {
        $set: {
          bio: body.bio,
          location: body.location,
          dateOfBirth: body.dateOfBirth,
          gender: body.gender,
          livingStatus: body.livingStatus,
          profileComplete: true,
        }
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ user, profile: updatedProfile });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToMongoDB();
    const UserModel = await getUserModel();
    const UserProfileModel = await getUserProfileModel();
    const ListModel = await getListModel();
    const mongoUser = await UserModel.findOne({ clerkId: user.id });

    if (!mongoUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Delete user's profile
    await UserProfileModel.deleteOne({ userId: mongoUser._id });

    // Delete user's lists
    await ListModel.deleteMany({ userId: mongoUser._id });

    // Delete the user document itself
    await UserModel.deleteOne({ _id: mongoUser._id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
} 