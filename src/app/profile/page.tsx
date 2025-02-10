import { redirect } from "next/navigation";
import { ProfilePage } from "@/components/profile/profile-page";
import { AuthServerService } from "@/lib/services/auth.server";

export default async function Page() {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <ProfilePage 
      initialUser={{
        id: user.id,
        username: user.username || null,
        fullName: user.fullName || null,
        imageUrl: user.imageUrl || "",
      }} 
    />
  );
} 