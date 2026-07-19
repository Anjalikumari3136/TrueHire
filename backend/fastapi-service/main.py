"""
TrueHire AI - Resume + GitHub Parser + Interview Engine
Run with: uvicorn main:app --reload
"""

import io
import os
import json
import uuid
import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, List, Optional

import httpx
import PyPDF2
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from google.genai import errors as genai_errors
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

from agent import InterviewAgent

load_dotenv()

# ── Environment ─────────────────────────────────────────────────────────────────
# ENVIRONMENT=production is set on Render. It switches off the local-dev
# conveniences below, which are unsafe (or simply meaningless) once deployed.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

# Local dev only: both services must sign JWTs with the SAME secret, so we read
# express-service/.env off disk as a convenience when running the two locally.
#
# This MUST NOT run in production: the sibling directory does not exist once the
# services are deployed separately, the read would silently fail, and the code
# used to fall back to a hardcoded secret that is public in this repo — letting
# anyone forge a token for any user. In production the secret comes from the
# environment or the app refuses to boot (see below).
if not IS_PRODUCTION:
    express_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), "express-service", ".env")
    if os.path.exists(express_env):
        try:
            with open(express_env, "r") as f:
                for line in f:
                    if line.strip().startswith("JWT_SECRET="):
                        val = line.strip().split("=", 1)[1].strip('"').strip("'")
                        os.environ["JWT_SECRET"] = val
                        print("[TrueHire] Synchronized JWT_SECRET with express-service")
                        break
        except Exception as e:
            print(f"[TrueHire] Warning: could not read express-service/.env: {e}")

# ── Credentials & Config ────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    if IS_PRODUCTION:
        # Fail loudly at boot rather than silently accepting forged tokens.
        raise RuntimeError(
            "JWT_SECRET is not set. It must match the Express service's JWT_SECRET "
            "exactly, or authentication between the two services will fail."
        )
    JWT_SECRET = "dev-secret-change-this-in-production"
    print("[TrueHire] WARNING: using the insecure development JWT secret.")

JWT_ALGORITHM  = "HS256"
JWT_EXPIRY_HOURS = 24

# ── Gemini config & AI workflow (LangGraph) ─────────────────────────────────────
# The shared Gemini client + model constant now live in graph.llm and are reused
# by BOTH the LangGraph nodes and the non-migrated endpoints in this file, so
# there is a single Gemini integration. The AI workflow (resume parsing, GitHub
# analysis, profile build, OA generation, final report) is implemented as
# LangGraph graphs inside the `graph` package — an internal detail of this
# service. Endpoint paths, request models and response shapes are unchanged.
from graph.llm import gemini, GEMINI_MODEL
from graph.utils import extract_pdf_text, analyze_github, http_client
from graph.nodes.resume_nodes import parse_resume_text
from graph.profile_graph import run_profile_graph
from graph.oa_graph import run_oa_graph
from graph.oa_report_graph import run_oa_report_graph
from graph.report_graph import run_report_graph

# ── Interview orchestrator agent (uses the shared Gemini client) ────────────────
interview_agent = InterviewAgent(gemini, model_name=GEMINI_MODEL)


# ── Auth helpers ────────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── App ─────────────────────────────────────────────────────────────────────────
app = FastAPI(title="TrueHire AI - Integrated Multi-Round Interview Engine")

@app.on_event("shutdown")
async def shutdown_event():
    await http_client.aclose()

# CORS — the browser calls this service DIRECTLY for the Technical/HR rounds, so
# the deployed frontend's origin must be allowed here or every request fails with
# "Failed to fetch". Origins are env-driven for deployment:
#
#   ALLOWED_ORIGINS       comma-separated exact origins (your Vercel production URL)
#   ALLOWED_ORIGIN_REGEX  optional regex, e.g. to allow Vercel preview deploys:
#                         https://.*\.vercel\.app
#
# Defaults keep local development working with no configuration.
DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:5174"
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()
]
ALLOWED_ORIGIN_REGEX = os.getenv("ALLOWED_ORIGIN_REGEX") or None

