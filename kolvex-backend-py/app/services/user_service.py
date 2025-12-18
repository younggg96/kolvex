"""
用户服务 - 处理用户 Profile 相关业务逻辑
"""

from typing import Optional, Dict, Any, List
from supabase import Client
from app.schemas.user import (
    UserProfileCreate,
    UserProfileUpdate,
    UserProfileResponse,
    UserThemeUpdate,
    UserNotificationUpdate,
    UserFollowResponse,
    FollowStatusResponse,
    FollowListResponse,
    FollowUserInfo,
)
from fastapi import HTTPException, status


class UserService:
    """用户服务类"""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def get_user_profile(self, user_id: str) -> UserProfileResponse:
        """
        获取用户资料

        Args:
            user_id: 用户 ID

        Returns:
            UserProfileResponse: 用户资料

        Raises:
            HTTPException: 404 如果用户不存在
        """
        try:
            response = (
                self.supabase.table("user_profiles")
                .select("*")
                .eq("id", user_id)
                .single()
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="user profile not found",
                )

            return UserProfileResponse(**response.data)

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"get user profile error: {str(e)}",
            )

    async def get_user_profile_by_email(
        self, email: str
    ) -> Optional[UserProfileResponse]:
        """
        通过邮箱获取用户资料

        Args:
            email: 用户邮箱

        Returns:
            Optional[UserProfileResponse]: 用户资料或 None
        """
        try:
            response = (
                self.supabase.table("user_profiles")
                .select("*")
                .eq("email", email)
                .single()
                .execute()
            )

            if not response.data:
                return None

            return UserProfileResponse(**response.data)

        except Exception:
            return None

    async def create_user_profile(
        self, user_id: str, profile_data: UserProfileCreate
    ) -> UserProfileResponse:
        """
        创建用户资料（通常在用户注册后自动调用）

        Args:
            user_id: 用户 ID（来自 Supabase Auth）
            profile_data: 用户资料数据

        Returns:
            UserProfileResponse: 创建的用户资料

        Raises:
            HTTPException: 400 如果创建失败
        """
        try:
            # 准备插入数据
            insert_data = {
                "id": user_id,
                "email": profile_data.email,
                "username": profile_data.username,
                "full_name": profile_data.full_name,
                "avatar_url": profile_data.avatar_url,
            }

            response = (
                self.supabase.table("user_profiles").insert(insert_data).execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="create user profile error",
                )

            return UserProfileResponse(**response.data[0])

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"create user profile error: {str(e)}",
            )

    async def update_user_profile(
        self, user_id: str, profile_update: UserProfileUpdate
    ) -> UserProfileResponse:
        """
        更新用户资料

        Args:
            user_id: 用户 ID
            profile_update: 更新数据

        Returns:
            UserProfileResponse: 更新后的用户资料

        Raises:
            HTTPException: 404 如果用户不存在，400 如果更新失败
        """
        try:
            # 只更新提供的字段
            update_data = profile_update.model_dump(exclude_unset=True)

            if not update_data:
                # 如果没有要更新的数据，直接返回当前资料
                return await self.get_user_profile(user_id)

            response = (
                self.supabase.table("user_profiles")
                .update(update_data)
                .eq("id", user_id)
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="user profile not found",
                )

            return UserProfileResponse(**response.data[0])

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"update user profile error: {str(e)}",
            )

    async def update_user_theme(
        self, user_id: str, theme_update: UserThemeUpdate
    ) -> UserProfileResponse:
        """
        更新用户主题偏好

        Args:
            user_id: 用户 ID
            theme_update: 主题更新数据

        Returns:
            UserProfileResponse: 更新后的用户资料
        """
        try:
            # theme_update.theme 已经是字符串（因为 use_enum_values=True）
            response = (
                self.supabase.table("user_profiles")
                .update({"theme": theme_update.theme})
                .eq("id", user_id)
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="user profile not found",
                )

            return UserProfileResponse(**response.data[0])

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"update user theme error: {str(e)}",
            )

    async def update_user_notification(
        self, user_id: str, notification_update: UserNotificationUpdate
    ) -> UserProfileResponse:
        """
        更新用户通知设置

        Args:
            user_id: 用户 ID
            notification_update: 通知设置更新数据

        Returns:
            UserProfileResponse: 更新后的用户资料
        """
        try:
            update_data = notification_update.model_dump(exclude_unset=True)

            if not update_data:
                return await self.get_user_profile(user_id)

            response = (
                self.supabase.table("user_profiles")
                .update(update_data)
                .eq("id", user_id)
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="user profile not found",
                )

            return UserProfileResponse(**response.data[0])

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"update notification settings error: {str(e)}",
            )

    async def delete_user_profile(self, user_id: str) -> Dict[str, Any]:
        """
        删除用户资料（软删除或硬删除）

        Args:
            user_id: 用户 ID

        Returns:
            Dict: 删除结果

        Raises:
            HTTPException: 404 如果用户不存在
        """
        try:
            # 注意：这会硬删除用户资料
            # 如果需要软删除，可以添加一个 deleted_at 字段
            response = (
                self.supabase.table("user_profiles")
                .delete()
                .eq("id", user_id)
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="user profile not found",
                )

            return {
                "success": True,
                "message": "user profile deleted",
                "user_id": user_id,
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"delete user profile error: {str(e)}",
            )

    async def list_users(
        self, page: int = 1, page_size: int = 50, search: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取用户列表（管理员功能）

        Args:
            page: 页码（从 1 开始）
            page_size: 每页数量
            search: 搜索关键词（搜索邮箱或用户名）

        Returns:
            Dict: 包含用户列表和分页信息
        """
        try:
            # 计算偏移量
            offset = (page - 1) * page_size

            # 构建查询
            query = self.supabase.table("user_profiles").select("*", count="exact")

            # 如果有搜索关键词
            if search:
                query = query.or_(f"email.ilike.%{search}%,username.ilike.%{search}%")

            # 执行查询
            response = query.range(offset, offset + page_size - 1).execute()

            users = (
                [UserProfileResponse(**user) for user in response.data]
                if response.data
                else []
            )

            return {
                "users": users,
                "total": response.count or 0,
                "page": page,
                "page_size": page_size,
            }

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"get users list error: {str(e)}",
            )

    # ===== Follow 相关方法 =====

    async def follow_user(
        self, follower_id: str, following_id: str
    ) -> UserFollowResponse:
        """
        关注用户

        Args:
            follower_id: 关注者用户ID
            following_id: 被关注者用户ID

        Returns:
            UserFollowResponse: 关注记录

        Raises:
            HTTPException: 400 如果尝试关注自己或已关注
        """
        if follower_id == following_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="can't follow yourself"
            )

        try:
            # 检查是否已经关注
            existing = (
                self.supabase.table("user_follows")
                .select("*")
                .eq("follower_id", follower_id)
                .eq("following_id", following_id)
                .execute()
            )

            if existing.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="already follow this user",
                )

            # 检查被关注用户是否存在
            target_user = (
                self.supabase.table("user_profiles")
                .select("id")
                .eq("id", following_id)
                .single()
                .execute()
            )

            if not target_user.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="user not found"
                )

            # 创建关注记录
            response = (
                self.supabase.table("user_follows")
                .insert({"follower_id": follower_id, "following_id": following_id})
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="follow user error"
                )

            return UserFollowResponse(**response.data[0])

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"follow user error: {str(e)}",
            )

    async def unfollow_user(
        self, follower_id: str, following_id: str
    ) -> Dict[str, Any]:
        """
        取消关注用户

        Args:
            follower_id: 关注者用户ID
            following_id: 被关注者用户ID

        Returns:
            Dict: 操作结果

        Raises:
            HTTPException: 404 如果未关注该用户
        """
        try:
            response = (
                self.supabase.table("user_follows")
                .delete()
                .eq("follower_id", follower_id)
                .eq("following_id", following_id)
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="not follow this user",
                )

            return {"success": True, "message": "unfollow user success"}

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"unfollow user error: {str(e)}",
            )

    async def get_follow_status(
        self, current_user_id: Optional[str], target_user_id: str
    ) -> FollowStatusResponse:
        """
        获取关注状态

        Args:
            current_user_id: 当前用户ID（可选，用于判断是否关注）
            target_user_id: 目标用户ID

        Returns:
            FollowStatusResponse: 关注状态
        """
        try:
            # 获取目标用户的 followers_count 和 following_count
            user_response = (
                self.supabase.table("user_profiles")
                .select("followers_count, following_count")
                .eq("id", target_user_id)
                .single()
                .execute()
            )

            followers_count = 0
            following_count = 0
            if user_response.data:
                followers_count = user_response.data.get("followers_count", 0) or 0
                following_count = user_response.data.get("following_count", 0) or 0

            # 检查当前用户是否关注目标用户
            is_following = False
            if current_user_id and current_user_id != target_user_id:
                follow_check = (
                    self.supabase.table("user_follows")
                    .select("id")
                    .eq("follower_id", current_user_id)
                    .eq("following_id", target_user_id)
                    .execute()
                )
                is_following = bool(follow_check.data)

            return FollowStatusResponse(
                is_following=is_following,
                followers_count=followers_count,
                following_count=following_count,
            )

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"get follow status error: {str(e)}",
            )

    async def get_followers(
        self,
        user_id: str,
        current_user_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> FollowListResponse:
        """
        获取用户的粉丝列表

        Args:
            user_id: 目标用户ID
            current_user_id: 当前用户ID（用于判断互相关注状态）
            page: 页码
            page_size: 每页数量

        Returns:
            FollowListResponse: 粉丝列表
        """
        try:
            offset = (page - 1) * page_size

            # 获取粉丝列表
            response = (
                self.supabase.table("user_follows")
                .select("follower_id, created_at", count="exact")
                .eq("following_id", user_id)
                .order("created_at", desc=True)
                .range(offset, offset + page_size - 1)
                .execute()
            )

            follower_ids = (
                [f["follower_id"] for f in response.data] if response.data else []
            )

            # 获取用户信息
            users = []
            if follower_ids:
                user_response = (
                    self.supabase.table("user_profiles")
                    .select("id, username, full_name, avatar_url")
                    .in_("id", follower_ids)
                    .execute()
                )

                user_map = (
                    {u["id"]: u for u in user_response.data}
                    if user_response.data
                    else {}
                )

                # 检查当前用户是否关注这些粉丝
                following_set = set()
                if current_user_id:
                    following_check = (
                        self.supabase.table("user_follows")
                        .select("following_id")
                        .eq("follower_id", current_user_id)
                        .in_("following_id", follower_ids)
                        .execute()
                    )
                    following_set = (
                        {f["following_id"] for f in following_check.data}
                        if following_check.data
                        else set()
                    )

                for fid in follower_ids:
                    user_info = user_map.get(fid, {})
                    users.append(
                        FollowUserInfo(
                            user_id=fid,
                            username=user_info.get("username"),
                            full_name=user_info.get("full_name"),
                            avatar_url=user_info.get("avatar_url"),
                            is_following=fid in following_set,
                        )
                    )

            return FollowListResponse(
                users=users, total=response.count or 0, page=page, page_size=page_size
            )

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"get followers list error: {str(e)}",
            )

    async def get_following(
        self,
        user_id: str,
        current_user_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> FollowListResponse:
        """
        获取用户的关注列表

        Args:
            user_id: 目标用户ID
            current_user_id: 当前用户ID（用于判断是否也关注）
            page: 页码
            page_size: 每页数量

        Returns:
            FollowListResponse: 关注列表
        """
        try:
            offset = (page - 1) * page_size

            # 获取关注列表
            response = (
                self.supabase.table("user_follows")
                .select("following_id, created_at", count="exact")
                .eq("follower_id", user_id)
                .order("created_at", desc=True)
                .range(offset, offset + page_size - 1)
                .execute()
            )

            following_ids = (
                [f["following_id"] for f in response.data] if response.data else []
            )

            # 获取用户信息
            users = []
            if following_ids:
                user_response = (
                    self.supabase.table("user_profiles")
                    .select("id, username, full_name, avatar_url")
                    .in_("id", following_ids)
                    .execute()
                )

                user_map = (
                    {u["id"]: u for u in user_response.data}
                    if user_response.data
                    else {}
                )

                # 检查当前用户是否也关注这些用户
                following_set = set()
                if current_user_id and current_user_id != user_id:
                    following_check = (
                        self.supabase.table("user_follows")
                        .select("following_id")
                        .eq("follower_id", current_user_id)
                        .in_("following_id", following_ids)
                        .execute()
                    )
                    following_set = (
                        {f["following_id"] for f in following_check.data}
                        if following_check.data
                        else set()
                    )
                elif current_user_id == user_id:
                    # 如果查看的是自己的关注列表，所有人都是已关注状态
                    following_set = set(following_ids)

                for fid in following_ids:
                    user_info = user_map.get(fid, {})
                    users.append(
                        FollowUserInfo(
                            user_id=fid,
                            username=user_info.get("username"),
                            full_name=user_info.get("full_name"),
                            avatar_url=user_info.get("avatar_url"),
                            is_following=fid in following_set,
                        )
                    )

            return FollowListResponse(
                users=users, total=response.count or 0, page=page, page_size=page_size
            )

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"get following list error: {str(e)}",
            )

    async def check_batch_following(
        self, current_user_id: str, user_ids: List[str]
    ) -> Dict[str, bool]:
        """
        批量检查当前用户是否关注了指定用户列表

        Args:
            current_user_id: 当前用户ID
            user_ids: 要检查的用户ID列表

        Returns:
            Dict[str, bool]: 用户ID到是否关注的映射
        """
        if not user_ids:
            return {}

        try:
            response = (
                self.supabase.table("user_follows")
                .select("following_id")
                .eq("follower_id", current_user_id)
                .in_("following_id", user_ids)
                .execute()
            )

            following_set = (
                {f["following_id"] for f in response.data} if response.data else set()
            )

            return {uid: uid in following_set for uid in user_ids}

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"get follow status error: {str(e)}",
            )
