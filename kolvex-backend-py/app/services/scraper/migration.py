"""
数据迁移工具
"""

import os
import sqlite3

from .database import get_supabase_client


def migrate_sqlite_to_supabase(sqlite_path: str) -> int:
    """
    将 SQLite 数据迁移到 Supabase

    Args:
        sqlite_path: SQLite 数据库文件路径

    Returns:
        int: 迁移的记录数
    """
    supabase = get_supabase_client()
    if not supabase:
        print("❌ 无法连接 Supabase")
        return 0

    if not os.path.exists(sqlite_path):
        print(f"❌ SQLite 文件不存在: {sqlite_path}")
        return 0

    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM tweets")
    rows = cursor.fetchall()

    migrated = 0
    for row in rows:
        try:
            data = {
                "username": row["username"],
                "tweet_text": row["tweet_text"],
                "tweet_hash": row["tweet_hash"],
                "created_at": row["created_at"],
                "permalink": row["permalink"],
                "like_count": row["like_count"] or 0,
                "retweet_count": row["retweet_count"] or 0,
                "reply_count": row["reply_count"] or 0,
                "scraped_at": row["scraped_at"],
            }
            supabase.table("kol_tweets").upsert(
                data, on_conflict="tweet_hash"
            ).execute()
            migrated += 1
            print(f"  ✅ 迁移: @{row['username']}: {row['tweet_text'][:30]}...")
        except Exception as e:
            print(f"  ⚠️ 跳过: {e}")

    conn.close()
    print(f"\n✅ 迁移完成: {migrated}/{len(rows)} 条记录")
    return migrated

