"""
Final consolidated report graph — backs POST /api/oa/final-report.

Topology:
    START ──► format_rounds ──► generate_final_report ──► END
"""

from langgraph.graph import StateGraph, START, END

from .state import ReportState
from .nodes.report_nodes import (
    format_rounds_node,
    generate_final_report_node,
)


def _build_report_graph():
    graph = StateGraph(ReportState)

    graph.add_node("format_rounds", format_rounds_node)
    graph.add_node("generate_final_report", generate_final_report_node)

    graph.add_edge(START, "format_rounds")
    graph.add_edge("format_rounds", "generate_final_report")
    graph.add_edge("generate_final_report", END)

    return graph.compile()


report_graph = _build_report_graph()


async def run_report_graph(profile, assessments: dict) -> dict:
    """
    Run the report graph and return the FinalCandidateReport dict — the same
    value the original `generate_final_candidate_report(...)` returned.
    """
    result = await report_graph.ainvoke(
        {"profile": profile, "assessments": assessments or {}}
    )
    return result["report"]
