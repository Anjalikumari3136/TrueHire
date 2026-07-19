"""
Candidate-profile graph — backs POST /build-profile.

Topology (parse + GitHub run in parallel, converge at merge — preserving the
original asyncio.gather concurrency, now with conditional GitHub routing):

        ┌─────────────────► parse_resume ──────────────────┐
    START                                                  ├──► merge ──► END
        └──► (route_github) ─► analyze_github / skip_github ┘

Conditional routing:
    - GitHub username empty  → skip_github  (no API call)
    - otherwise              → analyze_github
    - resume parse failure   → node raises HTTPException(502) → structured error
"""

from langgraph.graph import StateGraph, START, END

from .state import ProfileState
from .nodes.resume_nodes import parse_resume_node
from .nodes.github_nodes import (
    analyze_github_node,
    skip_github_node,
    route_github,
)
from .nodes.merge_nodes import merge_candidate_data_node


def _build_profile_graph():
    graph = StateGraph(ProfileState)

    graph.add_node("parse_resume", parse_resume_node)
    graph.add_node("analyze_github", analyze_github_node)
    graph.add_node("skip_github", skip_github_node)
    graph.add_node("merge", merge_candidate_data_node)

    # Two parallel branches out of START.
    # Branch 1: always parse the resume.
    graph.add_edge(START, "parse_resume")
    # Branch 2: conditionally analyze GitHub or skip it.
    graph.add_conditional_edges(
        START,
        route_github,
        {"analyze_github": "analyze_github", "skip_github": "skip_github"},
    )

    # Fan-in: merge waits for both branches to complete.
    graph.add_edge("parse_resume", "merge")
    graph.add_edge("analyze_github", "merge")
    graph.add_edge("skip_github", "merge")
    graph.add_edge("merge", END)

    return graph.compile()


# Compile once at import time; reused across requests.
profile_graph = _build_profile_graph()


async def run_profile_graph(
    *,
    resume_text: str,
    github_username: str,
    college_name=None,
    linkedin_profile=None,
    leetcode_profile=None,
    other_coding_profile=None,
    graduation_year=None,
    cgpa=None,
) -> dict:
    """
    Run the profile graph and return the final candidate profile dict.
    Same output shape as the original /build-profile implementation.
    """
    initial_state: ProfileState = {
        "resume_text": resume_text,
        "github_username": github_username,
        "college_name": college_name,
        "linkedin_profile": linkedin_profile,
        "leetcode_profile": leetcode_profile,
        "other_coding_profile": other_coding_profile,
        "graduation_year": graduation_year,
        "cgpa": cgpa,
    }
    result = await profile_graph.ainvoke(initial_state)
    return result["profile"]
