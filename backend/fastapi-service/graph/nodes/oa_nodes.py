"""
OA nodes: Generate Candidate Summary → Generate OA Questions.

Behavior is intentionally identical to the original `generate_oa_questions`:
the same OA_SYSTEM_PROMPT, the same fixed difficulty distribution
(Easy, Easy, Medium, Medium, Hard), the same temperature and schema.
"""

from ..llm import generate_structured
from ..prompts import OA_SYSTEM_PROMPT, OA_REPORT_SYSTEM_PROMPT
from ..schemas import OAQuestionSet, OARoundReport
from ..state import OAState, OAReportState
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


# ── OA evaluation report ────────────────────────────────────────────────────

async def format_oa_submission_node(state: OAReportState) -> dict:
    """Node: Format Submission → question + submitted code transcript."""
    answers = {a.get("question_id"): (a.get("code") or "") for a in (state.get("answers") or [])}
    language = state.get("language") or "unknown"

    parts = []
    for q in state.get("questions") or []:
        code = answers.get(q.get("id"), "").strip()
        parts.append(
            f"--- Question {q.get('id')} [{q.get('difficulty')}] {q.get('title')} ---\n"
            f"Problem: {q.get('problem', '')}\n"
            f"Submitted {language} code:\n"
            f"{code[:2000] if code else '(NO CODE SUBMITTED)'}"
        )

    header = (
        f"Language: {language}\n"
        f"Time taken: {state.get('time_taken_seconds') or 'unknown'} seconds\n"
        f"Candidate profile:\n{summarize_profile_for_oa(state.get('profile'))}\n"
    )
    return {"submission_text": header + "\n\n" + "\n\n".join(parts)}


async def generate_oa_report_node(state: OAReportState) -> dict:
    """Node: Generate OA Report → RoundReport-shaped evaluation."""
    report = await generate_structured(
        schema=OARoundReport,
        contents=(
            f"{state['submission_text']}\n\n"
            "Grade this Online Assessment and produce the report now."
        ),
        system_instruction=OA_REPORT_SYSTEM_PROMPT,
        temperature=0.2,
        error_prefix="Gemini (OA report)",
    )
    return {"report": report.model_dump()}
