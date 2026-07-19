"""
OA question-generation graph — backs POST /api/oa/generate.

Topology:
    START ──► generate_candidate_summary ──► generate_oa_questions ──► END

Difficulty distribution is fixed (Easy, Easy, Medium, Medium, Hard) exactly as
before — no adaptive routing, per the migration decision to keep OA behavior
identical.
"""

from langgraph.graph import StateGraph, START, END

from .state import OAState
from .nodes.oa_nodes import (
    generate_candidate_summary_node,
    generate_oa_questions_node,
)


def _build_oa_graph():
    graph = StateGraph(OAState)

    graph.add_node("generate_candidate_summary", generate_candidate_summary_node)
    graph.add_node("generate_oa_questions", generate_oa_questions_node)

    graph.add_edge(START, "generate_candidate_summary")
    graph.add_edge("generate_candidate_summary", "generate_oa_questions")
    graph.add_edge("generate_oa_questions", END)

    return graph.compile()


oa_graph = _build_oa_graph()


async def run_oa_graph(profile) -> list:
    """
    Run the OA graph and return the list of 5 question dicts — the same value
    the original `generate_oa_questions(profile)` returned.
    """
    result = await oa_graph.ainvoke({"profile": profile})
    return result["questions"]
