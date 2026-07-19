"""
Shared-state definitions for the LangGraph graphs.

Each graph passes a single typed dict between its nodes. Nodes return partial
dicts that LangGraph merges into the running state. Keeping the states here
(separate from the graph wiring and the node logic) keeps the graph modular.
"""

from typing import List, Optional, TypedDict

from .schemas import ResumeSkills


class ProfileState(TypedDict, total=False):
    """State for the candidate-profile graph (backs /build-profile)."""

    # Inputs
    resume_text: str
    github_username: str
    college_name: Optional[str]
    linkedin_profile: Optional[str]
    leetcode_profile: Optional[str]
    other_coding_profile: Optional[str]
    graduation_year: Optional[str]
    cgpa: Optional[float]

    # Intermediate results produced by nodes
    resume_data: ResumeSkills
    github_data: dict

    # Final merged output (exact shape returned by /build-profile)
    profile: dict


class OAState(TypedDict, total=False):
    """State for the OA question-generation graph (backs /api/oa/generate)."""

    profile: Optional[dict]
    profile_summary: str
    questions: List[dict]


class ReportState(TypedDict, total=False):
    """State for the final consolidated report graph (backs /api/oa/final-report)."""

    profile: Optional[dict]
    assessments: dict

    # Intermediate formatted round text
    profile_summary: str
    oa_text: str
    tech_text: str
    hr_text: str

    # Final output
    report: dict
