"""
OA nodes: Generate Candidate Summary → Generate OA Questions.

Behavior is intentionally identical to the original `generate_oa_questions`:
the same OA_SYSTEM_PROMPT, the same fixed difficulty distribution
(Easy, Easy, Medium, Medium, Hard), the same temperature and schema.
"""

from ..llm import generate_structured
from ..prompts import OA_SYSTEM_PROMPT
from ..schemas import OAQuestionSet
from ..state import OAState
from ..utils import summarize_profile_for_oa


async def generate_candidate_summary_node(state: OAState) -> dict:
    """Node: Generate Candidate Summary → compact prompt context for the OA."""
    return {"profile_summary": summarize_profile_for_oa(state.get("profile"))}


async def generate_oa_questions_node(state: OAState) -> dict:
    """Node: Generate OA Questions → exactly 5 schema-validated questions."""
    user_prompt = (
        f"Candidate Profile:\n{state['profile_summary']}\n\n"
        "Generate the 5-question personalized OA now."
    )

    parsed = await generate_structured(
        schema=OAQuestionSet,
        contents=user_prompt,
        system_instruction=OA_SYSTEM_PROMPT,
        temperature=0.6,
        error_prefix="Gemini (assessment)",
    )

    return {"questions": [q.model_dump() for q in parsed.questions]}
