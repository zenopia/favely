import { redirect } from "next/navigation";
import { AuthService } from "@/lib/services/auth.service";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getUserProfileModel } from "@/lib/db/models-v2/user-profile";
import { AuthServerService } from "@/lib/services/auth.server";

export async function checkAuth() {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user.id;
}

export async function checkProfile(returnUrl?: string) {
  // Skip profile check if we're already on the profile page
  if (returnUrl === '/profile') {
    return;
  }

  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  await connectToMongoDB();
  const UserModel = await getUserModel();
  const UserProfileModel = await getUserProfileModel();

  const mongoUser = await UserModel.findOne({ clerkId: user.id });
  if (!mongoUser) {
    redirect("/sign-in");
  }

  const profile = await UserProfileModel.findOne({ userId: mongoUser._id });
  if (!profile?.profileComplete) {
    redirect(`/profile${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`);
  }

  return { user: mongoUser, profile };
} 