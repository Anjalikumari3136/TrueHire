"""
Shared, non-LLM utilities used by the graph nodes.

Moved verbatim from main.py so the graph package is self-contained. main.py
imports the pieces it still needs for its non-migrated endpoints
(extract_pdf_text, analyze_github, http_client) from here — one source of truth,
identical behavior.
"""

import io
import os
import time
import asyncio
from typing import Optional

import httpx
import PyPDF2
from fastapi import HTTPException


# ── GitHub config & shared HTTP client ──────────────────────────────────────
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_API = "https://api.github.com"

# Shared HTTPX AsyncClient for connection reuse & pool optimization.
# 10.0 seconds timeout per request.
_headers = {"User-Agent": "TrueHire-AI"}
if GITHUB_TOKEN:
    _headers["Authorization"] = f"token {GITHUB_TOKEN}"

http_client = httpx.AsyncClient(headers=_headers, timeout=httpx.Timeout(10.0))


# ── PDF text extraction ─────────────────────────────────────────────────────

def extract_pdf_text(file_bytes: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    if not text.strip():
        raise HTTPException(422, "Could not extract text from PDF. It may be a scanned image.")
    return text


# ── GitHub analysis ─────────────────────────────────────────────────────────

async def analyze_github(username: str, max_repos: int = 10) -> dict:
    """
    Fetches repos, languages and recent commits for a GitHub user.
    All requests carry the GITHUB_TOKEN header (5000 req/hr authenticated
    vs 60 req/hr unauthenticated).
    """
    t0 = time.perf_counter()

    repos_resp = await http_client.get(
        f"{GITHUB_API}/users/{username}/repos",
        params={"sort": "updated", "per_page": 30},
    )
    if repos_resp.status_code != 200:
        raise HTTPException(
            404,
            f"GitHub user '{username}' not found or rate limited "
            f"(status {repos_resp.status_code})"
        )

    t_repos = time.perf_counter()
    print(f"[Profiling] GitHub fetch repos list: {t_repos - t0:.4f}s")

    repos = repos_resp.json()

    # Filter out forks
    non_forks = [repo for repo in repos if not repo.get("fork")]

    # Cap to max_repos
    target_repos = non_forks[:max_repos]

    async def fetch_repo_details(repo, idx):
        repo_name = repo["name"]

        # Concurrently fetch languages (all repos) and commits (top 5 repos only)
        tasks = [http_client.get(repo["languages_url"])]

        fetch_commits = idx < 5
        if fetch_commits:
            tasks.append(
                http_client.get(
                    f"{GITHUB_API}/repos/{username}/{repo_name}/commits",
                    params={"per_page": 30},
                )
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)

        languages = []
        commit_count = 0

        # Languages result
        lang_res = results[0]
        if not isinstance(lang_res, Exception) and lang_res.status_code == 200:
            languages = list(lang_res.json().keys())

        # Commits result
        if fetch_commits:
            commit_res = results[1]
            if not isinstance(commit_res, Exception) and commit_res.status_code == 200:
                commit_count = len(commit_res.json())

        return {
            "name":           repo["name"],
            "description":    repo["description"],
            "languages":      languages,
            "stars":          repo["stargazers_count"],
            "recent_commits": commit_count,
            "updated_at":     repo["updated_at"],
        }

    # Fetch details for all target repos concurrently
    detail_tasks = [fetch_repo_details(repo, idx) for idx, repo in enumerate(target_repos)]

    t_details_start = time.perf_counter()
    analyzed_repos = await asyncio.gather(*detail_tasks)
    t_details_end = time.perf_counter()
    print(f"[Profiling] GitHub fetch details for {len(target_repos)} repos concurrently: {t_details_end - t_details_start:.4f}s")

    all_languages = set()
    for r in analyzed_repos:
        all_languages.update(r["languages"])

    total_time = time.perf_counter() - t0
    print(f"[Profiling] Total analyze_github: {total_time:.4f}s")

    return {
        "username":            username,
        "total_repos":         len(analyzed_repos),
        "evidenced_languages": list(all_languages),
        "repos":               analyzed_repos,
    }


# ── Profile summarization (OA + final report context) ───────────────────────

def summarize_profile_for_oa(profile: Optional[dict]) -> str:
    """Flatten the stored candidate profile into a compact prompt context."""
    if not profile:
        return (
            "No detailed profile is available. Assume a general full-stack software "
            "engineering candidate comfortable with Python, JavaScript, Java and C++."
        )

    resume = profile.get("resume") or {}
    github = profile.get("github") or {}
    skills = resume.get("skills") or []
    projects = resume.get("projects") or []
    experience = resume.get("experience_years")
    verified = profile.get("verified_skills") or []
    gh_languages = github.get("evidenced_languages") or []
    repos = github.get("repos") or []

    project_lines = "; ".join(
        f"{p.get('name', '')} ({p.get('tech_stack', '')})" for p in projects[:6]
    )
    repo_lines = ", ".join(r.get("name", "") for r in repos[:8])

    return (
        f"Skills: {', '.join(skills) or 'N/A'}\n"
        f"GitHub-evidenced languages: {', '.join(gh_languages) or 'N/A'}\n"
        f"Verified skills: {', '.join(verified) or 'N/A'}\n"
        f"Projects: {project_lines or 'N/A'}\n"
        f"Notable repositories: {repo_lines or 'N/A'}\n"
        f"Experience: {experience if experience is not None else 'N/A'} years"
    )


# ── Final-report round formatters ───────────────────────────────────────────

def format_oa_for_report(oa: Optional[dict]) -> str:
    if not oa:
        return "Not attempted."
    answers = {a.get("question_id"): a.get("code", "") for a in oa.get("answers", [])}
    parts = []
    for q in oa.get("questions", []):
        code = answers.get(q.get("id"), "") or "(no code submitted)"
        parts.append(
            f"[{q.get('difficulty')}] {q.get('title')}\n"
            f"Candidate code ({oa.get('language')}):\n{code[:1500]}"
        )
    header = (
        f"Language: {oa.get('language')}, "
        f"Time taken: {oa.get('time_taken_seconds')}s\n"
    )
    return header + "\n\n".join(parts)


def format_interview_round_for_report(data: Optional[dict]) -> str:
    if not data:
        return "Not attempted."
    rep = data.get("report", {}) or {}
    qa = data.get("qa_history", []) or []
    lines = [
        f"Round score: {rep.get('overall_score')}/100",
        f"Summary: {rep.get('summary', '')}",
    ]
    for i, item in enumerate(qa, 1):
        ev = item.get("evaluation", {}) or {}
        lines.append(
            f"Q{i}: {item.get('question', '')}\n"
            f"A: {item.get('answer', '')}\n"
            f"Score: {ev.get('score')}/10 - {ev.get('reasoning', '')}"
        )
    return "\n".join(lines)
