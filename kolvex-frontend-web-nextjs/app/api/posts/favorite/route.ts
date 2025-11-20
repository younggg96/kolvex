import { NextRequest, NextResponse } from "next/server";
import { mockSocialPosts, mockUserData } from "@/lib/mockData";

// POST: Favorite a post
export async function POST(request: NextRequest) {
  try {
    const { postId, notes } = await request.json();

    if (!postId) {
      return NextResponse.json(
        { error: "Post ID is required" },
        { status: 400 }
      );
    }

    // Verify post exists
    const postExists = mockSocialPosts.some((p) => p.post_id === postId);

    if (!postExists) {
      return NextResponse.json(
        { error: "Post not found", postId },
        { status: 404 }
      );
    }

    // Check if already favorited
    if (mockUserData.favorites.has(postId)) {
      return NextResponse.json(
        { message: "Already favorited", favorited: true },
        { status: 200 }
      );
    }

    // Add favorite
    mockUserData.favorites.set(postId, {
      notes: notes || undefined,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      favorited: true,
      data: {
        post_id: postId,
        notes,
        created_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error("Favorite post error:", error);
    return NextResponse.json(
      {
        error: "Failed to favorite post",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Unfavorite a post
export async function DELETE(request: NextRequest) {
  try {
    const { postId } = await request.json();

    if (!postId) {
      return NextResponse.json(
        { error: "Post ID is required" },
        { status: 400 }
      );
    }

    // Delete favorite
    mockUserData.favorites.delete(postId);

    return NextResponse.json({ success: true, favorited: false });
  } catch (error) {
    console.error("Unfavorite post error:", error);
    return NextResponse.json(
      {
        error: "Failed to unfavorite post",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET: Get user's favorites or check if post is favorited
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const postId = searchParams.get("postId");

    if (postId) {
      // Check if specific post is favorited
      const favoriteData = mockUserData.favorites.get(postId);
      return NextResponse.json({ 
        favorited: !!favoriteData, 
        data: favoriteData || null 
      });
    } else {
      // Get all favorites
      const favorites = Array.from(mockUserData.favorites.entries()).map(([post_id, data]) => {
        const post = mockSocialPosts.find((p) => p.post_id === post_id);
        return {
          id: `fav-${post_id}`,
          notes: data.notes,
          created_at: data.created_at,
          social_posts: post || null,
        };
      });

      return NextResponse.json({ favorites });
    }
  } catch (error) {
    console.error("Get favorites error:", error);
    return NextResponse.json(
      {
        error: "Failed to get favorites",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