print(f"[TrueHire] CORS allowed origins: {ALLOWED_ORIGINS}" +
      (f" (+ regex {ALLOWED_ORIGIN_REGEX})" if ALLOWED_ORIGIN_REGEX else ""))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory user store (no DB yet — resets every server restart).
fake_users_db: dict = {}


# =====================================================================
# 0. AUTH SCHEMAS & UTILITY FUNCTIONS
# =====================================================================

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

def create_jwt(email: str) -> str:
    payload = {
        "sub": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

        email = payload.get("email")
        if not email:
            raise HTTPException(401, "Email not found in token")

        return email

    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def get_current_user(authorization: str = Header(None)) -> dict:
    """Dependency that reads the Authorization: Bearer <token> header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header")
    token = authorization.split(" ", 1)[1]
    email = decode_jwt(token)
    user = fake_users_db.get(email)
    if not user:
        # Dynamically populate the user in memory if we have a valid JWT token.
        # This bridges authentication from the Express service database.
        user = {
            "name": email.split("@")[0].capitalize(),
            "email": email,
            "password_hash": "",
            "profile": None,
        }
        fake_users_db[email] = user
    return user


# =====================================================================
# 1. CORE DATA SCHEMAS
# =====================================================================

class CandidateContext(BaseModel):
    target_role: str
    parsed_resume: str
    scraped_github_summary: str
    scraped_linkedin_summary: str
    current_cgpa: float

class StreamTurnRequest(BaseModel):
    session_id: str
    round: str = Field(..., description="Must be: 'OA', 'Technical', or 'HR'")
    candidate_context: CandidateContext
    chat_history: List[dict] = []
    current_code_state: Optional[str] = ""

class InterviewState(BaseModel):
    session_id: str
    current_round: str = Field(..., description="Must be: 'CODING', 'TECHNICAL', or 'HR'")
    candidate_context: CandidateContext
    chat_history: List[dict] = []
    current_code_state: Optional[str] = ""

class HistoricalMetrics(BaseModel):
    coding_score: int
    technical_score: int
    hr_score: int
    past_weaknesses: List[str]

class FinalMetrics(BaseModel):
    coding_score: int
    technical_score: int
    hr_score: int

class DeltaReport(BaseModel):
    performance_status: str = Field(..., description="Must be 'IMPROVED' or 'REGRESSED'")
    detailed_comparison: str = Field(..., description="Breakdown comparing current interview execution to historic weak metrics.")

class EvaluationReport(BaseModel):
    scores: FinalMetrics
    strengths: List[str]
    weaknesses: List[str]
    historical_analysis: DeltaReport

# NOTE: ProjectInfo / ResumeSkills schemas now live in graph/schemas.py and the
# extract_pdf_text / parse_resume_text / analyze_github utilities now live in
# graph/utils.py and graph/nodes/resume_nodes.py (imported at the top of this
# file). They are reused unchanged by the endpoints below and by the graphs.


# =====================================================================
# 3. HTTP ROUTING ENDPOINTS  (shapes unchanged — frontend contract intact)
# =====================================================================

@app.post("/auth/signup")
async def signup(data: SignupRequest):
    if data.email in fake_users_db:
        raise HTTPException(400, "An account with this email already exists")

    fake_users_db[data.email] = {
        "name":          data.name,
        "email":         data.email,
        "password_hash": pwd_context.hash(data.password),
    }

    token = create_jwt(data.email)
    return {"token": token, "user": {"name": data.name, "email": data.email}}


@app.post("/auth/login")
async def login(data: LoginRequest):
    user = fake_users_db.get(data.email)
    if not user or not pwd_context.verify(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    token = create_jwt(data.email)
    return {"token": token, "user": {"name": user["name"], "email": user["email"]}}


@app.post("/parse-resume")
async def parse_resume_endpoint(file: UploadFile = File(...)):
    file_bytes = await file.read()
    resume_text = extract_pdf_text(file_bytes)
    result = await parse_resume_text(resume_text)
    return result.model_dump()


@app.get("/analyze-github/{username}")
async def analyze_github_endpoint(username: str):
    return await analyze_github(username)


@app.post("/build-profile")
async def build_profile(
    file: UploadFile = File(...),
    github_username: str = Form(...),
    college_name: Optional[str] = Form(None),
    linkedin_profile: Optional[str] = Form(None),
    leetcode_profile: Optional[str] = Form(None),
    other_coding_profile: Optional[str] = Form(None),
    graduation_year: Optional[str] = Form(None),
    cgpa: Optional[float] = Form(None),
    session_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Combines resume + GitHub into one unified candidate profile.
    Requires a valid Bearer token (see /auth/login).
    Response shape is unchanged — frontend depends on this exact contract.

    `session_id` (optional, sent by the Express proxy) marks this as a brand-new
    Interview Session: any in-memory state from a previous interview for this
    candidate is cleared so NOTHING from the old interview is reused (fresh OA
    questions + a clean report). Building a profile always starts a new interview.
    """
    t_start = time.perf_counter()
    try:
        # Extract PDF text here (needs the uploaded file bytes), then hand the
        # rest of the workflow — resume parsing, GitHub analysis, skill merge —
        # to the LangGraph profile graph, which produces the identical profile
        # dict this endpoint returned before.
        file_bytes = await file.read()
        resume_text = extract_pdf_text(file_bytes)

        profile = await run_profile_graph(
            resume_text=resume_text,
            github_username=github_username,
            college_name=college_name,
            linkedin_profile=linkedin_profile,
            leetcode_profile=leetcode_profile,
            other_coding_profile=other_coding_profile,
            graduation_year=graduation_year,
            cgpa=cgpa,
        )

        email = current_user["email"]

        # Fresh interview: discard any prior in-memory interview state for this
        # candidate so the new résumé generates brand-new OA questions and a clean
        # report (nothing from the previous interview is reused). The durable
        # record of past interviews lives in the Express database, not here.
        oa_sessions.pop(email, None)
        candidate_assessments.pop(email, None)

        # Persist on the user record so /api/interview/start can look it up.
        # Track the active session id for reference/scoping.
        fake_users_db[email]["profile"] = profile
        fake_users_db[email]["active_session_id"] = session_id

        total_build_time = time.perf_counter() - t_start
        print(f"[Profiling] Total build_profile endpoint execution time: {total_build_time:.4f}s")

        return profile

    except HTTPException:
        # Re-raise FastAPI HTTPExceptions as-is (they already have status + detail)
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to build candidate profile: {e}",
        )


