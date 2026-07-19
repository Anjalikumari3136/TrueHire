"""
Pydantic schemas produced by the AI nodes (Gemini structured output).

These are moved verbatim from main.py so the graph nodes own them. main.py
imports the ones it still needs (e.g. ResumeSkills for /parse-resume) from
here, keeping a single source of truth. Field names and types are unchanged —
the JSON response shapes seen by the frontend are byte-for-byte identical.
"""

from typing import List

from pydantic import BaseModel, Field


# ── Resume parsing ──────────────────────────────────────────────────────────

class ProjectInfo(BaseModel):
    name: str = Field(description="Project name")
    description: str = Field(description="Brief project description")
    tech_stack: str = Field(description="Technologies used, comma separated")


class ResumeSkills(BaseModel):
    skills: List[str] = Field(description="Technical skills mentioned")
    projects: List[ProjectInfo] = Field(description="List of projects extracted from the resume")
    experience_years: float = Field(description="Total years of experience")
    education: List[str] = Field(description="Degrees/institutions")
    github_url: str = Field(description="GitHub URL if found in resume, else empty string")
    linkedin_url: str = Field(description="LinkedIn URL if found, else empty string")


# ── Online Assessment question generation ───────────────────────────────────

class OAExample(BaseModel):
    input: str = Field(description="Example input")
    output: str = Field(description="Expected output for the example input")
    explanation: str = Field(default="", description="Why this output is correct")


class OAStarterCode(BaseModel):
    python: str = Field(description="Python starter code / function signature")
    cpp: str = Field(description="C++ starter code / function signature")
    java: str = Field(description="Java starter code / function signature")
    javascript: str = Field(description="JavaScript starter code / function signature")


class OAQuestion(BaseModel):
    id: int = Field(description="Question number 1..5")
    difficulty: str = Field(description="Must be 'Easy', 'Medium', or 'Hard'")
    title: str = Field(description="Short question title")
    problem: str = Field(description="Full problem statement")
    constraints: str = Field(description="Constraints, newline separated")
    examples: List[OAExample] = Field(description="1-3 worked examples")
    starterCode: OAStarterCode


class OAQuestionSet(BaseModel):
    questions: List[OAQuestion] = Field(description="Exactly 5 questions")


# ── Final consolidated candidate report ─────────────────────────────────────

class RoundScoreSummary(BaseModel):
    round: str = Field(description="OA, Technical, or HR")
    score: float = Field(description="Round score 0-100 (0 if not attempted)")
    summary: str = Field(description="Short performance summary for this round")


# ── Detailed per-section blocks (used by the professional PDF report) ────────
# These are ADDITIVE — the original FinalCandidateReport fields above are kept
# unchanged so the existing frontend contract is preserved. Fields carry
# defaults so a slightly incomplete model response never fails validation.

class ResumeAnalysisDetail(BaseModel):
    resume_score: float = Field(default=0.0, description="Résumé quality/relevance score 0-100")
    skills_detected: List[str] = Field(default_factory=list, description="Skills detected on the résumé")
    technologies: List[str] = Field(default_factory=list, description="Technologies / frameworks / tools")
    projects: List[str] = Field(default_factory=list, description="Notable projects (name — one line each)")
    strengths: List[str] = Field(default_factory=list, description="Résumé strengths")
    weaknesses: List[str] = Field(default_factory=list, description="Résumé weaknesses / gaps")


class OARoundDetail(BaseModel):
    score: float = Field(default=0.0, description="OA round score 0-100 (0 if not attempted)")
    questions_attempted: int = Field(default=0, description="Number of OA questions attempted")
    correct_answers: int = Field(default=0, description="Estimated number of correct/working solutions")
    time_management: str = Field(default="", description="Brief assessment of time management")
    problem_solving: str = Field(default="", description="Brief assessment of problem-solving ability")
    ai_feedback: str = Field(default="", description="AI feedback for the OA round")


class TechnicalRoundDetail(BaseModel):
    coding_skills: str = Field(default="", description="Rating/assessment of general coding skills")
    dsa: str = Field(default="", description="Data structures & algorithms assessment")
    frontend: str = Field(default="", description="Frontend assessment")
    backend: str = Field(default="", description="Backend assessment")
    database: str = Field(default="", description="Database assessment")
    api_design: str = Field(default="", description="API design assessment")
    debugging: str = Field(default="", description="Debugging assessment")
    ai_feedback: str = Field(default="", description="AI feedback for the Technical round")


class HRRoundDetail(BaseModel):
    communication: str = Field(default="", description="Communication assessment")
    confidence: str = Field(default="", description="Confidence assessment")
    leadership: str = Field(default="", description="Leadership assessment")
    teamwork: str = Field(default="", description="Teamwork assessment")
    behaviour: str = Field(default="", description="Behaviour / attitude assessment")
    ai_feedback: str = Field(default="", description="AI feedback for the HR round")


class FinalCandidateReport(BaseModel):
    overall_score: float = Field(description="Overall aggregate score 0-100")
    performance_rating: str = Field(
        description="One of: Excellent, Strong, Average, Needs Improvement, Poor"
    )
    overall_summary: str = Field(
        description="Detailed multi-sentence assessment of overall performance"
    )
    strengths: List[str] = Field(description="Key strengths shown across rounds and résumé")
    weaknesses: List[str] = Field(description="Clear weaknesses / gaps identified")
    areas_to_improve: List[str] = Field(
        description="Specific, actionable areas the candidate should improve"
    )
    round_breakdown: List[RoundScoreSummary] = Field(description="Per-round score and summary")
    resume_alignment: str = Field(
        description="How demonstrated performance aligns with the résumé claims"
    )
    final_recommendation: str = Field(description="Overall hiring-readiness recommendation")

    # ── Additive fields for the professional PDF report ─────────────────────
    hiring_recommendation: str = Field(
        default="",
        description=(
            "Exactly one of: 'Highly Recommended', 'Recommended', 'Borderline', "
            "'Needs Improvement', 'Not Ready Yet'"
        ),
    )
    resume_analysis: ResumeAnalysisDetail = Field(default_factory=ResumeAnalysisDetail)
    oa_round: OARoundDetail = Field(default_factory=OARoundDetail)
    technical_round: TechnicalRoundDetail = Field(default_factory=TechnicalRoundDetail)
    hr_round: HRRoundDetail = Field(default_factory=HRRoundDetail)
    learning_recommendations: List[str] = Field(
        default_factory=list, description="Concrete learning recommendations / resources"
    )
    career_suggestions: List[str] = Field(
        default_factory=list, description="AI career suggestions (roles/paths to pursue)"
    )
    final_summary: str = Field(
        default="", description="A polished closing summary paragraph for the report"
    )
