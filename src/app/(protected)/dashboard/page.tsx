import { redirect } from "next/navigation";
import { AuthService } from "@/lib/services/auth.service";
import { getEnhancedLists } from "@/lib/actions/lists";
import { MyListsLayout } from "@/components/lists/my-lists-layout";
import { AuthServerService } from "@/lib/services/auth.server";

export default async function DashboardPage() {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  try {
    const { lists } = await getEnhancedLists({ 'owner.clerkId': user.id });
    
    return (
      <MyListsLayout 
        lists={lists}
        initialUser={{
          id: user.id,
          username: user.username || null,
          fullName: user.fullName || null,
          imageUrl: user.imageUrl || "",
        }}
      />
    );
  } catch (error) {
    console.error('Error loading dashboard:', error);
    redirect('/sign-in');
  }
} 