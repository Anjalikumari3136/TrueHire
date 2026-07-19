"""
GitHub-related nodes: Analyze GitHub (+ conditional skip).

Implements the requested conditional routing:
    If GitHub username is empty  → skip GitHub analysis (no API call).
    Otherwise                    → analyze the user's public repositories.

Backward compatible: for the normal case (a username IS supplied), this calls
the exact same `analyze_github` utility as before, so the merged profile is
unchanged. Skipping only changes the previously-erroring empty-username case
into a graceful no-op with an empty GitHub summary.
"""

from ..state import ProfileState
from ..utils import analyze_github


# Empty GitHub result, shaped identically to analyze_github()'s output so the
# merge node can treat "skipped" and "analyzed" uniformly.
def _empty_github(username: str) -> dict:
    return {
        "username": username or "",
        "total_repos": 0,
        "evidenced_languages": [],
        "repos": [],
    }


def route_github(state: ProfileState) -> str:
    """Conditional edge: decide whether to analyze GitHub or skip it."""
    username = (state.get("github_username") or "").strip()
    return "analyze_github" if username else "skip_github"


async def analyze_github_node(state: ProfileState) -> dict:
    """Node: Analyze GitHub → repos, languages, commit activity."""
    username = state["github_username"].strip()
    github_data = await analyze_github(username)
    return {"github_data": github_data}


async def skip_github_node(state: ProfileState) -> dict:
    """Node: GitHub skipped (empty username) → empty, well-shaped summary."""
    return {"github_data": _empty_github(state.get("github_username", ""))}
