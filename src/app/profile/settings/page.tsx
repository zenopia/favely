import { SubLayout, type SubLayoutProps } from "@/components/layout/sub-layout";
import { redirect } from "next/navigation";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getUserProfileModel } from "@/lib/db/models-v2/user-profile";
import { PrivacySettingsForm } from "@/components/settings/privacy-settings-form";
import { AuthService } from "@/lib/services/auth.service";
import { AuthServerService } from "@/lib/services/auth.server";

export default async function SettingsPage() {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  try {
    // Connect to MongoDB and get models
    await connectToMongoDB();
    const UserModel = await getUserModel();
    const UserProfileModel = await getUserProfileModel();

    // Get user data
    const mongoUser = await UserModel.findOne({ clerkId: user.id }).lean();
    if (!mongoUser) {
      console.error('User not found in MongoDB');
      redirect('/sign-in');
    }

    // Get user profile data
    const userProfile = await UserProfileModel.findOne({ userId: mongoUser._id }).lean();
    const privacySettings = userProfile?.privacySettings || {
      showBio: true,
      showLocation: true,
      showDateOfBirth: false,
      showGender: true,
      showLivingStatus: true
    };

    const pageContent = (
      <div className="px-4 md:px-6 lg:px-8 pt-4 pb-20 sm:pb-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold">Privacy Settings</h1>
            <p className="text-muted-foreground mt-1">
              Control what information is visible on your profile
            </p>
          </div>

          <PrivacySettingsForm 
            initialSettings={privacySettings}
            userId={mongoUser._id.toString()}
          />
        </div>
      </div>
    );

    const layoutProps: SubLayoutProps = {
      title: "Settings",
      hideBottomNav: true,
      children: pageContent
    };

    return <SubLayout {...layoutProps} />;
  } catch (error) {
    console.error("Error in SettingsPage:", error);
    redirect('/sign-in');
  }
} 