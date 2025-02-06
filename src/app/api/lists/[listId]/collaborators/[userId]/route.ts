import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel, ListDocument, ListCollaborator } from "@/lib/db/models-v2/list";
import { getUserModel, UserDocument } from "@/lib/db/models-v2/user";
import { Types } from "mongoose";
import { AuthService } from "@/lib/services/auth.service";
import { AuthServerService } from "@/lib/services/auth.server";
import { ClerkService } from "@/lib/services/authProvider.service";

interface RouteParams {
  listId: string;
  userId: string;
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  message: string;
}

interface CollaboratorsResponse {
  collaborators: ListCollaborator[];
}

// Helper function to check if user can manage collaborators
async function canManageCollaborators(listId: string, userId: string | null) {
  if (!userId) return false;
  
  const ListModel = await getListModel();
  const list = await ListModel.findById(listId).lean();
  
  if (!list) return false;
  
  return (
    list.owner.clerkId === userId ||
    list.collaborators.some(c => 
      c.clerkId === userId && 
      c.status === 'accepted' && 
      c.role === 'admin'
    )
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse<CollaboratorsResponse | ErrorResponse>> {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToMongoDB();
    const ListModel = await getListModel();

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

    return NextResponse.json<CollaboratorsResponse>({ 
      collaborators: list.collaborators 
    });
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to fetch collaborators" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToMongoDB();
    const ListModel = await getListModel();

    const list = await ListModel.findById(params.listId);
    if (!list) {
      return NextResponse.json<ErrorResponse>(
        { error: "List not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to remove collaborators
    const canManageCollaborators =
      list.owner.clerkId === user.id ||
      list.collaborators?.some(
        (c) => c.clerkId === user.id && c.status === "accepted" && c.role === "admin"
      );

    if (!canManageCollaborators) {
      return NextResponse.json<ErrorResponse>(
        { error: "Not authorized to remove collaborators" },
        { status: 403 }
      );
    }

    // Remove collaborator by clerkId or email
    await ListModel.findByIdAndUpdate(params.listId, {
      $pull: {
        collaborators: {
          $or: [
            { clerkId: params.userId },
            { email: params.userId }
          ]
        }
      }
    });

    return NextResponse.json<SuccessResponse>({ message: "Collaborator removed successfully" });
  } catch (error) {
    console.error("Error removing collaborator:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to remove collaborator" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse<CollaboratorsResponse | ErrorResponse>> {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { role } = await req.json();

    await connectToMongoDB();
    const ListModel = await getListModel();

    const list = await ListModel.findById(params.listId);
    if (!list) {
      return NextResponse.json<ErrorResponse>(
        { error: "List not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to update collaborators
    const canManageCollaborators =
      list.owner.clerkId === user.id ||
      list.collaborators?.some(
        (c) => c.clerkId === user.id && c.status === "accepted" && c.role === "admin"
      );

    if (!canManageCollaborators) {
      return NextResponse.json<ErrorResponse>(
        { error: "Not authorized to update collaborators" },
        { status: 403 }
      );
    }

    const updatedList = await ListModel.findOneAndUpdate(
      {
        _id: params.listId,
        "collaborators.clerkId": params.userId
      },
      {
        $set: {
          "collaborators.$.role": role
        }
      },
      { new: true }
    );

    if (!updatedList) {
      return NextResponse.json<ErrorResponse>(
        { error: "Collaborator not found" },
        { status: 404 }
      );
    }

    return NextResponse.json<CollaboratorsResponse>({ collaborators: updatedList.collaborators });
  } catch (error) {
    console.error("Error updating collaborator:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to update collaborator" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { role } = await req.json();

    await connectToMongoDB();
    const ListModel = await getListModel();

    const list = await ListModel.findById(params.listId);
    if (!list) {
      return NextResponse.json<ErrorResponse>(
        { error: "List not found" },
        { status: 404 }
      );
    }

    // Find the collaborator
    const collaboratorIndex = list.collaborators.findIndex(
      (c) => c.clerkId === user.id || c.userId?.toString() === user.id
    );

    if (collaboratorIndex === -1) {
      return NextResponse.json<ErrorResponse>(
        { error: "No pending invitation found" },
        { status: 404 }
      );
    }

    const collaborator = list.collaborators[collaboratorIndex];

    // If it's a role update for an existing collaborator
    if (collaborator.status === "accepted" && role) {
      list.collaborators[collaboratorIndex].role = role;
      await list.save();
      return NextResponse.json<SuccessResponse>({ message: "Collaborator updated successfully" });
    }

    // Accept the invitation
    list.collaborators[collaboratorIndex].status = "accepted";
    list.collaborators[collaboratorIndex].acceptedAt = new Date();
    
    await list.save();

    return NextResponse.json<SuccessResponse>({ message: "Invitation accepted successfully" });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
} 