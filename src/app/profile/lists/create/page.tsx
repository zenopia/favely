import { redirect } from "next/navigation";
import { AuthService } from "@/lib/services/auth.service";
import { ListFormContent } from "@/components/lists/list-form-content";
import { ProtectedPageWrapper } from "@/components/auth/protected-page-wrapper";
import { AuthServerService } from "@/lib/services/auth.server";

export default async function CreateListPage() {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <ProtectedPageWrapper
      initialUser={{
        id: user.id,
        username: user.username || null,
        fullName: user.fullName || null,
        imageUrl: user.imageUrl || "",
      }}
      layoutType="sub"
      title="Create List"
    >
      <div>
        <div className="max-w-3xl mx-auto">
          <ListFormContent mode="create" />
        </div>
      </div>
    </ProtectedPageWrapper>
  );
} 