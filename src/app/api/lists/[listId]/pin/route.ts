import { NextRequest, NextResponse } from "next/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getListModel } from "@/lib/db/models-v2/list";
import { getPinModel } from "@/lib/db/models-v2/pin";
import { getUserModel } from "@/lib/db/models-v2/user";
import { AuthService } from "@/lib/services/auth.service";
import { AuthServerService } from "@/lib/services/auth.server";

export const dynamic = 'force-dynamic';

interface RouteParams {
  listId: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const user = await AuthServerService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { pinned } = await req.json();
    
    await connectToMongoDB();
    const ListModel = await getListModel();
    const PinModel = await getPinModel();
    const UserModel = await getUserModel();

    // Check if the pin already exists
    const existingPin = await PinModel.findOne({
      listId: params.listId,
      clerkId: user.id
    });

    if (pinned && !existingPin) {
      // Get list information needed for the pin
      const list = await ListModel.findById(params.listId).lean();
      if (!list) {
        return NextResponse.json(
          { error: "List not found" },
          { status: 404 }
        );
      }

      // Get owner's username
      const owner = await UserModel.findOne({ clerkId: list.owner.clerkId }).lean();
      if (!owner) {
        return NextResponse.json(
          { error: "List owner not found" },
          { status: 404 }
        );
      }

      // Create new pin with list info
      await PinModel.create({
        listId: params.listId,
        clerkId: user.id,
        listInfo: {
          title: list.title,
          category: list.category,
          ownerUsername: owner.username
        }
      });

      return NextResponse.json({ pinned: true });
    } else if (!pinned && existingPin) {
      // Remove pin
      await PinModel.findByIdAndDelete(existingPin._id);

      return NextResponse.json({ pinned: false });
    }

    return NextResponse.json({ pinned: !!existingPin });
  } catch (error) {
    console.error("Error updating pin status:", error);
    return NextResponse.json(
      { error: "Failed to update pin status" },
      { status: 500 }
    );
  }
} 