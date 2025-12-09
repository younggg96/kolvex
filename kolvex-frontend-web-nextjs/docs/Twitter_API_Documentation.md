# Twitter 社交平台 API 使用文档 (GraphQL + Realtime)

> 本文档为前端开发者提供完整的 Twitter 相关功能使用指南
> **数据库:** Supabase
> **API 类型:** GraphQL + Realtime (WebSocket)
> **项目 URL:** `https://ocdgzkmgjkncimyklsnp.supabase.co`

---

## 🚨 重要更新通知 (v2.0)

**数据库架构已更新！** 如果你正在使用旧版 API，请查看 [第 13 章：迁移说明](#13-迁移说明-v10--v20)

### 主要变更：

- ✨ **新增 `creators` 表** - 统一管理 KOL 信息
- ⚠️ **`social_posts` 表结构变更** - 移除 `creator_name`、`creator_avatar_url` 字段
- ✨ **新功能** - 支持热门 KOL 排行、影响力评分等
- ⚠️ **查询方式变更** - 需要使用 JOIN 查询获取 creator 信息

**迁移难度：** 中等 | **预计时间：** 1-2 小时

---

## 📋 目录

1. [初始化配置](#1-初始化配置)
2. [用户认证](#2-用户认证)
3. [订阅管理](#3-订阅管理-kol-订阅)
4. [获取帖子](#4-获取帖子) ⚠️ 已更新
   - 4.6 [获取热门 KOL（新功能）](#46-获取热门-kol新功能) ✨
5. [帖子交互](#5-帖子交互点赞收藏)
6. [通知系统](#6-通知系统)
7. [实时更新 (Realtime)](#7-实时更新-websocket) ⚠️ 已更新
8. [高级过滤](#8-高级过滤查询)
9. [数据结构参考](#9-数据结构参考) ⚠️ 已更新
   - 9.2 [creators 表结构（新增）](#92-creators-表结构) ✨
10. [完整示例](#10-完整示例构建-twitter-feed)
11. [注意事项](#11-注意事项)
12. [联系和支持](#12-联系和支持)
13. [迁移说明 (v1.0 → v2.0)](#13-迁移说明-v10--v20) ⚠️ 重要

---

## 1. 初始化配置

### 1.1 安装依赖

```bash
npm install @supabase/supabase-js
```

### 1.2 创建客户端

```javascript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ocdgzkmgjkncimyklsnp.supabase.co";
const supabaseAnonKey = "YOUR_ANON_KEY"; // 从项目设置获取

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 2. 用户认证

### 2.1 获取当前用户

```javascript
// 获取当前登录用户
const {
  data: { user },
  error,
} = await supabase.auth.getUser();

if (user) {
  console.log("User ID:", user.id);
  console.log("Email:", user.email);
}
```

### 2.2 监听认证状态

```javascript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN") {
    console.log("User signed in:", session.user);
  } else if (event === "SIGNED_OUT") {
    console.log("User signed out");
  }
});
```

---

## 3. 订阅管理 (KOL 订阅)

### 3.1 订阅新的 KOL (GraphQL Mutation)

```graphql
mutation SubscribeToKOL {
  insertIntouser_kol_entriesCollection(
    objects: [
      {
        user_id: "YOUR_USER_ID"
        platform: TWITTER
        kol_id: "elonmusk"
        notify: true
      }
    ]
  ) {
    affectedCount
    records {
      user_id
      platform
      kol_id
      notify
      updated_at
    }
  }
}
```

**JavaScript 实现:**

```javascript
const subscribeToKOL = async (kolUsername, enableNotification = true) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("user_kol_entries")
    .insert({
      user_id: user.id,
      platform: "TWITTER",
      kol_id: kolUsername, // 例如: "elonmusk"
      notify: enableNotification,
    })
    .select();

  if (error) throw error;
  return data;
};

// 使用示例
await subscribeToKOL("elonmusk", true);
```

### 3.2 查询当前用户的订阅列表

```graphql
query GetMySubscriptions {
  user_kol_entriesCollection(
    filter: { user_id: { eq: "YOUR_USER_ID" }, platform: { eq: TWITTER } }
  ) {
    edges {
      node {
        kol_id
        platform
        notify
        updated_at
      }
    }
  }
}
```

**JavaScript 实现:**

```javascript
const getMySubscriptions = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("user_kol_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", "TWITTER")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
};
```

### 3.3 取消订阅 KOL

```javascript
const unsubscribeFromKOL = async (kolUsername) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("user_kol_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", "TWITTER")
    .eq("kol_id", kolUsername);

  if (error) throw error;
};
```

### 3.4 更新通知设置

```javascript
const updateNotificationSettings = async (kolUsername, enableNotification) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("user_kol_entries")
    .update({ notify: enableNotification })
    .eq("user_id", user.id)
    .eq("platform", "TWITTER")
    .eq("kol_id", kolUsername)
    .select();

  if (error) throw error;
  return data;
};
```

---

## 4. 获取帖子

### 4.1 获取最新帖子 (带分页)

**⚠️ 重要变更：** `social_posts` 表不再包含 `creator_name` 和 `creator_avatar_url` 字段。这些信息现在存储在 `creators` 表中，需要通过 JOIN 查询。

```graphql
query GetLatestPosts($limit: Int!, $offset: Int!) {
  social_postsCollection(
    filter: { platform: { eq: TWITTER } }
    orderBy: [{ published_at: DescNullsLast }]
    first: $limit
    offset: $offset
  ) {
    edges {
      node {
        post_id
        platform
        creator_id
        creator_ref
        content
        content_url
        published_at
        media_urls
        likes_count
        ai_summary
        ai_sentiment
        ai_tags
        is_market_related
        creators {
          display_name
          avatar_url
          username
          followers_count
          verified
          influence_score
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
  }
}
```

**JavaScript 实现:**

```javascript
const getLatestPosts = async (limit = 20, offset = 0) => {
  const { data, error } = await supabase
    .from("social_posts")
    .select(
      `
      *,
      creators (
        display_name,
        avatar_url,
        username,
        followers_count,
        verified,
        influence_score
      )
    `
    )
    .eq("platform", "TWITTER")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data;
};

// 使用示例
const posts = await getLatestPosts(20, 0); // 获取前 20 条
console.log(posts[0].creators.display_name); // 访问 creator 信息
```

### 4.2 获取特定 KOL 的帖子

```javascript
const getPostsByKOL = async (kolUsername, limit = 20) => {
  const { data, error } = await supabase
    .from("social_posts")
    .select(
      `
      *,
      creators!inner (
        display_name,
        avatar_url,
        username,
        followers_count,
        verified
      )
    `
    )
    .eq("platform", "TWITTER")
    .eq("creators.username", kolUsername) // 通过 creators 表的 username 查询
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

// 使用示例
const elonPosts = await getPostsByKOL("elonmusk", 10);
```

### 4.3 获取订阅的 KOL 的帖子

```javascript
const getSubscribedKOLsPosts = async (limit = 50) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 先获取订阅列表
  const { data: subscriptions } = await supabase
    .from("user_kol_entries")
    .select("creator_ref")
    .eq("user_id", user.id)
    .eq("platform", "TWITTER");

  const creatorRefs = subscriptions.map((sub) => sub.creator_ref);

  // 获取这些 KOL 的帖子
  const { data: posts, error } = await supabase
    .from("social_posts")
    .select(
      `
      *,
      creators (
        display_name,
        avatar_url,
        username,
        followers_count,
        verified
      )
    `
    )
    .eq("platform", "TWITTER")
    .in("creator_ref", creatorRefs)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return posts;
};
```

### 4.4 按 AI 分析过滤

```javascript
// 只获取市场相关的帖子
const getMarketRelatedPosts = async (limit = 20) => {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("platform", "TWITTER")
    .eq("is_market_related", true)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

// 按情绪过滤 (bullish/bearish/neutral)
const getPostsBySentiment = async (sentiment, limit = 20) => {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("platform", "TWITTER")
    .eq("ai_sentiment", sentiment)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

// 使用示例
const bullishPosts = await getPostsBySentiment("bullish", 10);
```

### 4.5 按标签过滤

```javascript
const getPostsByTag = async (tag, limit = 20) => {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("platform", "TWITTER")
    .contains("ai_tags", [tag]) // ai_tags 是数组类型
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

// 使用示例
const bitcoinPosts = await getPostsByTag("bitcoin", 20);
```

### 4.6 获取热门 KOL（新功能）✨

**新增功能：** 现在可以通过 `creators` 表直接查询热门 KOL 排行榜。

```javascript
// 获取热门 KOL（按热度排序）
const getTrendingKOLs = async (limit = 10) => {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("platform", "TWITTER")
    .order("trending_score", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

// 获取最具影响力的 KOL（按影响力评分排序）
const getMostInfluentialKOLs = async (limit = 10) => {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("platform", "TWITTER")
    .order("influence_score", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

// 获取最活跃的 KOL（按最近发帖时间排序）
const getMostActiveKOLs = async (limit = 10) => {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("platform", "TWITTER")
    .order("last_post_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

// 按类别获取 KOL
const getKOLsByCategory = async (category, limit = 10) => {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("platform", "TWITTER")
    .eq("category", category) // 例如: 'finance', 'crypto', 'tech'
    .order("influence_score", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

// 获取认证 KOL
const getVerifiedKOLs = async (limit = 10) => {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("platform", "TWITTER")
    .eq("verified", true)
    .order("followers_count", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

// 获取单个 KOL 的详细信息
const getKOLDetails = async (username) => {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("platform", "TWITTER")
    .eq("username", username)
    .single();

  if (error) throw error;
  return data;
};

// 使用示例
const trendingKOLs = await getTrendingKOLs(10);
console.log("Top 10 trending KOLs:", trendingKOLs);
```

---

## 5. 帖子交互（点赞、收藏）

### 5.1 点赞帖子

```javascript
const likePost = async (postId) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("user_post_likes")
    .insert({
      user_id: user.id,
      post_id: postId,
    })
    .select();

  if (error) {
    if (error.code === "23505") {
      // 重复键错误
      console.log("Already liked");
      return null;
    }
    throw error;
  }

  return data;
};
```

### 5.2 取消点赞

```javascript
const unlikePost = async (postId) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("user_post_likes")
    .delete()
    .eq("user_id", user.id)
    .eq("post_id", postId);

  if (error) throw error;
};
```

### 5.3 检查是否已点赞

```javascript
const isPostLiked = async (postId) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("user_post_likes")
    .select("*")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
  return !!data;
};
```

### 5.4 收藏帖子

```javascript
const favoritePost = async (postId, notes = "") => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("user_post_favorites")
    .insert({
      user_id: user.id,
      post_id: postId,
      notes: notes,
    })
    .select();

  if (error) throw error;
  return data;
};
```

### 5.5 取消收藏

```javascript
const unfavoritePost = async (favoriteId) => {
  const { error } = await supabase
    .from("user_post_favorites")
    .delete()
    .eq("id", favoriteId);

  if (error) throw error;
};
```

### 5.6 获取收藏列表

```javascript
const getFavorites = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("user_post_favorites")
    .select(
      `
      id,
      notes,
      created_at,
      social_posts (*)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};
```

### 5.7 获取点赞列表

```javascript
const getLikedPosts = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("user_post_likes")
    .select(
      `
      created_at,
      social_posts (*)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};
```

---

## 6. 通知系统

### 6.1 获取通知列表

```javascript
const getNotifications = async (limit = 20, unreadOnly = false) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("user_post_notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
};

// 使用示例
const allNotifications = await getNotifications(20, false);
const unreadNotifications = await getNotifications(20, true);
```

### 6.2 标记通知为已读

```javascript
const markNotificationAsRead = async (notificationId) => {
  const { data, error } = await supabase
    .from("user_post_notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .select();

  if (error) throw error;
  return data;
};
```

### 6.3 标记所有通知为已读

```javascript
const markAllNotificationsAsRead = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("user_post_notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .select();

  if (error) throw error;
  return data;
};
```

### 6.4 获取未读通知数量

```javascript
const getUnreadCount = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count, error } = await supabase
    .from("user_post_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw error;
  return count;
};
```

---

## 7. 实时更新 (WebSocket)

### 7.1 订阅新帖子通知

```javascript
// 订阅当前用户的通知（推荐）
const subscribeToNotifications = (onNewNotification) => {
  const { data: { user } } = await supabase.auth.getUser()

  const channel = supabase
    .channel('user-notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'user_post_notifications',
      filter: `user_id=eq.${user.id}`
    }, (payload) => {
      console.log('🔔 New notification:', payload.new)
      onNewNotification(payload.new)
    })
    .subscribe()

  // 返回取消订阅函数
  return () => {
    supabase.removeChannel(channel)
  }
}

// 使用示例
const unsubscribe = subscribeToNotifications((notification) => {
  // 显示通知给用户
  alert(`New post from ${notification.creator_name}: ${notification.message}`)
})

// 组件卸载时取消订阅
// unsubscribe()
```

### 7.2 订阅所有新帖子

```javascript
// 订阅所有平台的新帖子
const subscribeToAllPosts = (onNewPost) => {
  const channel = supabase
    .channel("all-new-posts")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "social_posts",
      },
      (payload) => {
        console.log("📝 New post:", payload.new);
        onNewPost(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
```

### 7.3 订阅特定 KOL 的新帖子

```javascript
// 订阅特定 KOL 的新帖子（使用 creator_ref）
const subscribeToKOLPosts = (creatorRef, onNewPost) => {
  const channel = supabase
    .channel(`kol-${creatorRef}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "social_posts",
        filter: `creator_ref=eq.${creatorRef}`,
      },
      (payload) => {
        console.log(`📝 New post from ${creatorRef}:`, payload.new);
        onNewPost(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// 使用示例（需要先获取 creator_ref，格式为 "TWITTER_elonmusk"）
const unsubscribe = subscribeToKOLPosts("TWITTER_elonmusk", (post) => {
  console.log("Elon just posted:", post.content);
});
```

### 7.4 订阅点赞和收藏更新

```javascript
// 订阅自己的点赞更新
const subscribeToMyLikes = (onLikeUpdate) => {
  const { data: { user } } = await supabase.auth.getUser()

  const channel = supabase
    .channel('my-likes')
    .on('postgres_changes', {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'user_post_likes',
      filter: `user_id=eq.${user.id}`
    }, (payload) => {
      console.log('Like update:', payload)
      onLikeUpdate(payload)
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
```

### 7.5 React 组件示例

```jsx
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // 初始加载未读数量
    loadUnreadCount();
    loadNotifications();

    // 订阅实时通知
    const unsubscribe = subscribeToNotifications((newNotification) => {
      setNotifications((prev) => [newNotification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // 显示浏览器通知
      if (Notification.permission === "granted") {
        new Notification(newNotification.title, {
          body: newNotification.message,
          icon: "/logo.png",
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadUnreadCount = async () => {
    const count = await getUnreadCount();
    setUnreadCount(count);
  };

  const loadNotifications = async () => {
    const data = await getNotifications(20);
    setNotifications(data);
  };

  const handleMarkAsRead = async (notificationId) => {
    await markNotificationAsRead(notificationId);
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  };

  return (
    <div>
      <button>🔔 {unreadCount > 0 && <span>{unreadCount}</span>}</button>

      <div className="notifications-dropdown">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={notification.is_read ? "read" : "unread"}
            onClick={() => handleMarkAsRead(notification.id)}
          >
            <h4>{notification.title}</h4>
            <p>{notification.message}</p>
            <small>{new Date(notification.created_at).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 8. 高级过滤查询

### 8.1 组合过滤

```javascript
// 获取市场相关 + bullish 情绪 + 包含 bitcoin 标签的帖子
const getAdvancedFilteredPosts = async () => {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("platform", "TWITTER")
    .eq("is_market_related", true)
    .eq("ai_sentiment", "bullish")
    .contains("ai_tags", ["bitcoin"])
    .order("published_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data;
};
```

### 8.2 时间范围过滤

```javascript
// 获取过去 24 小时的帖子
const getRecentPosts = async (hours = 24) => {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hours);

  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("platform", "TWITTER")
    .gte("published_at", cutoffTime.toISOString())
    .order("published_at", { ascending: false });

  if (error) throw error;
  return data;
};
```

### 8.3 文本搜索

```javascript
// 搜索内容中包含特定关键词的帖子
const searchPosts = async (keyword) => {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("platform", "TWITTER")
    .textSearch("content", keyword) // 全文搜索
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
};

// 或使用 ilike 进行模糊匹配
const searchPostsLike = async (keyword) => {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("platform", "TWITTER")
    .ilike("content", `%${keyword}%`)
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
};
```

### 8.4 获取热门帖子（按点赞数排序）

```javascript
const getTrendingPosts = async (limit = 20) => {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("platform", "TWITTER")
    .order("likes_count", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};
```

---

## 9. 数据结构参考

### 9.1 social_posts 表结构

**⚠️ 重要更新：** `creator_name` 和 `creator_avatar_url` 字段已移除，现在通过 `creator_ref` 关联到 `creators` 表。

```typescript
interface SocialPost {
  post_id: string; // 格式: "twitter_{tweet_id}"
  platform: "TWITTER" | "REDDIT" | "YOUTUBE" | "REDNOTE";
  creator_id: string; // Twitter 用户数字 ID
  creator_ref: string; // 关联到 creators 表 (格式: "{platform}_{creator_id}")
  title: string | null; // Twitter 没有 title
  content: string; // 推文内容
  content_url: string; // 推文链接
  published_at: string; // ISO 8601 时间戳
  fetched_at: string;
  media_urls: string[]; // 图片/视频 URLs
  likes_count: number;
  comments_count: number;
  shares_count: number;

  // AI 分析字段
  ai_summary: string | null;
  ai_analysis: string | null;
  ai_reasoning: string | null;
  ai_sentiment: string | null; // "bullish" | "bearish" | "neutral"
  ai_tags: string[]; // ["bitcoin", "crypto", ...]
  is_market_related: boolean;

  platform_metadata: object; // JSONB，存储平台特定数据
  created_at_db: string;
  updated_at: string;

  // JOIN 查询时包含的 creator 信息
  creators?: Creator; // 通过 creator_ref 关联
}
```

### 9.2 creators 表结构 ✨

**新增表：** 存储所有平台的 KOL/创作者信息。

```typescript
interface Creator {
  id: string; // 主键，格式: "{platform}_{creator_id}" (e.g. "TWITTER_elonmusk")
  platform: "TWITTER" | "REDDIT" | "YOUTUBE" | "REDNOTE";
  creator_id: string; // 平台原始 ID
  username: string | null; // 用户名/handle
  display_name: string; // 显示名称
  avatar_url: string | null; // 头像 URL
  bio: string | null; // 个人简介
  followers_count: number; // 粉丝数
  verified: boolean; // 是否认证
  category: string | null; // 分类 (e.g. 'finance', 'crypto', 'tech')
  influence_score: number; // 影响力评分 (0-10000)
  total_posts_count: number; // 总帖子数
  last_post_at: string | null; // 最后发帖时间
  trending_score: number; // 热度评分（动态计算）
  metadata: object; // JSONB，平台特定元数据
  created_at: string;
  updated_at: string;
}
```

### 9.3 user_kol_entries 表结构

**更新：** 新增 `creator_ref` 字段关联到 `creators` 表。

```typescript
interface UserKOLEntry {
  user_id: string; // UUID
  platform: "TWITTER" | "REDDIT" | "YOUTUBE" | "REDNOTE";
  kol_id: string; // KOL 的 username (e.g. "elonmusk")
  creator_ref: string; // 关联到 creators 表 (格式: "{platform}_{kol_id}")
  notify: boolean; // 是否开启通知
  updated_at: string;
}
```

### 9.3 user_post_notifications 表结构

```typescript
interface UserPostNotification {
  id: string; // UUID
  user_id: string; // UUID
  type: string; // "new_post"
  title: string; // "New post from elonmusk"
  message: string; // 帖子摘要
  post_id: string | null; // 关联的帖子 ID
  creator_name: string | null; // KOL username
  is_read: boolean;
  created_at: string;
}
```

### 9.4 user_post_likes 表结构

```typescript
interface UserPostLike {
  user_id: string; // UUID
  post_id: string; // 帖子 ID
  created_at: string;
}
```

### 9.5 user_post_favorites 表结构

```typescript
interface UserPostFavorite {
  id: string; // UUID
  user_id: string; // UUID
  post_id: string; // 帖子 ID
  notes: string | null; // 用户备注
  created_at: string;
}
```

---

## 10. 完整示例：构建 Twitter Feed

```jsx
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function TwitterFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState(new Set());

  useEffect(() => {
    loadFeed();
    loadLikedPosts();

    // 订阅新帖子
    const unsubscribe = supabase
      .channel("feed-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "social_posts",
          filter: "platform=eq.TWITTER",
        },
        (payload) => {
          setPosts((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(unsubscribe);
    };
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    const data = await getSubscribedKOLsPosts(50);
    setPosts(data);
    setLoading(false);
  };

  const loadLikedPosts = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("user_post_likes")
      .select("post_id")
      .eq("user_id", user.id);

    setLikedPosts(new Set(data.map((like) => like.post_id)));
  };

  const handleLike = async (postId) => {
    if (likedPosts.has(postId)) {
      await unlikePost(postId);
      setLikedPosts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    } else {
      await likePost(postId);
      setLikedPosts((prev) => new Set(prev).add(postId));
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="twitter-feed">
      {posts.map((post) => (
        <div key={post.post_id} className="post-card">
          <div className="post-header">
            <img
              src={post.creators?.avatar_url}
              alt={post.creators?.display_name}
            />
            <div>
              <h3>
                {post.creators?.display_name}
                {post.creators?.verified && (
                  <span className="verified-badge">✓</span>
                )}
              </h3>
              <small>
                @{post.creators?.username} ·{" "}
                {new Date(post.published_at).toLocaleString()}
              </small>
            </div>
          </div>

          <p className="post-content">{post.content}</p>

          {post.media_urls && post.media_urls.length > 0 && (
            <div className="post-media">
              {post.media_urls.map((url, i) => (
                <img key={i} src={url} alt="" />
              ))}
            </div>
          )}

          {post.ai_summary && (
            <div className="ai-summary">
              <strong>AI Summary:</strong> {post.ai_summary}
            </div>
          )}

          <div className="post-tags">
            {post.ai_tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
            {post.ai_sentiment && (
              <span className={`sentiment ${post.ai_sentiment}`}>
                {post.ai_sentiment}
              </span>
            )}
          </div>

          <div className="post-actions">
            <button
              onClick={() => handleLike(post.post_id)}
              className={likedPosts.has(post.post_id) ? "liked" : ""}
            >
              ❤️ {post.likes_count}
            </button>
            <button onClick={() => favoritePost(post.post_id)}>
              ⭐ Favorite
            </button>
            <a
              href={post.content_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              🔗 View on Twitter
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TwitterFeed;
```

---

## 11. 注意事项

### 11.1 性能优化

- 使用分页避免一次加载过多数据
- 使用 `select()` 只获取需要的字段
- 为常用查询条件添加索引

### 11.2 错误处理

```javascript
const safeFetch = async (fetchFn) => {
  try {
    const data = await fetchFn();
    return { data, error: null };
  } catch (error) {
    console.error("Fetch error:", error);
    return { data: null, error };
  }
};

// 使用示例
const { data, error } = await safeFetch(() => getLatestPosts(20));
if (error) {
  // 处理错误
}
```

### 11.3 Realtime 订阅管理

- 组件卸载时务必取消订阅
- 避免重复订阅同一个 channel
- 使用唯一的 channel 名称

### 11.4 RLS (Row Level Security)

- 所有表都启用了 RLS
- 用户只能访问自己的数据（likes, favorites, notifications）
- social_posts 表对所有用户可读

---

## 12. 联系和支持

如有问题，请联系后端团队或查看 Supabase 文档：

- Supabase Docs: https://supabase.com/docs
- GraphQL Guide: https://supabase.com/docs/guides/api/graphql

---

## 13. 迁移说明 (v1.0 → v2.0)

### 数据库架构变更

**v2.0 重大更新：** 新增 `creators` 表，重构 creator 信息存储方式。

#### 变更内容：

1. **新增表：`creators`**

   - 统一存储所有平台的 KOL/创作者信息
   - 支持热门排行、影响力评分等新功能

2. **`social_posts` 表变更：**

   - ❌ 移除：`creator_name`、`creator_avatar_url`
   - ✅ 新增：`creator_ref` (外键关联到 creators.id)

3. **`user_kol_entries` 表变更：**
   - ✅ 新增：`creator_ref` (外键关联到 creators.id)
   - 保留：`platform`、`kol_id` (向后兼容)

#### 前端迁移步骤：

1. **更新所有 `social_posts` 查询**，使用 JOIN 获取 creator 信息：

   ```javascript
   // 旧代码
   .select('*, creator_name, creator_avatar_url')

   // 新代码
   .select('*, creators (display_name, avatar_url, username, verified)')
   ```

2. **更新数据访问方式**：

   ```javascript
   // 旧代码
   post.creator_name;
   post.creator_avatar_url;

   // 新代码
   post.creators.display_name;
   post.creators.avatar_url;
   ```

3. **利用新功能**：
   ```javascript
   // 现在可以直接查询热门 KOL
   const trendingKOLs = await getTrendingKOLs(10);
   ```

---

**文档版本:** v2.0 (重大更新)
**最后更新:** 2025-11-04
**维护者:** Backend Team

### 版本历史

- **v2.0** (2025-11-04): 新增 `creators` 表，重构 creator 信息存储，添加热门 KOL 功能
- **v1.0** (2025-11-03): 初始版本
