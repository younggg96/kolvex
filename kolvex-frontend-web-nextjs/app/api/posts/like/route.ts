import { NextRequest, NextResponse } from "next/server";
import { mockSocialPosts, mockUserData } from "@/lib/mockData";

// POST: Like a post
export async function POST(request: NextRequest) {
  try {
    const { postId } = await request.json();

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

    // Check if already liked
    if (mockUserData.likes.has(postId)) {
      return NextResponse.json(
        { message: "Already liked", liked: true },
        { status: 200 }
      );
    }

    // Add like
    mockUserData.likes.add(postId);

    return NextResponse.json({ 
      success: true, 
      liked: true,
      data: {
        post_id: postId,
        created_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error("Like post error:", error);
    return NextResponse.json(
      {
        error: "Failed to like post",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Unlike a post
export async function DELETE(request: NextRequest) {
  try {
    const { postId } = await request.json();

    if (!postId) {
      return NextResponse.json(
        { error: "Post ID is required" },
        { status: 400 }
      );
    }

    // Delete like
    mockUserData.likes.delete(postId);

    return NextResponse.json({ success: true, liked: false });
  } catch (error) {
    console.error("Unlike post error:", error);
    return NextResponse.json(
      {
        error: "Failed to unlike post",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET: Check if post is liked
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "Post ID is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({ liked: mockUserData.likes.has(postId) });
  } catch (error) {
    console.error("Check like error:", error);
    return NextResponse.json(
      {
        error: "Failed to check like status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
