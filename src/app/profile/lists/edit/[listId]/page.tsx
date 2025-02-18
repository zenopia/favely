import { redirect } from "next/navigation";
import { ListFormContent } from "@/components/lists/list-form-content";
import { ProtectedPageWrapper } from "@/components/auth/protected-page-wrapper";
import { getList } from "@/lib/actions/list";
import { AuthServerService } from "@/lib/services/auth.server";

interface PageProps {
  params: {
    listId: string;
  };
  searchParams: {
    from?: string;
  };
}

export default async function EditListPage({ params, searchParams }: PageProps) {
  const user = await AuthServerService.getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  try {
    const list = await getList(params.listId);

    // Check if user is owner or editor
    const isOwner = list.owner.clerkId === user.id;
    const isEditor = list.collaborators?.some(
      (c) => c.clerkId === user.id && c.status === "accepted" && c.role === "editor"
    );

    if (!isOwner && !isEditor) {
      redirect('/');
    }

    // Prepare form values
    const formValues = {
      id: list.id,
      title: list.title,
      description: list.description,
      category: list.category,
      visibility: list.visibility as 'public' | 'private' | 'unlisted',
      listType: list.listType || 'ordered',
      items: list.items || [],
      owner: {
        username: list.owner.username
      }
    };

    return (
      <ProtectedPageWrapper
        initialUser={{
          id: user.id,
          username: user.username || null,
          fullName: user.fullName || null,
          imageUrl: user.imageUrl || "",
        }}
        layoutType="sub"
        title="Edit List"
      >
        <div>
          <div className="max-w-7xl mx-auto">
            <ListFormContent 
              mode="edit" 
              defaultValues={formValues} 
              returnPath={searchParams.from ? 
                (decodeURIComponent(searchParams.from).startsWith('/') ? decodeURIComponent(searchParams.from) : `/${decodeURIComponent(searchParams.from)}`)
                : undefined}
            />
          </div>
        </div>
      </ProtectedPageWrapper>
    );
  } catch (error) {
    console.error('Error loading list:', error);
    redirect('/');
  }
} 