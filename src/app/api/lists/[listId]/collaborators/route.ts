import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel } from "@/lib/db/models-v2/list";
import { getUserModel } from "@/lib/db/models-v2/user";
import { AuthService } from "@/lib/services/auth.service";
import { sendCollaborationInviteEmail } from "@/lib/email";

export const dynamic = 'force-dynamic';

interface RouteParams {
  listId: string;
}

interface CollaboratorResponse {
  collaborators: Array<{
    userId?: string;
    clerkId?: string;
    username?: string;
    email?: string;
    role: string;
    status: string;
    _isEmailInvite?: boolean;
    invitedAt: Date;
    acceptedAt?: Date;
    displayName?: string;
    imageUrl?: string | null;
  }>;
}

interface ErrorResponse {
  error: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse<CollaboratorResponse | ErrorResponse>> {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToMongoDB();
    const ListModel = await getListModel();
    const UserModel = await getUserModel();

    const list = await ListModel.findById(params.listId).lean();
    if (!list) {
      return NextResponse.json<ErrorResponse>(
        { error: "List not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to view collaborators
    const canView = list.owner.clerkId === user.id || 
                   list.collaborators.some(c => 
                     c.clerkId === user.id && 
                     c.status === 'accepted'
                   );

    if (!canView) {
      return NextResponse.json<ErrorResponse>(
        { error: "Not authorized to view collaborators" },
        { status: 403 }
      );
    }

    // Get all non-email collaborators' user data
    const collaboratorsWithUserData = await Promise.all(list.collaborators.map(async (collaborator) => {
      if (collaborator._isEmailInvite || !collaborator.clerkId) {
        return {
          ...collaborator,
          userId: collaborator.userId?.toString(),
        };
      }

      const userData = await UserModel.findOne({ clerkId: collaborator.clerkId }).lean();
      const authUser = await AuthService.getUserById(collaborator.clerkId);

      if (!userData || !authUser) {
        return {
          ...collaborator,
          userId: collaborator.userId?.toString(),
        };
      }

      return {
        ...collaborator,
        userId: collaborator.userId?.toString(),
        username: userData.username,
        displayName: userData.displayName || userData.username,
        imageUrl: authUser.imageUrl
      };
    }));

    return NextResponse.json<CollaboratorResponse>({ 
      collaborators: collaboratorsWithUserData
    });
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to fetch collaborators" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse<CollaboratorResponse | ErrorResponse>> {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const { type = 'user', targetUserId, userId, email, role = "viewer" } = body;
    // userId from the client might be a Clerk ID directly
    const targetId = targetUserId || userId;

    // For user invites, either targetUserId or userId is required
    if (type === 'user' && !targetId) {
      console.log("Missing user ID for user invite");
      return NextResponse.json<ErrorResponse>(
        { error: "User ID is required for user invites" },
        { status: 400 }
      );
    }

    // For email invites, email is required
    if (type === 'email' && !email) {
      console.log("Missing email for email invite");
      return NextResponse.json<ErrorResponse>(
        { error: "Email is required for email invites" },
        { status: 400 }
      );
    }

    await connectToMongoDB();
    const ListModel = await getListModel();
    const UserModel = await getUserModel();

    const list = await ListModel.findById(params.listId);
    if (!list) {
      return NextResponse.json<ErrorResponse>(
        { error: "List not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to add collaborators
    const canManageCollaborators = 
      list.owner.clerkId === user.id ||
      list.collaborators?.some(
        (c) => c.clerkId === user.id && c.status === "accepted" && c.role === "admin"
      );

    if (!canManageCollaborators) {
      return NextResponse.json<ErrorResponse>(
        { error: "Not authorized to add collaborators" },
        { status: 403 }
      );
    }

    // For user invites
    if (type === 'user' && targetId) {
      // Check if user is already a collaborator
      const existingCollaborator = list.collaborators?.find(
        (c) => c.clerkId === targetId
      );
      if (existingCollaborator) {
        return NextResponse.json<ErrorResponse>(
          { error: "User is already a collaborator" },
          { status: 400 }
        );
      }

      // Get target user from MongoDB using the Clerk ID
      const targetUser = await UserModel.findOne({ clerkId: targetId }).lean();
        
      if (!targetUser) {
        return NextResponse.json<ErrorResponse>(
          { error: "User not found" },
          { status: 404 }
        );
      }

      // Add user as collaborator with details from MongoDB
      const collaborator = {
        userId: targetUser._id.toString(),
        clerkId: targetId,
        username: targetUser.username,
        displayName: targetUser.displayName || targetUser.username,
        imageUrl: targetUser.imageUrl || null,
        role,
        status: 'accepted',
        invitedAt: new Date(),
        acceptedAt: new Date()
      };

      const updatedList = await ListModel.findByIdAndUpdate(
        params.listId,
        {
          $push: {
            collaborators: collaborator
          },
        },
        { new: true }
      );

      return NextResponse.json<CollaboratorResponse>({
        collaborators: updatedList?.collaborators.map(c => ({
          ...c,
          userId: c.userId?.toString()
        })) || [],
      });
    }

    // For email invites
    if (type === 'email' && email) {
      // Check if email is already a collaborator
      const existingEmailCollaborator = list.collaborators?.find(
        (c) => c.email === email || (c.clerkId && c.email === email)
      );
      if (existingEmailCollaborator) {
        return NextResponse.json<ErrorResponse>(
          { error: "This email is already a collaborator" },
          { status: 400 }
        );
      }

      // Check if the email corresponds to an existing user
      const existingUser = await UserModel.findOne({ email }).lean();

      if (existingUser) {
        // Add as a regular user collaborator instead of email invite
        const collaborator = {
          userId: existingUser._id.toString(),
          clerkId: existingUser.clerkId,
          username: existingUser.username,
          displayName: existingUser.displayName || existingUser.username,
          imageUrl: existingUser.imageUrl || null,
          email: email,
          role,
          status: 'accepted',
          invitedAt: new Date(),
          acceptedAt: new Date()
        };

        const updatedList = await ListModel.findByIdAndUpdate(
          params.listId,
          {
            $push: {
              collaborators: collaborator
            },
          },
          { new: true }
        );

        return NextResponse.json<CollaboratorResponse>({
          collaborators: updatedList?.collaborators.map(c => ({
            ...c,
            userId: c.userId?.toString()
          })) || [],
        });
      }

      // If no existing user found, proceed with email invite
      const updatedList = await ListModel.findByIdAndUpdate(
        params.listId,
        {
          $push: {
            collaborators: {
              email,
              role,
              status: 'pending',
              _isEmailInvite: true,
              invitedAt: new Date()
            },
          },
        },
        { new: true }
      );

      // Send invitation email
      await sendCollaborationInviteEmail({
        to: email,
        inviterName: user.fullName || user.username || '',
        listTitle: list.title || '',
        listUrl: `${process.env.NEXT_PUBLIC_APP_URL}/lists/${list._id}`
      });

      return NextResponse.json<CollaboratorResponse>({
        collaborators: updatedList?.collaborators.map(c => ({
          ...c,
          userId: c.userId?.toString()
        })) || [],
      });
    }

    // If we get here, something went wrong with the request
    return NextResponse.json<ErrorResponse>(
      { error: "Invalid request parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error adding collaborator:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to add collaborator" },
      { status: 500 }
    );
  }
} 