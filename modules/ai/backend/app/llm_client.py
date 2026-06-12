from __future__ import annotations

import time
from typing import Any

import httpx

from .config import settings


class LlmError(RuntimeError):
    pass


async def run_chat(prompt: str, system_prompt: str | None = None) -> dict[str, Any]:
    started_at = time.perf_counter()

    if settings.ai_provider == "openai-compatible":
        content = await run_openai_compatible_chat(prompt, system_prompt)
    else:
        content = await run_ollama_chat(prompt, system_prompt)

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    return {
        "provider": settings.ai_provider,
        "model": settings.ai_model,
        "content": content,
        "durationMs": duration_ms,
    }


async def run_ollama_chat(prompt: str, system_prompt: str | None = None) -> str:
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": settings.ai_model,
        "messages": messages,
        "stream": False,
        "keep_alive": "30m",
    }

    async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
        response = await client.post(f"{settings.ai_base_url.rstrip('/')}/api/chat", json=payload)

    if response.status_code >= 400:
        raise LlmError(f"Ollama returned HTTP {response.status_code}: {response.text}")

    data = response.json()
    return str(data.get("message", {}).get("content", "")).strip()


async def run_openai_compatible_chat(prompt: str, system_prompt: str | None = None) -> str:
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    headers = {"Content-Type": "application/json"}
    if settings.ai_api_key:
        headers["Authorization"] = f"Bearer {settings.ai_api_key}"

    payload = {
        "model": settings.ai_model,
        "messages": messages,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
        response = await client.post(
            f"{settings.ai_base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json=payload,
        )

    if response.status_code >= 400:
        raise LlmError(f"OpenAI-compatible endpoint returned HTTP {response.status_code}: {response.text}")

    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        return ""

    return str(choices[0].get("message", {}).get("content", "")).strip()
