"""
Shared Gemini integration for the LangGraph nodes.

This module OWNS the single, shared `genai.Client` instance and the model
name for the whole FastAPI service. It reuses the exact same google-genai
integration the service already relied on — the client, the model constant,
and the structured-output pattern (response_mime_type + response_schema) are
unchanged; they are simply centralized here so both the graph nodes and the
remaining (non-migrated) endpoints in main.py import one client instead of
creating their own.
"""

import os
import json
import asyncio
from typing import Optional, Type, TypeVar

from dotenv import load_dotenv
from fastapi import HTTPException
from google import genai
from google.genai import types
from google.genai import errors as genai_errors
from pydantic import BaseModel

load_dotenv()

# ── Gemini config ───────────────────────────────────────────────────────────
# Centralised model name — change this single constant when migrating models.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "Missing GEMINI_API_KEY environment variable. "
        "Get a free key at https://aistudio.google.com/app/apikey and add it to backend/.env"
    )

# Single shared client, reused across the whole service.
gemini = genai.Client(api_key=GEMINI_API_KEY)

print(f"[TrueHire] Gemini client initialised  model={GEMINI_MODEL}  key={GEMINI_API_KEY[:8]}...")


T = TypeVar("T", bound=BaseModel)


async def generate_structured(
    *,
    schema: Type[T],
    contents,
    system_instruction: Optional[str] = None,
    temperature: float = 0.2,
    error_prefix: str = "Gemini",
) -> T:
    """
    Run a schema-validated Gemini generation and return the parsed Pydantic model.

    This preserves the exact behavior the service used before: JSON mode with a
    `response_schema`, the blocking SDK call offloaded via `asyncio.to_thread`,
    and HTTP 502 errors on API failure / empty response / invalid JSON.
    """
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature,
    )
    if system_instruction is not None:
        config.system_instruction = system_instruction

    try:
        response = await asyncio.to_thread(
            gemini.models.generate_content,
            model=GEMINI_MODEL,
            contents=contents,
            config=config,
        )
    except genai_errors.APIError as e:
        raise HTTPException(502, f"{error_prefix} API error: {e}")

    if not response.text:
        raise HTTPException(502, f"{error_prefix} returned an empty response.")

    try:
        return schema.model_validate(json.loads(response.text))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(502, f"{error_prefix} returned invalid JSON: {e}")
