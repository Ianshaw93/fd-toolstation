# backendForNextApp — tool-search analytics

Apply on **Fire-Dynamics-Group/backendForNextApp** (Railway Postgres). This
toolstation repo cannot push that backend (`cursor[bot]` has no write access).

Endpoints the toolstation client calls (same `NEXT_PUBLIC_API_URL` as EFS/smoke):

- `POST /tool-search/log`
- `POST /tool-search/click`

## Files to copy

| This patch | Destination in backendForNextApp |
|---|---|
| `models_tool_search.py` | `models/tool_search.py` |
| `routers_tool_search.py` | `routers/tool_search.py` |
| `alembic_d8e4a1c0b7f2_add_tool_search_analytics.py` | `alembic/versions/d8e4a1c0b7f2_add_tool_search_analytics.py` |

## `main.py`

```python
from routers.tool_search import router as tool_search_router
app.include_router(tool_search_router, prefix="/tool-search", tags=["Tool Search"])
```

Railway often boots without `alembic upgrade`. Mirror fee-text-block startup
and `create_all` for `ToolSearchLog` + `ToolSearchClick` so the tables exist
even if the migration has not run.

## Identity

Columns `user_id` / `user_email` are nullable. Homepage Profile/Logout in
fd-toolstation are decorative. When FD Entra / Mail Marshal Easy Auth is
fronting the app, toolstation already forwards:

- `x-ms-client-principal-id`
- `x-ms-client-principal-name`

Do not block UX on SSO.
