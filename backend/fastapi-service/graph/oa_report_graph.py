"""
OA evaluation graph — backs POST /api/oa/report.

Topology:
    START ──► format_submission ──► generate_oa_report ──► END

Produces the SAME report shape as the Technical/HR rounds (RoundReport), so the
OA report renders with the identical frontend UI/UX as the Technical report.
"""

from langgraph.graph import StateGraph, START, END

from .state import OAReportState
from .nodes.oa_nodes import format_oa_submission_node, generate_oa_report_node


def _build_oa_report_graph():
    graph = StateGraph(OAReportState)

    graph.add_node("format_submission", format_oa_submission_node)
    graph.add_node("generate_oa_report", generate_oa_report_node)

    graph.add_edge(START, "format_submission")
    graph.add_edge("format_submission", "generate_oa_report")
    graph.add_edge("generate_oa_report", END)

    return graph.compile()


oa_report_graph = _build_oa_report_graph()


async def run_oa_report_graph(*, profile, questions, answers, language, time_taken_seconds=None) -> dict:
    """Evaluate an OA submission and return a RoundReport-shaped dict."""
    result = await oa_report_graph.ainvoke(
        {
            "profile": profile,
            "questions": questions or [],
            "answers": answers or [],
            "language": language or "unknown",
            "time_taken_seconds": time_taken_seconds,
        }
    )
    return result["report"]
