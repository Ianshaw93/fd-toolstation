"""Ingest homepage tool-search logs and clicks. Never required for search UX."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.tool_search import ToolSearchClick, ToolSearchClickIn, ToolSearchLog, ToolSearchLogIn

router = APIRouter()


@router.post("/logs", status_code=204)
async def record_log(data: ToolSearchLogIn, db: AsyncSession = Depends(get_db)):
    db.add(
        ToolSearchLog(
            id=uuid.uuid4(),
            client_search_id=data.client_search_id,
            query=data.query,
            query_normalized=data.query_normalized or data.query.lower(),
            result_count=data.result_count,
            top_ids=data.top_ids,
            suggestion_id=data.suggestion_id,
            confidence=data.confidence,
            mode=data.mode,
            latency_ms=data.latency_ms,
            anon_id=data.anon_id,
            user_id=data.user_id,
            user_email=data.user_email,
            source=data.source,
        )
    )
    await db.commit()


@router.post("/clicks", status_code=204)
async def record_click(data: ToolSearchClickIn, db: AsyncSession = Depends(get_db)):
    db.add(
        ToolSearchClick(
            id=uuid.uuid4(),
            client_search_id=data.client_search_id,
            part_id=data.part_id,
            rank=data.rank,
            anon_id=data.anon_id,
            user_id=data.user_id,
            user_email=data.user_email,
            source=data.source,
        )
    )
    await db.commit()
