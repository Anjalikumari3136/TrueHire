"""
Resume-related nodes: Parse Resume.

`parse_resume_text` is the reusable business function (also imported by the
non-migrated /parse-resume endpoint in main.py). `parse_resume_node` is the
thin LangGraph wrapper that plugs it into the profile graph.
"""

from ..llm import generate_structured
from ..prompts import build_resume_parse_prompt
from ..schemas import ResumeSkills
from ..state import ProfileState


async def parse_resume_text(resume_text: str) -> ResumeSkills:
    """
    Uses Gemini with response_mime_type=application/json + response_schema
    to return schema-validated structured data — no manual JSON parsing.

    On Gemini failure / empty response / invalid JSON, raises HTTPException(502)
    — the exact structured-error behavior the endpoint had before.
    """
    return await generate_structured(
        schema=ResumeSkills,
        contents=build_resume_parse_prompt(resume_text),
        temperature=0,
        error_prefix="Gemini (resume parsing)",
    )


async def parse_resume_node(state: ProfileState) -> dict:
    """Node: Parse Resume → structured ResumeSkills."""
    resume_data = await parse_resume_text(state["resume_text"])
    return {"resume_data": resume_data}