class RestoreProfileRequest(BaseModel):
    profile: dict


@app.post("/restore-profile")
async def restore_profile(
    req: RestoreProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Re-seed the in-memory candidate profile from a previously analyzed profile
    (persisted in the Express database) WITHOUT re-uploading the résumé or
    re-running the AI analysis. Used when a candidate RESUMES a pending
    interview, so OA/Technical/HR questions are generated from the same résumé
    analysis as before.
    """
    fake_users_db[current_user["email"]]["profile"] = req.profile
    return {"ok": True}


# =====================================================================
# 4. AI INTERVIEW ENGINE ENDPOINTS  (Gemini-powered)
# =====================================================================

# Round configuration: display name → (duration minutes, style note)
ROUND_CONFIG = {
    "OA": {
        "duration_minutes": 90,
        "style": (
            "This is a broad Online Assessment screening round (90 minutes). "
            "Ask foundational questions across data structures, algorithms, and system thinking. "
            "Keep questions accessible — your goal is to screen for basic competence, not deep expertise."
        ),
    },
    "Technical": {
        "duration_minutes": 60,
        "style": (
            "This is a deep Technical round (60 minutes). "
            "Probe the candidate's specific projects from their resume and GitHub. "
            "Ask about design decisions, tradeoffs, and edge cases in their actual code."
        ),
    },
    "HR": {
        "duration_minutes": 30,
        "style": (
            "This is an HR behavioral round (30 minutes). "
            "Focus on communication, team dynamics, conflict resolution, and cultural fit. "
            "Keep questions concise and conversational — no technical content."
        ),
    },
}


def _build_system_prompt(round_key: str, ctx: CandidateContext) -> str:
    cfg = ROUND_CONFIG.get(round_key, ROUND_CONFIG["Technical"])
    return (
        f"{cfg['style']}\n\n"
        f"Candidate Profile:\n"
        f"- Target Role: {ctx.target_role}\n"
        f"- Resume Summary: {ctx.parsed_resume}\n"
        f"- GitHub Summary: {ctx.scraped_github_summary}\n"
        f"- CGPA: {ctx.current_cgpa}\n"
        f"- Time available: {cfg['duration_minutes']} minutes total for this round."
    )


async def _gemini_stream_generator(
    system_prompt: str,
    messages: list,
) -> AsyncGenerator[str, None]:
    """
    Async generator that streams Gemini output as Server-Sent Events.
    Each chunk is yielded as `data: <text>\n\n` so the frontend can read
    it with EventSource or a fetch + ReadableStream.
    """
    contents = []
    for msg in messages:
        role    = "user" if msg.get("role") == "user" else "model"
        content = msg.get("content", "")
        contents.append(types.Content(role=role, parts=[types.Part(text=content)]))

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.7,
    )

    async for chunk in await gemini.aio.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=contents,
        config=config,
    ):
        if chunk.text:
            # SSE format: each line is `data: <payload>\n\n`
            yield f"data: {chunk.text}\n\n"

    # Signal stream end
    yield "data: [DONE]\n\n"


@app.post("/api/interview/stream-turn")
async def stream_interview_turn(state: StreamTurnRequest):
    """
    Streaming interview endpoint using Gemini 2.5 Flash.
    Returns a Server-Sent Events stream so the frontend can render
    AI responses word-by-word as they arrive.

    round field: "OA" | "Technical" | "HR"
    """
    system_prompt = _build_system_prompt(state.round, state.candidate_context)

    if state.round == "OA" and state.current_code_state:
        system_prompt += f"\n\nCandidate's current code:\n{state.current_code_state}"

    messages = state.chat_history or []
    if not messages:
        # Prime the conversation if no history yet
        messages = [{"role": "user", "content": "Please start the interview."}]

    return StreamingResponse(
        _gemini_stream_generator(system_prompt, messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/agent/next-turn")
async def process_interview_turn(state: InterviewState):
    """
    Non-streaming interview turn (legacy endpoint — kept for backwards compat).
    Maps CODING/TECHNICAL/HR → OA/Technical/HR Gemini rounds.
    """
    round_map = {"CODING": "OA", "TECHNICAL": "Technical", "HR": "HR"}
    round_key = round_map.get(state.current_round, "Technical")
    system_prompt = _build_system_prompt(round_key, state.candidate_context)

    if state.current_round == "CODING" and state.current_code_state:
        system_prompt += f"\n\nCandidate's current code:\n{state.current_code_state}"

    contents = []
    for turn in state.chat_history:
        role    = "user" if turn.get("role") == "user" else "model"
        content = turn.get("content", "")
        contents.append(types.Content(role=role, parts=[types.Part(text=content)]))

    if not contents:
        contents = [types.Content(role="user", parts=[types.Part(text="Please start the interview.")])]

    try:
        response = await asyncio.to_thread(
            gemini.models.generate_content,
            model=GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
            ),
        )
        return {
            "current_round": state.current_round,
            "ai_speech_text": response.text,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agent/evaluate", response_model=EvaluationReport)
async def evaluate_session(
    transcript: str,
    context: CandidateContext,
    past_performance: Optional[HistoricalMetrics] = None,
):
    """
    Compiles quantitative scores and delta metrics vs past performance.
    Uses Gemini JSON mode with EvaluationReport schema for structured output.
    """
    user_content = (
        f"Interview Transcript:\n{transcript}\n\n"
        f"Candidate Profile:\n{context.model_dump_json()}"
    )
    if past_performance:
        user_content += f"\n\nPast Performance Metrics:\n{past_performance.model_dump_json()}"

    system_instruction = (
        "You are a Senior Technical Recruiter and Data Performance Analyst. "
        "Read the interview transcript and assign numeric scores (0–100) across three vectors: "
        "coding, technical depth, and HR/behavioral. "
        "Extract the top 3 strengths and top 3 weaknesses. "
        "If past metrics are provided, explicitly state whether the candidate IMPROVED or REGRESSED "
        "and explain why with specific evidence from the transcript."
    )

    try:
        response = await asyncio.to_thread(
            gemini.models.generate_content,
            model=GEMINI_MODEL,
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=EvaluationReport,
                temperature=0.1,
            ),
        )
        return EvaluationReport.model_validate(json.loads(response.text))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================================
# 5. ADAPTIVE INTERVIEW ORCHESTRATOR ENDPOINTS (agent.py integration)
# =====================================================================

class StartInterviewRequest(BaseModel):
    round_type: str = Field(..., description="Must be: 'OA', 'Technical', or 'HR'")


class TurnRequest(BaseModel):
    session_id: str
    answer_text: Optional[str] = None


@app.post("/api/interview/start")
async def start_interview(
    req: StartInterviewRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Start a new adaptive interview session.
    Uses the candidate profile saved during /build-profile.
    """
    profile = current_user.get("profile")
    if not profile:
        raise HTTPException(
            400,
            "No candidate profile found. Please call /build-profile first.",
        )

    try:
        result = interview_agent.start_session(profile, req.round_type)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return result


@app.post("/api/interview/turn")
async def process_interview_turn(
    req: TurnRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Exposes the process_turn API which combines answer evaluation and next question generation.
    Returns TurnResponse JSON payload.
    """
    try:
        # If answer_text is empty string, treat it as None (first turn)
        ans = req.answer_text.strip() if req.answer_text and req.answer_text.strip() else None
        
        result = await interview_agent.process_turn(req.session_id, ans)
        return result
    except KeyError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error processing turn: {str(e)}")


@app.get("/api/interview/report")
async def get_interview_report(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate and return the final structured report for a completed
    interview round: overall score, strengths, gaps, focus areas,
    and per-question breakdown.
    """
    try:
        report = await interview_agent.generate_final_report(session_id)
    except KeyError as e:
        raise HTTPException(404, str(e))

    # Record this round (Technical / HR / OA-agent) for the final report.
    session = interview_agent.get_session(session_id)
    if session:
        candidate_assessments.setdefault(current_user["email"], {})[session.round_type] = {
            "report": report,
            "qa_history": session.qa_history,
        }

    return report


# =====================================================================
# 6. ONLINE ASSESSMENT (OA) ENGINE  — 5 personalized coding questions
#    Flow: React → Express (JWT verify) → FastAPI → Gemini
# =====================================================================

# In-memory OA store (no DB yet). One active session per candidate email.
oa_sessions: dict = {}

# Per-candidate results across all three rounds, keyed by email:
#   { email: { "OA": {...}, "Technical": {...}, "HR": {...} } }
# Used to build the final consolidated candidate report.
candidate_assessments: dict = {}

OA_DURATION_MINUTES = 90


# NOTE: OA question schemas (OAExample, OAStarterCode, OAQuestion, OAQuestionSet)
# now live in graph/schemas.py and are used by the OA generation node. The
# request schemas below (OAAnswer, OASubmitRequest) stay here — they belong to
# the /api/oa/submit endpoint, which has no AI/Gemini logic.


class OAAnswer(BaseModel):
    question_id: int
    code: str = ""


class OASubmitRequest(BaseModel):
    session_id: str
    language: str
    question_ids: List[int] = []
    answers: List[OAAnswer] = []
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    time_taken_seconds: Optional[int] = None


# NOTE: The OA system prompt now lives in graph/prompts.py, the profile
# summarizer in graph/utils.py (summarize_profile_for_oa), and the question
# generation logic in graph/nodes/oa_nodes.py. The OA graph (run_oa_graph)
# wires them together with the SAME prompt, schema and fixed difficulty
# distribution — behavior is unchanged.


@app.post("/api/oa/generate")
async def oa_generate(current_user: dict = Depends(get_current_user)):
    """
    Start or resume the OA session (STEP 1, 2, 15, 16).
    If an active session already exists for this candidate, it is returned
    unchanged so the candidate continues instead of getting new questions.
    """
    email = current_user["email"]

    existing = oa_sessions.get(email)
    if existing and existing.get("status") == "active":
        return {
            "session_id": existing["session_id"],
            "questions": existing["questions"],
            "duration_minutes": existing["duration_minutes"],
            "started_at": existing["started_at"],
            "status": "active",
            "resumed": True,
        }

    profile = current_user.get("profile")
    questions = await run_oa_graph(profile)

    session_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()

    oa_sessions[email] = {
        "session_id": session_id,
        "questions": questions,
        "duration_minutes": OA_DURATION_MINUTES,
        "started_at": started_at,
        "status": "active",
        "submission": None,
    }

    return {
        "session_id": session_id,
        "questions": questions,
        "duration_minutes": OA_DURATION_MINUTES,
        "started_at": started_at,
        "status": "active",
        "resumed": False,
    }


@app.post("/api/oa/submit")
async def oa_submit(
    req: OASubmitRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Store the candidate's submission in memory (STEP 10, 11).
    No Judge0 / evaluation yet — that comes later.
    """
    email = current_user["email"]
    session = oa_sessions.get(email)
    if not session:
        raise HTTPException(404, "No active OA session found for this candidate.")

    session["status"] = "submitted"
    session["submission"] = {
        "language": req.language,
        "question_ids": req.question_ids,
        "answers": [a.model_dump() for a in req.answers],
        "started_at": req.started_at,
        "ended_at": req.ended_at,
        "time_taken_seconds": req.time_taken_seconds,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    # Record the OA round for the final consolidated report.
    candidate_assessments.setdefault(email, {})["OA"] = {
        "language": req.language,
        "answers": [a.model_dump() for a in req.answers],
        "questions": session.get("questions", []),
        "time_taken_seconds": req.time_taken_seconds,
    }

    return {
        "success": True,
        "message": "OA submitted successfully.",
        "session_id": req.session_id,
    }


@app.post("/api/oa/report")
async def oa_report(current_user: dict = Depends(get_current_user)):
    """
    Generate (once) and return the OA round evaluation report.

    Mirrors the Technical/HR round report flow (`/api/interview/report`): the AI
    grades the submitted code and returns the SAME RoundReport shape, so the
    frontend renders it with the identical report UI. The result is cached on the
    OA session and recorded in `candidate_assessments` so the final consolidated
    report can use the evaluation instead of raw code.
    """
    email = current_user["email"]
    session = oa_sessions.get(email)
    if not session:
        raise HTTPException(404, "No OA session found for this candidate.")

    submission = session.get("submission")
    if not submission:
        raise HTTPException(409, "The OA has not been submitted yet.")

    # Generate-once: reuse the cached report on repeat calls.
    if session.get("report"):
        return session["report"]

    report = await run_oa_report_graph(
        profile=current_user.get("profile"),
        questions=session.get("questions", []),
        answers=submission.get("answers", []),
        language=submission.get("language"),
        time_taken_seconds=submission.get("time_taken_seconds"),
    )

    session["report"] = report
    # Feed the evaluation into the final consolidated report.
    candidate_assessments.setdefault(email, {}).setdefault("OA", {})["report"] = report

    return report


# =====================================================================
# 7. FINAL CONSOLIDATED CANDIDATE REPORT (OA + Technical + HR + résumé)
# =====================================================================

# NOTE: The final-report schemas (RoundScoreSummary, FinalCandidateReport) now
# live in graph/schemas.py, the round formatters in graph/utils.py, the system
# prompt in graph/prompts.py, and the generation logic in
# graph/nodes/report_nodes.py. The report graph (run_report_graph) wires them
# together with the SAME prompt, schema and formatting — behavior is unchanged.


@app.post("/api/oa/final-report")
async def oa_final_report(current_user: dict = Depends(get_current_user)):
    """
    Generate the final consolidated report across OA + Technical + HR + résumé.
    Uses whatever round data has been recorded this session (in-memory).
    """
    email = current_user["email"]
    assessments = candidate_assessments.get(email, {})
    profile = current_user.get("profile")

    report = await run_report_graph(profile, assessments)
    completed = [r for r in ("OA", "Technical", "HR") if assessments.get(r)]

    return {"report": report, "completed_rounds": completed}


@app.get("/")
def health_check():
    return {"status": "ok"}