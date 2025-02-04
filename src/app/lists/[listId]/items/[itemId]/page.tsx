import { AuthService } from "@/lib/services/auth.service";
import { getListModel, type ListDocument } from "@/lib/db/models-v2/list";
import { getFollowModel } from "@/lib/db/models-v2/follow";
import { getUserModel } from "@/lib/db/models-v2/user";
import { getPinModel } from "@/lib/db/models-v2/pin";
import { getListViewModel } from "@/lib/db/models-v2/list-view";
import { connectToMongoDB } from "@/lib/db/client";
import { notFound } from "next/navigation";
import type { EnhancedList, ListCategory } from "@/types/list";
import { ItemView } from "@/components/items/item-view";

interface PageProps {
  params: {
    username: string;
    listId: string;
    itemId: string;
  };
  _searchParams: {
    from?: string;
  };
}

export default async function ItemPage({ params, _searchParams }: PageProps) {
  try {
    const currentUser = await AuthService.getCurrentUser();
    const userId = currentUser?.id;

    // Remove @ if present and decode the username
    const username = decodeURIComponent(params.username).replace(/^@/, '');

    // Get user from AuthService
    const profileUser = await AuthService.getUserByUsername(username);
    if (!profileUser) {
      console.error(`User not found: ${username}`);
      notFound();
    }

    // Connect to MongoDB
    await connectToMongoDB();
    const ListModel = await getListModel();
    const _UserModel = await getUserModel();
    const FollowModel = await getFollowModel();
    const PinModel = await getPinModel();
    const ListViewModel = await getListViewModel();

    // Get list
    const list = await ListModel.findOne({ 
      _id: params.listId
    }).lean() as ListDocument & { _id: { toString(): string } };

    if (!list) {
      notFound();
    }

    // Verify the list belongs to the requested user
    if (list.owner.clerkId !== profileUser.id) {
      notFound();
    }

    // Find the item by rank
    const item = list.items?.find(item => item.rank === parseInt(params.itemId));
    if (!item) {
      notFound();
    }

    // Track list view if user is logged in and has access
    if (userId) {
      const isOwner = userId === list.owner.clerkId;
      const isCollaborator = list.collaborators?.some(c => c.clerkId === userId && c.status === 'accepted');
      const isPinned = await PinModel.exists({ listId: params.listId, clerkId: userId });

      if (isOwner || isCollaborator || isPinned) {
        const accessType = isOwner ? 'owner' : (isCollaborator ? 'collaborator' : 'pin');
        
        await ListViewModel.updateOne(
          { clerkId: userId, listId: list._id },
          { 
            $set: { 
              lastViewedAt: new Date(),
              accessType
            }
          },
          { upsert: true }
        );
      }
    }

    // Enhance list with owner data
    const enhancedList: EnhancedList = {
      id: list._id.toString(),
      title: list.title,
      description: list.description,
      category: list.category as ListCategory,
      privacy: list.privacy,
      items: list.items?.map(item => ({
        id: Math.random().toString(36).slice(2),
        title: item.title,
        comment: item.comment,
        rank: item.rank,
        properties: item.properties?.map(prop => ({
          id: Math.random().toString(36).slice(2),
          type: prop.type,
          label: prop.label,
          value: prop.value
        }))
      })) || [],
      stats: {
        viewCount: list.stats.viewCount,
        pinCount: list.stats.pinCount,
        copyCount: list.stats.copyCount
      },
      collaborators: list.collaborators?.map(c => ({
        id: Math.random().toString(36).slice(2),
        clerkId: c.clerkId || '',
        username: c.username || '',
        email: c.email,
        role: c.role,
        status: c.status,
        invitedAt: c.invitedAt.toISOString(),
        acceptedAt: c.acceptedAt?.toISOString()
      })),
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
      editedAt: list.editedAt?.toISOString(),
      owner: {
        id: profileUser.id,
        clerkId: list.owner.clerkId,
        username: profileUser.username || '',
        joinedAt: new Date().toISOString(), // Since we don't have this from AuthService
        displayName: profileUser.fullName || '',
        imageUrl: profileUser.imageUrl || null
      }
    };

    // Get the enhanced item
    const enhancedItem = enhancedList.items.find(i => i.rank === parseInt(params.itemId));
    if (!enhancedItem) {
      notFound();
    }

    return (
      <ItemView
        list={enhancedList}
        item={enhancedItem}
        isOwner={userId === profileUser.id}
      />
    );
  } catch (error) {
    console.error("Error in ItemPage:", error);
    notFound();
  }
} 