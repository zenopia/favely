import { NextRequest, NextResponse } from "next/server";
import connectToMongoDB from "@/lib/db/mongodb";
import { getListModel, ListDocument } from "@/lib/db/models-v2/list";
import { getEnhancedLists } from "@/lib/actions/lists";
import { getUserModel } from "@/lib/db/models-v2/user";
import { auth } from "@clerk/nextjs/server";

export const dynamic = 'force-dynamic';

interface _RouteParams {
  params: Record<string, string>;
}

interface ListQuery {
  "owner.clerkId": string;
  category?: string;
  visibility?: string;
}

interface ListItem {
  title: string;
  comment?: string;
  completed?: boolean;
  properties?: Array<{
    tag?: string;
    value: string;
  }>;
}

export async function GET(req: NextRequest) {
  const { userId } = auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const visibility = searchParams.get("visibility");
    const query: ListQuery = { "owner.clerkId": userId };

    if (category) {
      query.category = category;
    }
    if (visibility) {
      query.visibility = visibility;
    }

    const { lists } = await getEnhancedLists(query);
    return NextResponse.json({ lists });
  } catch (error) {
    console.error("Error fetching lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch lists" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    console.log('Received request body:', JSON.stringify(body, null, 2));
    
    const { title, description, category, privacy, items, listType = 'ordered' } = body;

    if (!title || !category || !privacy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await connectToMongoDB();
    const [ListModel, UserModel] = await Promise.all([
      getListModel(),
      getUserModel()
    ]);

    // Get MongoDB user document
    const mongoUser = await UserModel.findOne({ clerkId: userId });
    if (!mongoUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Process items before creating document
    const processedItems = (items as ListItem[]).map(item => {
      console.log('Processing item:', JSON.stringify(item, null, 2));
      
      // Ensure properties is an array and each property has the correct structure
      const properties = Array.isArray(item.properties) 
        ? item.properties
          .filter(prop => prop.value) // Only include properties with values
          .map(prop => {
            console.log('Processing property:', JSON.stringify(prop, null, 2));
            return {
              tag: prop.tag || undefined,
              value: prop.value.toString() // Ensure value is a string
            };
          })
        : [];
      
      console.log('Processed properties:', JSON.stringify(properties, null, 2));

      const processedItem = {
        title: item.title,
        completed: item.completed || false,
        properties
      };

      console.log('Processed item with properties:', JSON.stringify(processedItem, null, 2));
      return processedItem;
    });

    console.log('Final processed items:', JSON.stringify(processedItems, null, 2));

    // Create the document with explicit typing for items
    const listData = {
      title,
      description,
      category,
      privacy,
      listType,
      items: processedItems.map(item => ({
        title: item.title,
        completed: item.completed,
        properties: item.properties.map(prop => ({
          tag: prop.tag,
          value: prop.value
        }))
      })),
      owner: {
        clerkId: userId,
        userId: mongoUser._id,
        username: mongoUser.username || "",
        joinedAt: new Date()
      },
      collaborators: [],
      stats: {
        viewCount: 0,
        pinCount: 0,
        copyCount: 0
      }
    };

    console.log('Creating list with data:', JSON.stringify(listData, null, 2));

    const list = await ListModel.create(listData) as ListDocument;

    console.log('Created document in MongoDB:', JSON.stringify(list.toObject(), null, 2));

    // Convert _id to string for the response
    const { _id, ...rest } = list.toObject();
    const responseList = {
      ...rest,
      id: _id.toString(),
      createdAt: list.createdAt?.toISOString(),
      updatedAt: list.updatedAt?.toISOString(),
      editedAt: list.editedAt?.toISOString(),
      owner: {
        ...list.owner,
        id: list.owner.userId?.toString()
      }
    };

    return NextResponse.json(responseList);
  } catch (error) {
    console.error("Error creating list:", error);
    // Log the full error details
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create list" },
      { status: 500 }
    );
  }
} 