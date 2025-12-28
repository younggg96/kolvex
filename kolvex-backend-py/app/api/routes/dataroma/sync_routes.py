"""
Dataroma 数据同步 API 路由
提供手动触发数据同步的接口
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Optional
from datetime import datetime
import logging
import asyncio

from app.core.supabase import get_supabase_service
from app.services.dataroma.scraper import DataromaScraper
from app.services.dataroma.sync import (
    sync_superinvestors,
    sync_holdings,
    sync_all_holdings,
    get_current_quarter,
)
from .schemas import SyncInvestorsRequest, SyncHoldingsRequest, SyncResponse

router = APIRouter()
logger = logging.getLogger(__name__)

# 同步状态跟踪
sync_status = {
    "investors": {
        "is_running": False,
        "last_run_at": None,
        "last_result": None,
    },
    "holdings": {
        "is_running": False,
        "last_run_at": None,
        "last_result": None,
        "progress": None,
    },
    "all": {
        "is_running": False,
        "last_run_at": None,
        "last_result": None,
        "progress": None,
    },
}


def _run_sync_investors():
    """同步投资者名单（同步执行）"""
    global sync_status
    
    try:
        sync_status["investors"]["is_running"] = True
        
        supabase = get_supabase_service()
        scraper = DataromaScraper()
        
        inserted, updated, total = sync_superinvestors(supabase, scraper)
        
        result = {
            "success": True,
            "inserted": inserted,
            "updated": updated,
            "total": total,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        sync_status["investors"]["last_result"] = result
        sync_status["investors"]["last_run_at"] = datetime.utcnow().isoformat()
        
        return result
        
    except Exception as e:
        logger.error(f"同步投资者失败: {e}")
        result = {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }
        sync_status["investors"]["last_result"] = result
        return result
        
    finally:
        sync_status["investors"]["is_running"] = False


def _run_sync_holdings(investor_code: Optional[str], report_date: str, quarter: str):
    """同步持仓数据（同步执行）"""
    global sync_status
    
    try:
        sync_status["holdings"]["is_running"] = True
        sync_status["holdings"]["progress"] = {"current": 0, "total": 0}
        
        supabase = get_supabase_service()
        scraper = DataromaScraper()
        
        if investor_code:
            # 同步单个投资者
            inserted, updated = sync_holdings(
                supabase, investor_code, report_date, quarter, scraper
            )
            result = {
                "success": True,
                "investor_code": investor_code,
                "inserted": inserted,
                "updated": updated,
                "total": inserted + updated,
                "quarter": quarter,
                "timestamp": datetime.utcnow().isoformat(),
            }
        else:
            # 同步所有投资者
            results = sync_all_holdings(
                supabase, report_date, quarter, None, scraper
            )
            
            total_inserted = sum(r[0] for r in results.values())
            total_updated = sum(r[1] for r in results.values())
            
            result = {
                "success": True,
                "investor_count": len(results),
                "inserted": total_inserted,
                "updated": total_updated,
                "total": total_inserted + total_updated,
                "quarter": quarter,
                "details": {code: {"inserted": r[0], "updated": r[1]} for code, r in results.items()},
                "timestamp": datetime.utcnow().isoformat(),
            }
        
        sync_status["holdings"]["last_result"] = result
        sync_status["holdings"]["last_run_at"] = datetime.utcnow().isoformat()
        
        return result
        
    except Exception as e:
        logger.error(f"同步持仓失败: {e}")
        result = {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }
        sync_status["holdings"]["last_result"] = result
        return result
        
    finally:
        sync_status["holdings"]["is_running"] = False
        sync_status["holdings"]["progress"] = None


def _run_sync_all(report_date: str, quarter: str):
    """同步所有数据：先同步投资者名单，再同步所有持仓"""
    global sync_status
    
    try:
        sync_status["all"]["is_running"] = True
        sync_status["all"]["progress"] = {"stage": "investors", "current": 0, "total": 0}
        
        supabase = get_supabase_service()
        scraper = DataromaScraper()
        
        # 第1步：同步投资者名单
        logger.info("=== 第1步：同步投资者名单 ===")
        inv_inserted, inv_updated, inv_total = sync_superinvestors(supabase, scraper)
        
        # 获取所有活跃投资者
        investors_result = supabase.table("superinvestors").select("code, name").eq("is_active", True).execute()
        investor_codes = [r["code"] for r in investors_result.data]
        total_investors = len(investor_codes)
        
        logger.info(f"=== 第2步：同步 {total_investors} 个投资者的持仓 ===")
        sync_status["all"]["progress"] = {"stage": "holdings", "current": 0, "total": total_investors}
        
        # 第2步：逐个同步持仓
        holdings_results = {}
        for i, code in enumerate(investor_codes, 1):
            try:
                sync_status["all"]["progress"]["current"] = i
                logger.info(f"同步进度: {i}/{total_investors} - {code}")
                
                inserted, updated = sync_holdings(supabase, code, report_date, quarter, scraper)
                holdings_results[code] = {"inserted": inserted, "updated": updated}
                
            except Exception as e:
                logger.error(f"同步 {code} 失败: {e}")
                holdings_results[code] = {"inserted": 0, "updated": 0, "error": str(e)}
        
        # 统计结果
        total_inserted = sum(r.get("inserted", 0) for r in holdings_results.values())
        total_updated = sum(r.get("updated", 0) for r in holdings_results.values())
        failed_count = sum(1 for r in holdings_results.values() if "error" in r)
        
        result = {
            "success": True,
            "message": "全量同步完成",
            "investors": {
                "inserted": inv_inserted,
                "updated": inv_updated,
                "total": inv_total,
            },
            "holdings": {
                "investor_count": total_investors,
                "inserted": total_inserted,
                "updated": total_updated,
                "total": total_inserted + total_updated,
                "failed": failed_count,
            },
            "quarter": quarter,
            "report_date": report_date,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        sync_status["all"]["last_result"] = result
        sync_status["all"]["last_run_at"] = datetime.utcnow().isoformat()
        
        logger.info(f"=== 全量同步完成 ===")
        logger.info(f"投资者: 新增 {inv_inserted}, 更新 {inv_updated}")
        logger.info(f"持仓: 新增 {total_inserted}, 更新 {total_updated}, 失败 {failed_count}")
        
        return result
        
    except Exception as e:
        logger.error(f"全量同步失败: {e}")
        result = {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }
        sync_status["all"]["last_result"] = result
        return result
        
    finally:
        sync_status["all"]["is_running"] = False
        sync_status["all"]["progress"] = None


@router.post("/sync/all", response_model=Dict)
def sync_all_api(background_tasks: BackgroundTasks):
    """
    🚀 一键同步所有数据（后台执行）
    
    完整同步流程：
    1. 从 Dataroma 抓取所有超级投资者名单
    2. 逐个抓取每个投资者的完整持仓数据
    3. 保存所有数据到 Supabase
    
    ### 注意
    - 此操作可能需要 10-30 分钟（取决于投资者数量）
    - 在后台运行，可通过 `/sync/status` 查看进度
    - 同一时间只能运行一个全量同步任务
    """
    global sync_status
    
    if sync_status["all"]["is_running"]:
        raise HTTPException(
            status_code=409,
            detail="全量同步正在进行中，请稍后再试"
        )
    
    # 获取当前季度
    report_date, quarter = get_current_quarter()
    
    # 在后台执行同步
    background_tasks.add_task(_run_sync_all, report_date, quarter)
    
    return {
        "success": True,
        "message": "全量同步任务已启动",
        "status": "running",
        "quarter": quarter,
        "report_date": report_date,
        "note": "此操作可能需要 10-30 分钟，请通过 /sync/status 查看进度",
    }


@router.post("/sync/all/now", response_model=Dict)
def sync_all_now():
    """
    🚀 一键同步所有数据（同步执行）
    
    ⚠️ 警告：此操作会阻塞请求，可能需要 10-30 分钟！
    建议使用 `/sync/all` 后台执行版本。
    """
    global sync_status
    
    if sync_status["all"]["is_running"]:
        raise HTTPException(
            status_code=409,
            detail="全量同步正在进行中，请稍后再试"
        )
    
    # 获取当前季度
    report_date, quarter = get_current_quarter()
    
    result = _run_sync_all(report_date, quarter)
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "同步失败"))
    
    return {
        "success": True,
        "message": "全量同步完成",
        "data": result,
    }


@router.post("/sync/investors", response_model=Dict)
def sync_investors_api(background_tasks: BackgroundTasks):
    """
    🔄 同步超级投资者名单
    
    从 Dataroma 抓取最新的超级投资者名单并保存到数据库。
    
    ### 行为
    - 如果投资者已存在（按 code 判断），更新其信息
    - 如果投资者不存在，创建新记录
    - 此操作在后台运行，立即返回
    """
    global sync_status
    
    if sync_status["investors"]["is_running"]:
        raise HTTPException(
            status_code=409,
            detail="投资者同步正在进行中，请稍后再试"
        )
    
    # 在后台执行同步
    background_tasks.add_task(_run_sync_investors)
    
    return {
        "success": True,
        "message": "同步任务已启动",
        "status": "running",
    }


@router.post("/sync/investors/now", response_model=Dict)
def sync_investors_now():
    """
    🔄 立即同步超级投资者名单（同步执行）
    
    同步执行，等待完成后返回结果。
    适用于需要立即获取结果的场景。
    """
    global sync_status
    
    if sync_status["investors"]["is_running"]:
        raise HTTPException(
            status_code=409,
            detail="投资者同步正在进行中，请稍后再试"
        )
    
    result = _run_sync_investors()
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "同步失败"))
    
    return {
        "success": True,
        "message": "同步完成",
        "data": result,
    }


@router.post("/sync/holdings", response_model=Dict)
def sync_holdings_api(
    request: SyncHoldingsRequest,
    background_tasks: BackgroundTasks,
):
    """
    🔄 同步持仓数据
    
    从 Dataroma 抓取投资者的持仓数据并保存到数据库。
    
    ### 请求参数
    - `investor_code`: 投资者代码（不指定则同步所有）
    - `quarter`: 季度标识（如 2024-Q4）
    - `report_date`: 报告日期（YYYY-MM-DD）
    
    ### 行为
    - 此操作在后台运行
    - 同步所有投资者可能需要较长时间
    """
    global sync_status
    
    if sync_status["holdings"]["is_running"]:
        raise HTTPException(
            status_code=409,
            detail="持仓同步正在进行中，请稍后再试"
        )
    
    # 确定季度和报告日期
    if request.quarter and request.report_date:
        quarter = request.quarter
        report_date = request.report_date
    elif request.quarter:
        # 根据季度推算报告日期
        parts = request.quarter.split("-")
        year = int(parts[0])
        q = parts[1].upper()
        quarter = request.quarter
        
        if q == "Q1":
            report_date = f"{year}-03-31"
        elif q == "Q2":
            report_date = f"{year}-06-30"
        elif q == "Q3":
            report_date = f"{year}-09-30"
        else:
            report_date = f"{year}-12-31"
    else:
        report_date, quarter = get_current_quarter()
    
    # 在后台执行同步
    background_tasks.add_task(
        _run_sync_holdings,
        request.investor_code,
        report_date,
        quarter,
    )
    
    return {
        "success": True,
        "message": "同步任务已启动",
        "status": "running",
        "quarter": quarter,
        "report_date": report_date,
        "investor_code": request.investor_code,
    }


@router.post("/sync/holdings/now", response_model=Dict)
def sync_holdings_now(request: SyncHoldingsRequest):
    """
    🔄 立即同步持仓数据（同步执行）
    
    同步执行，等待完成后返回结果。
    注意：同步所有投资者可能需要较长时间。
    
    ### 请求参数
    - `investor_code`: 投资者代码（不指定则同步所有）
    - `quarter`: 季度标识（如 2024-Q4）
    """
    global sync_status
    
    if sync_status["holdings"]["is_running"]:
        raise HTTPException(
            status_code=409,
            detail="持仓同步正在进行中，请稍后再试"
        )
    
    # 确定季度和报告日期
    if request.quarter and request.report_date:
        quarter = request.quarter
        report_date = request.report_date
    elif request.quarter:
        parts = request.quarter.split("-")
        year = int(parts[0])
        q = parts[1].upper()
        quarter = request.quarter
        
        if q == "Q1":
            report_date = f"{year}-03-31"
        elif q == "Q2":
            report_date = f"{year}-06-30"
        elif q == "Q3":
            report_date = f"{year}-09-30"
        else:
            report_date = f"{year}-12-31"
    else:
        report_date, quarter = get_current_quarter()
    
    result = _run_sync_holdings(request.investor_code, report_date, quarter)
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "同步失败"))
    
    return {
        "success": True,
        "message": "同步完成",
        "data": result,
    }


@router.get("/sync/status", response_model=Dict)
def get_sync_status():
    """
    📊 获取同步状态
    
    返回当前同步任务的状态信息。
    """
    global sync_status
    
    # 获取数据库统计
    try:
        supabase = get_supabase_service()
        
        investors_count = (
            supabase.table("superinvestors")
            .select("id", count="exact")
            .eq("is_active", True)
            .execute()
        ).count or 0
        
        holdings_count = (
            supabase.table("institutional_holdings")
            .select("id", count="exact")
            .execute()
        ).count or 0
        
        # 获取最新季度
        latest_quarter_result = (
            supabase.table("institutional_holdings")
            .select("quarter")
            .order("report_date", desc=True)
            .limit(1)
            .execute()
        )
        latest_quarter = (
            latest_quarter_result.data[0]["quarter"]
            if latest_quarter_result.data else None
        )
        
    except Exception as e:
        logger.error(f"获取统计失败: {e}")
        investors_count = 0
        holdings_count = 0
        latest_quarter = None
    
    _, current_quarter = get_current_quarter()
    
    return {
        "success": True,
        "data": {
            "all": {
                "is_running": sync_status["all"]["is_running"],
                "last_run_at": sync_status["all"]["last_run_at"],
                "last_result": sync_status["all"]["last_result"],
                "progress": sync_status["all"]["progress"],
            },
            "investors": {
                "is_running": sync_status["investors"]["is_running"],
                "last_run_at": sync_status["investors"]["last_run_at"],
                "last_result": sync_status["investors"]["last_result"],
            },
            "holdings": {
                "is_running": sync_status["holdings"]["is_running"],
                "last_run_at": sync_status["holdings"]["last_run_at"],
                "last_result": sync_status["holdings"]["last_result"],
                "progress": sync_status["holdings"]["progress"],
            },
            "database": {
                "investor_count": investors_count,
                "holding_count": holdings_count,
                "latest_quarter": latest_quarter,
                "current_quarter": current_quarter,
            },
        },
    }


@router.get("/sync/quarters", response_model=Dict)
def get_quarter_info():
    """
    📅 获取季度信息
    
    返回当前季度和可用季度列表。
    """
    report_date, current_quarter = get_current_quarter()
    
    try:
        supabase = get_supabase_service()
        
        result = (
            supabase.table("institutional_holdings")
            .select("quarter, report_date")
            .order("report_date", desc=True)
            .execute()
        )
        
        # 去重
        quarters = []
        seen = set()
        for h in (result.data or []):
            quarter = h.get("quarter")
            if quarter and quarter not in seen:
                seen.add(quarter)
                quarters.append({
                    "quarter": quarter,
                    "report_date": h.get("report_date"),
                })
        
    except Exception as e:
        logger.error(f"获取季度信息失败: {e}")
        quarters = []
    
    return {
        "success": True,
        "data": {
            "current_quarter": current_quarter,
            "current_report_date": report_date,
            "available_quarters": quarters,
        },
    }

