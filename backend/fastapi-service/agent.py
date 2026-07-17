"""
TrueHire AI - Adaptive Interview Orchestrator Agent

Manages stateful interview sessions with adaptive difficulty.
Skills claimed on resume but not evidenced on GitHub are probed first.
"""

import asyncio
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from google.genai import types
from pydantic import BaseModel, Field


# === Structured output schemas for Gemini ===

class AnswerEvaluation(BaseModel):
    score: int = Field(..., ge=0, le=10, description="Score from 0 (no understanding) to 10 (expert-level)")
    reasoning: str = Field(..., description="Brief explanation of why this score was assigned")
    skill_demonstrated: str = Field(..., description="The primary skill this answer demonstrated knowledge of")
    follow_up_suggestion: str = Field(..., description="Suggested follow-up topic or empty string if none")


class TurnResponse(BaseModel):
    previous_evaluation: Optional[AnswerEvaluation] = None  # None on the very first turn
    next_question: Optional[str] = None  # None if the round should end
    round_should_end: bool


class QuestionBreakdown(BaseModel):
    question: str
    answer: str
    score: int = Field(..., ge=0, le=10)
    skill_targeted: str
    reasoning: str


class RoundReport(BaseModel):
    overall_score: float = Field(..., ge=0, le=100, description="Aggregate score 0-100")
    strengths: list[str] = Field(..., description="Top demonstrated strengths")
    gaps: list[str] = Field(..., description="Knowledge gaps or weak areas identified")
    recommended_focus_areas: list[str] = Field(..., description="Topics the candidate should study")
    question_breakdown: list[QuestionBreakdown] = Field(..., description="Per-question analysis")
    summary: str = Field(..., description="2-3 sentence overall assessment")


# === Round configuration ===

ROUND_CONFIG = {
    "OA": {
        "duration_minutes": 90,
        "style": (
            "Online Assessment screening round. "
            "Ask foundational questions across data structures, algorithms, and system thinking. "
            "Keep questions accessible - screen for basic competence, not deep expertise."
        ),
        "questions_target": 10,
    },
    "Technical": {
        "duration_minutes": 60,
        "style": (
            "Deep Technical interview round. "
            "Probe the candidate's specific projects from their resume and GitHub. "
            "Ask about design decisions, tradeoffs, and edge cases in their actual code."
        ),
        "questions_target": 8,
    },
    "HR": {
        "duration_minutes": 30,
        "style": (
            "HR behavioral round. "
            "Focus on communication, team dynamics, conflict resolution, and cultural fit. "
            "Keep questions concise and conversational - no technical content."
        ),
        "questions_target": 6,
    },
}


# === Per-session state ===

@dataclass
class InterviewSession:
    session_id: str
    round_type: str                           # "OA" | "Technical" | "HR"
    candidate_profile: dict                   # Full profile from /build-profile
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Adaptive state
    current_difficulty: int = 3               # 1 (easy) -> 5 (expert)
    skills_remaining: list = field(default_factory=list)
    skills_covered: list = field(default_factory=list)

    # Q&A history
    qa_history: list = field(default_factory=list)

    # Time tracking
    time_remaining_minutes: int = 60

    @property
    def questions_asked(self) -> int:
        return len(self.qa_history)

    @property
    def current_skill_target(self) -> Optional[str]:
        return self.skills_remaining[0] if self.skills_remaining else None


# === The Agent ===

