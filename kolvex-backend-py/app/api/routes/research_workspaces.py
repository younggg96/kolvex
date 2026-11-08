"""
Research workspaces

GET    /research-workspaces                       — List the user's workspaces
POST   /research-workspaces                       — Create a workspace
GET    /research-workspaces/{id}                  — Workspace with chats, runs and the latest run
PATCH  /research-workspaces/{id}                  — Rename, edit brief or tickers
DELETE /research-workspaces/{id}                  — Delete a workspace (chats stay)
POST   /research-workspaces/{id}/chats            — Add a chat (moves it from another workspace)
DELETE /research-workspaces/chats/{conversation}  — Remove a chat from its workspace
GET    /research-workspaces/by-chat/{conversation}— The workspace a chat belongs to, or null
POST   /research-workspaces/{id}/runs             — Start a multi-agent research run
GET    /research-workspaces/runs/{run_id}         — Run status with each researcher's result
"""
import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from app.services import research_workspace as ws
from app.services.user_api_keys_service import UserApiKeysService, get_user_api_keys_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/research-workspaces", tags=["Research Workspaces"])


class WorkspaceBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    brief: str = Field(default="", max_length=4000)
    tickers: list[str] = Field(default_factory=list, max_length=10)


class WorkspacePatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    brief: Optional[str] = Field(default=None, max_length=4000)
    tickers: Optional[list[str]] = Field(default=None, max_length=10)


class AttachBody(BaseModel):
    conversation_id: str


class RunBody(BaseModel):
    question: str = Field(default="", max_length=2000)
    agents: Optional[list[str]] = None
    model: Optional[str] = None


async def call(fn, *args):
    try:
        return await asyncio.to_thread(fn, get_supabase_service(), *args)
    except ws.WorkspaceError as error:
        raise HTTPException(status_code=error.status, detail=error.code) from None
    except HTTPException:
        raise
    except Exception as error:  # missing tables before the migration, or a DB outage
        logger.warning("Research workspace request failed: %s", error)
        raise HTTPException(status_code=503, detail="workspace_unavailable") from None


@router.get("")
async def list_workspaces(user_id: str = Depends(get_current_user_id)):
    return {"workspaces": await call(ws.list_workspaces, user_id)}


@router.post("")
async def create_workspace(body: WorkspaceBody, user_id: str = Depends(get_current_user_id)):
    return await call(ws.create_workspace, user_id, body.title, body.brief, body.tickers)


@router.get("/by-chat/{conversation_id}")
async def workspace_for_chat(conversation_id: str, user_id: str = Depends(get_current_user_id)):
    return {"workspace": await call(ws.chat_workspace, user_id, conversation_id)}


@router.delete("/chats/{conversation_id}")
async def detach_chat(conversation_id: str, user_id: str = Depends(get_current_user_id)):
    await call(ws.detach_chat, user_id, conversation_id)
    return {"success": True}


@router.get("/runs/{run_id}")
async def get_run(run_id: str, user_id: str = Depends(get_current_user_id)):
    return await call(ws.get_run, user_id, run_id)


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str, user_id: str = Depends(get_current_user_id)):
    return await call(ws.get_workspace_detail, user_id, workspace_id)


@router.patch("/{workspace_id}")
async def update_workspace(workspace_id: str, body: WorkspacePatch, user_id: str = Depends(get_current_user_id)):
    return await call(ws.update_workspace, user_id, workspace_id, body.model_dump(exclude_unset=True))


@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str, user_id: str = Depends(get_current_user_id)):
    await call(ws.delete_workspace, user_id, workspace_id)
    return {"success": True}


@router.post("/{workspace_id}/chats")
async def attach_chat(workspace_id: str, body: AttachBody, user_id: str = Depends(get_current_user_id)):
    return await call(ws.attach_chat, user_id, workspace_id, body.conversation_id)


@router.post("/{workspace_id}/runs")
async def start_run(
    workspace_id: str,
    body: RunBody,
    user_id: str = Depends(get_current_user_id),
    keys: UserApiKeysService = Depends(get_user_api_keys_service),
):
    from app.agent.llm import resolve_model_id
    provider, model = resolve_model_id(body.model)
    run = await call(ws.start_run, user_id, workspace_id, body.question, body.agents, model)
    try:
        user_api_keys = await keys.get_keys_dict(user_id)
    except Exception:  # noqa: BLE001 — fall back to server keys
        user_api_keys = None
    ws.launch(get_supabase_service(), run, user_id, provider, model, user_api_keys)
    return {key: value for key, value in run.items() if key != "workspace"}
