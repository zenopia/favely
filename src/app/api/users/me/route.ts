import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToMongoDB } from "@/lib/db/client";
import { getUserModel } from "@/lib/db/models-v2/user";

export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(null);
    }

    await connectToMongoDB();
    const UserModel = await getUserModel();
    const user = await UserModel.findOne({ clerkId: userId }).lean();

    if (!user) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: user.clerkId,
      email: user.email || null,
      username: user.username,
      firstName: null,
      lastName: null,
      fullName: user.displayName,
      imageUrl: user.imageUrl,
    });
  } catch (error) {
    console.error("Error in /api/users/me:", error);
    return NextResponse.json(null, { status: 500 });
  }
} 