class InterviewAgent:
    """
    Adaptive interview orchestrator.
    Instantiate once with the shared Gemini client, then call session methods.
    """

    def __init__(self, gemini_client, model_name: str = "gemini-3.5-flash"):
        self._gemini = gemini_client
        self._model = model_name
        self._sessions: dict[str, InterviewSession] = {}

    # === Session lifecycle ===

    def start_session(self, candidate_profile: dict, round_type: str) -> dict:
        """
        Create a new interview session.
        Returns { session_id, round }
        """
        if round_type not in ROUND_CONFIG:
            raise ValueError(f"Invalid round_type '{round_type}'. Must be one of: {list(ROUND_CONFIG.keys())}")

        session_id = str(uuid.uuid4())
        cfg = ROUND_CONFIG[round_type]

        # Build skill queue: unverified skills FIRST (highest-priority probing)
        unverified = candidate_profile.get("unverified_skills", [])
        verified = candidate_profile.get("verified_skills", [])

        # For HR rounds, use soft-skill topics instead
        if round_type == "HR":
            skills_queue = [
                "teamwork", "conflict resolution", "leadership",
                "communication", "adaptability", "problem-solving mindset",
            ]
        else:
            skills_queue = list(unverified) + list(verified)
            # Fallback if no skills extracted
            if not skills_queue:
                skills_queue = [
                    "data structures", "algorithms", "system design",
                    "databases", "APIs", "debugging",
                ]

        session = InterviewSession(
            session_id=session_id,
            round_type=round_type,
            candidate_profile=candidate_profile,
            time_remaining_minutes=cfg["duration_minutes"],
            skills_remaining=skills_queue,
        )
        self._sessions[session_id] = session

        return {"session_id": session_id, "round": round_type}

    def _get_session(self, session_id: str) -> InterviewSession:
        session = self._sessions.get(session_id)
        if not session:
            raise KeyError(f"Session '{session_id}' not found")
        return session

    # === Single structured turn processing (combined eval + question gen) ===

    async def process_turn(self, session_id: str, answer_text: Optional[str] = None) -> dict:
        """
        Process a single turn of the interview.
        If answer_text is None (first question of the round), only generates next_question.
        Otherwise, combines answer evaluation and next question generation into one Gemini call.
        """
        session = self._get_session(session_id)
        cfg = ROUND_CONFIG[session.round_type]

        # Candidate context
        profile = session.candidate_profile
        resume_info = profile.get("resume", {})
        github_info = profile.get("github", {})

        # Build system prompt detailing active state & targeting criteria
        system_prompt = (
            f"You are a senior interviewer conducting a {session.round_type} round interview.\n"
            f"Round style: {cfg['style']}\n\n"
            f"Candidate Profile:\n"
            f"- Resume skills: {resume_info.get('skills', [])}\n"
            f"- Projects: {json.dumps(resume_info.get('projects', []), indent=2)}\n"
            f"- Education: {resume_info.get('education', [])}\n"
            f"- GitHub repos: {len(github_info.get('repos', []))} repositories\n"
            f"- GitHub languages: {github_info.get('evidenced_languages', [])}\n"
            f"- Verified skills (on resume AND GitHub): {profile.get('verified_skills', [])}\n"
            f"- Unverified skills (resume only, no GitHub evidence): {profile.get('unverified_skills', [])}\n\n"
            f"Current state:\n"
            f"- Difficulty level: {session.current_difficulty}/5\n"
            f"- Questions asked so far: {session.questions_asked}\n"
            f"- Skills already covered: {session.skills_covered}\n"
            f"- Current target skill: {session.current_skill_target}\n"
            f"- Time remaining: {session.time_remaining_minutes} minutes\n\n"
            f"Instructions:\n"
        )

        contents = []

        # --- Case A: First question (no answer to evaluate)
        if not answer_text:
            system_prompt += (
                f"- This is the very first question of the round. Do NOT evaluate any answer.\n"
                f"- Leave 'previous_evaluation' as null (None) in the schema.\n"
                f"- Ask exactly ONE question targeting '{session.current_skill_target or 'general knowledge'}'.\n"
                f"- Difficulty level {session.current_difficulty}/5.\n"
                f"- Be concise.\n"
                f"- Set 'round_should_end' to false.\n"
            )
            contents.append(types.Content(
                role="user",
                parts=[types.Part(text="Please start the interview by asking the first question.")]
            ))

            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=TurnResponse,
                temperature=0.7,
            )

            response_raw = await asyncio.to_thread(
                self._gemini.models.generate_content,
                model=self._model,
                contents=contents,
                config=config,
            )

            response = TurnResponse.model_validate(json.loads(response_raw.text))
            
            # Store pending question
            session._pending_question = response.next_question.strip() if response.next_question else ""
            return response.model_dump()

        # --- Case B: Evaluation + Next Question (subsequent turns)
        else:
            # Determine if this turn should end the round programmatically
            questions_target_met = (session.questions_asked + 1) >= cfg["questions_target"]
            time_up = (session.time_remaining_minutes - 5) <= 0
            skills_done = len(session.skills_remaining) <= 1

            will_end = questions_target_met or time_up or skills_done

            question_text = getattr(session, "_pending_question", "Previous interview question")
            target_skill = session.current_skill_target or "general"

            system_prompt += (
                f"- You MUST evaluate the candidate's answer to the previous question:\n"
                f"  Question asked: \"{question_text}\"\n"
                f"  Candidate's answer: \"{answer_text}\"\n"
                f"- Populate 'previous_evaluation' with score, reasoning, and skill demonstrated.\n"
            )

            if will_end:
                system_prompt += (
                    f"- This is the FINAL turn of the round. Do NOT generate a next question.\n"
                    f"- Set 'next_question' to null (None).\n"
                    f"- Set 'round_should_end' to true.\n"
                )
            else:
                next_target = session.skills_remaining[1] if len(session.skills_remaining) > 1 else "general knowledge"
                system_prompt += (
                    f"- Generate exactly ONE next question targeting '{next_target}'.\n"
                    f"- Difficulty level {session.current_difficulty}/5.\n"
                    f"- Be concise.\n"
                    f"- Set 'round_should_end' to false.\n"
                )

            # Include recent Q&A history for context
            for qa in session.qa_history[-3:]:
                contents.append(types.Content(
                    role="user",
                    parts=[types.Part(text=qa["answer"])]
                ))
                contents.append(types.Content(
                    role="model",
                    parts=[types.Part(text=qa["question"])]
                ))

            # Current turn user prompt
            contents.append(types.Content(
                role="user",
                parts=[types.Part(text=(
                    f"Previous Question: {question_text}\n"
                    f"Candidate Answer: {answer_text}\n"
                    f"Please evaluate this answer and generate the next turn response."
                ))]
            ))

            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=TurnResponse,
                temperature=0.5,
            )

            response_raw = await asyncio.to_thread(
                self._gemini.models.generate_content,
                model=self._model,
                contents=contents,
                config=config,
            )

            response = TurnResponse.model_validate(json.loads(response_raw.text))

            # --- Record Q&A entry
            eval_dict = response.previous_evaluation.model_dump() if response.previous_evaluation else {
                "score": 0, "reasoning": "Unscored", "skill_demonstrated": "None", "follow_up_suggestion": ""
            }
            session.qa_history.append({
                "question": question_text,
                "answer": answer_text,
                "evaluation": eval_dict,
                "skill_targeted": target_skill,
                "difficulty_at_time": session.current_difficulty,
            })

            # --- Adaptive difficulty adjustment
            if response.previous_evaluation:
                score = response.previous_evaluation.score
                if score >= 8:
                    session.current_difficulty = min(5, session.current_difficulty + 1)
                elif score <= 3:
                    session.current_difficulty = max(1, session.current_difficulty - 1)

            # --- Advance skill queue
            if session.current_skill_target:
                session.skills_covered.append(session.skills_remaining.pop(0))

            # --- Deduct time
            session.time_remaining_minutes = max(0, session.time_remaining_minutes - 5)

            # --- Programmatic completion fallback check
            if will_end:
                response.round_should_end = True
                response.next_question = None

            # Store pending question
            session._pending_question = response.next_question.strip() if response.next_question else ""
            
            return response.model_dump()

    # === Round completion check ===

    def should_end_round(self, session_id: str) -> bool:
        """
        Returns True when the round should end:
        - Time has run out, OR
        - All skills have been covered, OR
        - Target question count reached
        """
        session = self._get_session(session_id)
        cfg = ROUND_CONFIG[session.round_type]

        time_up = session.time_remaining_minutes <= 0
        skills_done = len(session.skills_remaining) == 0
        questions_target_met = session.questions_asked >= cfg["questions_target"]

        return time_up or skills_done or questions_target_met

    # === Final report generation ===

    async def generate_final_report(self, session_id: str) -> dict:
        """
        Generate a structured round report with overall score,
        strengths, gaps, and per-question breakdown.
        """
        session = self._get_session(session_id)

        # Build a detailed transcript for the LLM
        transcript_lines = []
        for i, qa in enumerate(session.qa_history, 1):
            transcript_lines.append(
                f"Q{i} [Skill: {qa['skill_targeted']}, Difficulty: {qa['difficulty_at_time']}/5]:\n"
                f"  Question: {qa['question']}\n"
                f"  Answer: {qa['answer']}\n"
                f"  Score: {qa['evaluation']['score']}/10 - {qa['evaluation']['reasoning']}"
            )
        transcript = "\n\n".join(transcript_lines)

        profile = session.candidate_profile
        resume_info = profile.get("resume", {})

        report_prompt = (
            f"Generate a comprehensive interview round report.\n\n"
            f"Round type: {session.round_type}\n"
            f"Candidate skills (claimed): {resume_info.get('skills', [])}\n"
            f"Verified skills: {profile.get('verified_skills', [])}\n"
            f"Unverified skills: {profile.get('unverified_skills', [])}\n"
            f"Total questions: {session.questions_asked}\n"
            f"Duration used: {ROUND_CONFIG[session.round_type]['duration_minutes'] - session.time_remaining_minutes} minutes\n\n"
            f"Full Q&A Transcript:\n{transcript}\n\n"
            f"Produce an honest, calibrated assessment. "
            f"Highlight where the candidate excelled and where they struggled. "
            f"Pay special attention to unverified skills - did the candidate demonstrate them or not?"
        )

        response = await asyncio.to_thread(
            self._gemini.models.generate_content,
            model=self._model,
            contents=report_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RoundReport,
                temperature=0.2,
            ),
        )

        return RoundReport.model_validate(json.loads(response.text)).model_dump()
