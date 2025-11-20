import { NextRequest, NextResponse } from "next/server";
import { mockCreators, mockUserData, Platform } from "@/lib/mockData";

export type KOLPlatform = "twitter" | "reddit" | "youtube" | "xiaohongshu" | "rednote" | "x";

export interface KOL {
  id: string;
  name: string;
  username: string;
  platform: KOLPlatform;
  followers: number;
  description?: string;
  avatarUrl?: string;
  isTracking: boolean;
  createdAt: string;
  updatedAt: string;
}

// Map KOL platform types to database platform types
const platformMap: Record<KOLPlatform, Platform> = {
  twitter: "TWITTER",
  x: "TWITTER",
  reddit: "REDDIT",
  youtube: "YOUTUBE",
  xiaohongshu: "XIAOHONGSHU",
  rednote: "REDNOTE",
};

const reversePlatformMap: Record<Platform, KOLPlatform> = {
  TWITTER: "twitter",
  REDDIT: "reddit",
  YOUTUBE: "youtube",
  XIAOHONGSHU: "xiaohongshu",
  REDNOTE: "rednote",
};

// GET - Fetch all KOLs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") as KOLPlatform | null;
    const isTracking = searchParams.get("isTracking");

    let filteredCreators = [...mockCreators];

    // Filter by platform if provided
    if (platform) {
      const dbPlatform = platformMap[platform];
      filteredCreators = filteredCreators.filter((c) => c.platform === dbPlatform);
    }

    // Transform creators data to KOL format
    let kols: KOL[] = filteredCreators.map((creator) => ({
      id: creator.id,
      name: creator.display_name,
      username: creator.username || creator.creator_id,
      platform: reversePlatformMap[creator.platform],
      followers: creator.followers_count,
      description: creator.bio || undefined,
      avatarUrl: creator.avatar_url || undefined,
      isTracking: mockUserData.trackedKols.has(creator.creator_id),
      createdAt: creator.created_at,
      updatedAt: creator.updated_at,
    }));

    // Filter by tracking status if provided
    if (isTracking !== null) {
      const tracking = isTracking === "true";
      kols = kols.filter((kol) => kol.isTracking === tracking);
    }

    return NextResponse.json(kols);
  } catch (error) {
    console.error("Error fetching KOLs:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch KOLs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST - Create a new KOL (Not supported)
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Creating creators is not supported through this API",
      message: "Creators are automatically discovered and managed by the system",
    },
    { status: 403 }
  );
}

// PATCH - Update an existing KOL (Not supported)
export async function PATCH(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Updating creators is not supported through this API",
      message: "Creators are automatically updated by the system. To track/untrack a creator, use the tracking API instead.",
    },
    { status: 403 }
  );
}

// DELETE - Delete a KOL (Not supported)
export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Deleting creators is not supported through this API",
      message: "Creators are managed by the system. To untrack a creator, use the tracking API instead.",
    },
    { status: 403 }
  );
}
