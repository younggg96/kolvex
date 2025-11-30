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
            response = self.supabase.table("user_profiles").select("*").eq("id", user_id).single().execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="用户资料未找到"
                )
            
            return UserProfileResponse(**response.data)
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取用户资料失败: {str(e)}"
            )
    
    async def get_user_profile_by_email(self, email: str) -> Optional[UserProfileResponse]:
        """
        通过邮箱获取用户资料
        
        Args:
            email: 用户邮箱
            
        Returns:
            Optional[UserProfileResponse]: 用户资料或 None
        """
        try:
            response = self.supabase.table("user_profiles").select("*").eq("email", email).single().execute()
            
            if not response.data:
                return None
            
            return UserProfileResponse(**response.data)
            
        except Exception:
            return None
    
    async def create_user_profile(self, user_id: str, profile_data: UserProfileCreate) -> UserProfileResponse:
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
            
            response = self.supabase.table("user_profiles").insert(insert_data).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="创建用户资料失败"
                )
            
            return UserProfileResponse(**response.data[0])
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建用户资料失败: {str(e)}"
            )
    
    async def update_user_profile(
        self, 
        user_id: str, 
        profile_update: UserProfileUpdate
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
                    detail="用户资料未找到"
                )
            
            return UserProfileResponse(**response.data[0])
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新用户资料失败: {str(e)}"
            )
    
    async def update_user_theme(self, user_id: str, theme_update: UserThemeUpdate) -> UserProfileResponse:
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
                    detail="用户资料未找到"
                )
            
            return UserProfileResponse(**response.data[0])
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新用户主题失败: {str(e)}"
            )
    
    async def update_user_notification(
        self, 
        user_id: str, 
        notification_update: UserNotificationUpdate
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
                    detail="用户资料未找到"
                )
            
            return UserProfileResponse(**response.data[0])
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新通知设置失败: {str(e)}"
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
                    detail="用户资料未找到"
                )
            
            return {
                "success": True,
                "message": "用户资料已删除",
                "user_id": user_id
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除用户资料失败: {str(e)}"
            )
    
    async def list_users(
        self, 
        page: int = 1, 
        page_size: int = 50,
        search: Optional[str] = None
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
            
            users = [UserProfileResponse(**user) for user in response.data] if response.data else []
            
            return {
                "users": users,
                "total": response.count or 0,
                "page": page,
                "page_size": page_size,
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取用户列表失败: {str(e)}"
            )

