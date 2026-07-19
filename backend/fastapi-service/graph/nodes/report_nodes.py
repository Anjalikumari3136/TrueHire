"""
Final-report nodes: Format Rounds → Generate Final Report.

Behavior is identical to the original `generate_final_candidate_report`:
same per-round formatting, same system instruction, same schema/temperature.
"""

from ..llm import generate_structured
from ..prompts import FINAL_REPORT_SYSTEM_PROMPT
from ..schemas import FinalCandidateReport
from ..state import ReportState
from ..utils import (
    summarize_profile_for_oa,
    format_oa_for_report,
    format_interview_round_for_report,
)


async def format_rounds_node(state: ReportState) -> dict:
    """Node: Format Rounds → flatten profile + each round into prompt text."""
    assessments = state.get("assessments") or {}
    return {
        "profile_summary": summarize_profile_for_oa(state.get("profile")),
        "oa_text": format_oa_for_report(assessments.get("OA")),
        "tech_text": format_interview_round_for_report(assessments.get("Technical")),
        "hr_text": format_interview_round_for_report(assessments.get("HR")),
    }


async def generate_final_report_node(state: ReportState) -> dict:
    """Node: Generate Final Report → consolidated FinalCandidateReport dict."""
    user_prompt = (
        f"Candidate Résumé / Profile:\n{state['profile_summary']}\n\n"
        f"=== OA (Online Assessment) Round ===\n{state['oa_text']}\n\n"
        f"=== Technical Round ===\n{state['tech_text']}\n\n"
        f"=== HR Round ===\n{state['hr_text']}\n\n"
        "Produce the final consolidated candidate report now."
    )

    report = await generate_structured(
        schema=FinalCandidateReport,
        contents=user_prompt,
        system_instruction=FINAL_REPORT_SYSTEM_PROMPT,
        temperature=0.3,
        error_prefix="Gemini (final report)",
    )

    return {"report": report.model_dump()}
