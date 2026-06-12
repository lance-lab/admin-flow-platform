from datetime import datetime, timezone
from typing import Any

import httpx
import psycopg
from fastapi import FastAPI, HTTPException
from psycopg.rows import dict_row
from pydantic import BaseModel, ConfigDict, Field

from .config import settings
from .llm_client import LlmError, run_chat

app = FastAPI(title="AI Module API", version="0.1.0")


def db_connect():
    return psycopg.connect(settings.database_url, row_factory=dict_row)


class ChatInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    prompt: str = Field(min_length=1, max_length=8000)
    system_prompt: str | None = Field(default=None, alias="systemPrompt", max_length=4000)


class ChatOutput(BaseModel):
    id: str
    provider: str
    model: str
    response: str
    duration_ms: int = Field(alias="durationMs")
    created_at: datetime = Field(alias="createdAt")


@app.on_event("startup")
def apply_compatibility_migrations() -> None:
    with db_connect() as conn:
        conn.execute("CREATE SCHEMA IF NOT EXISTS ai;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ai.model_runs (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              provider TEXT NOT NULL,
              model TEXT NOT NULL,
              prompt TEXT NOT NULL,
              response TEXT NOT NULL,
              duration_ms INTEGER,
              status TEXT NOT NULL DEFAULT 'completed',
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS ai_model_runs_created_at_idx
            ON ai.model_runs (created_at DESC);
            """
        )
        conn.execute(
            """
            INSERT INTO platform.permissions (code, description)
            VALUES ('ai.read', 'Read and use AI assistance')
            ON CONFLICT (code) DO NOTHING;
            """
        )
        conn.execute(
            """
            INSERT INTO platform.role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM platform.roles r
            JOIN platform.permissions p ON p.code = 'ai.read'
            WHERE r.code IN ('admin', 'platform_admin')
            ON CONFLICT DO NOTHING;
            """
        )
        conn.execute(
            """
            INSERT INTO platform.modules (code, name, description, route_path, backend_base_url, required_permission, enabled)
            VALUES (
              'ai',
              'AI Assistant',
              'Local AI prompt testing and model run history.',
              '/modules/ai',
              'http://ai-api:8000',
              'ai.read',
              TRUE
            )
            ON CONFLICT (code) DO UPDATE
            SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              route_path = EXCLUDED.route_path,
              backend_base_url = EXCLUDED.backend_base_url,
              required_permission = EXCLUDED.required_permission,
              enabled = EXCLUDED.enabled,
              updated_at = now();
            """
        )
        conn.execute(
            """
            INSERT INTO platform.module_translations (module_code, locale, name, description)
            VALUES
              ('ai', 'sk', 'AI asistent', 'Lokálne AI testovanie promptov a história behov modelu.'),
              ('ai', 'en', 'AI Assistant', 'Local AI prompt testing and model run history.')
            ON CONFLICT (module_code, locale) DO UPDATE
            SET
              name = EXCLUDED.name,
              description = EXCLUDED.description;
            """
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-api"}


@app.get("/api/overview")
def overview() -> dict[str, object]:
    return {
        "module": "ai",
        "status": "Ready",
        "provider": settings.ai_provider,
        "model": settings.ai_model,
        "capabilities": [
            "Local model chat",
            "Slovak prompt testing",
            "Model run history",
            "Worker-ready AI jobs",
        ],
    }


@app.post("/api/chat", response_model=ChatOutput)
async def chat(input_data: ChatInput) -> dict[str, Any]:
    try:
        result = await run_chat(input_data.prompt, input_data.system_prompt)
    except (httpx.RequestError, LlmError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="AI request failed") from error

    created_at = datetime.now(timezone.utc)

    with db_connect() as conn:
        row = conn.execute(
            """
            INSERT INTO ai.model_runs (provider, model, prompt, response, duration_ms, created_at)
            VALUES (%(provider)s, %(model)s, %(prompt)s, %(response)s, %(duration_ms)s, %(created_at)s)
            RETURNING id, provider, model, response, duration_ms, created_at
            """,
            {
                "provider": result["provider"],
                "model": result["model"],
                "prompt": input_data.prompt,
                "response": result["content"],
                "duration_ms": result["durationMs"],
                "created_at": created_at,
            },
        ).fetchone()

    return {
        "id": str(row["id"]),
        "provider": row["provider"],
        "model": row["model"],
        "response": row["response"],
        "durationMs": row["duration_ms"],
        "createdAt": row["created_at"],
    }


@app.get("/api/model-runs")
def list_model_runs() -> dict[str, list[dict[str, Any]]]:
    with db_connect() as conn:
        rows = conn.execute(
            """
            SELECT id, provider, model, prompt, response, duration_ms, status, created_at
            FROM ai.model_runs
            ORDER BY created_at DESC
            LIMIT 25
            """
        ).fetchall()

    return {
        "modelRuns": [
            {
                "id": str(row["id"]),
                "provider": row["provider"],
                "model": row["model"],
                "prompt": row["prompt"],
                "response": row["response"],
                "durationMs": row["duration_ms"],
                "status": row["status"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ]
    }
