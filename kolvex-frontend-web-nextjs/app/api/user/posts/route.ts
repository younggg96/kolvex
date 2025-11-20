import { NextRequest, NextResponse } from "next/server";
import { mockSocialPosts, mockCreators, mockUserData } from "@/lib/mockData";

// GET: Get user's liked and favorited posts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type"); // 'liked' or 'favorited'
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (type === "liked") {
      // Get user's liked posts
      const likedPostIds = Array.from(mockUserData.likes);
      const likedPosts = mockSocialPosts.filter((p) => likedPostIds.includes(p.post_id));

      // Paginate
      const paginatedPosts = likedPosts.slice(offset, offset + limit);

      // Enhance posts with creator and interaction data
      const enhancedPosts = paginatedPosts.map((post) => {
        const creator = mockCreators.find((c) => c.creator_id === post.creator_id);
        return {
          ...post,
          creator_name: creator?.display_name || "",
          creator_avatar_url: creator?.avatar_url || "",
          creator_username: creator?.username || "",
          creator_verified: creator?.verified || false,
          creator_bio: creator?.bio || null,
          creator_followers_count: creator?.followers_count || 0,
          creator_category: creator?.category || null,
          creator_influence_score: creator?.influence_score || 0,
          creator_trending_score: creator?.trending_score || 0,
          user_liked: true,
          user_favorited: mockUserData.favorites.has(post.post_id),
          user_tracked: mockUserData.trackedKols.has(post.creator_id),
          total_likes: 0,
          total_favorites: 0,
          liked_at: new Date().toISOString(),
        };
      });

      return NextResponse.json({ posts: enhancedPosts, count: likedPosts.length });
    } else if (type === "favorited") {
      // Get user's favorited posts
      const favoritedPostIds = Array.from(mockUserData.favorites.keys());
      const favoritedPosts = mockSocialPosts.filter((p) => 
        favoritedPostIds.includes(p.post_id)
      );

      // Paginate
      const paginatedPosts = favoritedPosts.slice(offset, offset + limit);

      // Enhance posts with creator and interaction data
      const enhancedPosts = paginatedPosts.map((post) => {
        const creator = mockCreators.find((c) => c.creator_id === post.creator_id);
        const favoriteData = mockUserData.favorites.get(post.post_id);
        return {
          ...post,
          creator_name: creator?.display_name || "",
          creator_avatar_url: creator?.avatar_url || "",
          creator_username: creator?.username || "",
          creator_verified: creator?.verified || false,
          creator_bio: creator?.bio || null,
          creator_followers_count: creator?.followers_count || 0,
          creator_category: creator?.category || null,
          creator_influence_score: creator?.influence_score || 0,
          creator_trending_score: creator?.trending_score || 0,
          user_liked: mockUserData.likes.has(post.post_id),
          user_favorited: true,
          user_tracked: mockUserData.trackedKols.has(post.creator_id),
          total_likes: 0,
          total_favorites: 0,
          favorite_notes: favoriteData?.notes,
          favorite_id: `fav-${post.post_id}`,
        };
      });

      return NextResponse.json({ posts: enhancedPosts, count: favoritedPosts.length });
    } else {
      return NextResponse.json(
        { error: "Invalid type parameter. Use 'liked' or 'favorited'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Get user posts error:", error);
    return NextResponse.json(
      {
        error: "Failed to get user posts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
