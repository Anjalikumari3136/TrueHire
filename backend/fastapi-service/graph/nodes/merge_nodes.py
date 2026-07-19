"""
Merge node: Merge Candidate Data (+ Extract/verify skills).

Cross-references resume-claimed skills against GitHub-evidenced languages to
split them into verified / unverified, then assembles the final candidate
profile dict. The output shape is byte-for-byte identical to the dict the
original /build-profile endpoint returned.
"""

from ..state import ProfileState


async def merge_candidate_data_node(state: ProfileState) -> dict:
    """Node: Merge Candidate Data → unified candidate profile."""
    resume_data = state["resume_data"]
    github_data = state["github_data"]

    claimed = {s.lower() for s in resume_data.skills}
    evidenced = {l.lower() for l in github_data["evidenced_languages"]}

    verified_skills = list(claimed & evidenced)
    unverified_skills = list(claimed - evidenced)

    profile = {
        "resume":            resume_data.model_dump(),
        "github":            github_data,
        "verified_skills":   verified_skills,
        "unverified_skills": unverified_skills,
        "verification_rate": round(len(verified_skills) / len(claimed), 2) if claimed else 0,
        "college_name":      state.get("college_name"),
        "linkedin_profile":  state.get("linkedin_profile"),
        "leetcode_profile":  state.get("leetcode_profile"),
        "other_coding_profile": state.get("other_coding_profile"),
        "graduation_year":   state.get("graduation_year"),
        "cgpa":              state.get("cgpa"),
    }

    return {"profile": profile}
