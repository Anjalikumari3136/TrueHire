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

# Synchronize JWT_SECRET with express-service if present to allow seamless auth bridging
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
GITHUB_TOKEN   = os.getenv("GITHUB_TOKEN")
GITHUB_API     = "https://api.github.com"
JWT_SECRET     = os.getenv("JWT_SECRET", "dev-secret-change-this-in-production")
JWT_ALGORITHM  = "HS256"
JWT_EXPIRY_HOURS = 24
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "Missing GEMINI_API_KEY environment variable. "
        "Get a free key at https://aistudio.google.com/app/apikey and add it to backend/.env"
    )

# ── Gemini config ───────────────────────────────────────────────────────────────
# Centralised model name — change this single constant when migrating models.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
gemini = genai.Client(api_key=GEMINI_API_KEY)

print(f"[TrueHire] Gemini client initialised  model={GEMINI_MODEL}  key={GEMINI_API_KEY[:8]}...")

# ── Interview orchestrator agent (uses the shared Gemini client) ────────────────
interview_agent = InterviewAgent(gemini, model_name=GEMINI_MODEL)

# Create shared HTTPX AsyncClient for connection reuse & pool optimization.
# 10.0 seconds timeout per request.
headers = {"User-Agent": "TrueHire-AI"}
if GITHUB_TOKEN:
    headers["Authorization"] = f"token {GITHUB_TOKEN}"

http_client = httpx.AsyncClient(headers=headers, timeout=httpx.Timeout(10.0))


# ── Auth helpers ────────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── App ─────────────────────────────────────────────────────────────────────────
app = FastAPI(title="TrueHire AI - Integrated Multi-Round Interview Engine")

@app.on_event("shutdown")
async def shutdown_event():
    await http_client.aclose()

# CORS — allows the Vite frontend (localhost:5173/5174) to call this backend.
# Without this, every request from the browser fails with "Failed to fetch".
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
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


# =====================================================================
# 2. FILE PROCESSING & REPOSITORY EXTRACTION
# =====================================================================

def extract_pdf_text(file_bytes: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    if not text.strip():
        raise HTTPException(422, "Could not extract text from PDF. It may be a scanned image.")
    return text


async def parse_resume_text(resume_text: str) -> ResumeSkills:
    """
    Uses Gemini with response_mime_type=application/json + response_schema
    to return schema-validated structured data — no manual JSON parsing.
    """
    prompt = (
        "Extract structured information from this resume text. "
        "Be precise: only extract what is explicitly stated, do not infer or hallucinate skills. "
        "Return every field in the schema; use empty strings / empty lists for missing values.\n\n"
        f"Resume text:\n{resume_text}"
    )

    try:
        response = await asyncio.to_thread(
            gemini.models.generate_content,
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ResumeSkills,
                temperature=0,
            ),
        )
    except genai_errors.APIError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API error while parsing resume: {e}",
        )

    if not response.text:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an empty response while parsing resume.",
        )

    try:
        return ResumeSkills.model_validate(json.loads(response.text))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini returned invalid JSON for resume parsing: {e}",
        )


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
    current_user: dict = Depends(get_current_user),
):
    """
    Combines resume + GitHub into one unified candidate profile.
    Requires a valid Bearer token (see /auth/login).
    Response shape is unchanged — frontend depends on this exact contract.
    """
    t_start = time.perf_counter()
    try:
        t_pdf_start = time.perf_counter()
        file_bytes = await file.read()
        resume_text = extract_pdf_text(file_bytes)
        t_pdf_end = time.perf_counter()
        print(f"[Profiling] PDF text extraction: {t_pdf_end - t_pdf_start:.4f}s")

        t_tasks_start = time.perf_counter()
        # Run resume parsing and GitHub analysis concurrently
        resume_data, github_data = await asyncio.gather(
            parse_resume_text(resume_text),
            analyze_github(github_username)
        )
        t_tasks_end = time.perf_counter()
        print(f"[Profiling] Concurrently parsed resume and analyzed GitHub: {t_tasks_end - t_tasks_start:.4f}s")

        claimed   = {s.lower() for s in resume_data.skills}
        evidenced = {l.lower() for l in github_data["evidenced_languages"]}

        verified_skills   = list(claimed & evidenced)
        unverified_skills = list(claimed - evidenced)

        profile = {
            "resume":            resume_data.model_dump(),
            "github":            github_data,
            "verified_skills":   verified_skills,
            "unverified_skills": unverified_skills,
            "verification_rate": round(len(verified_skills) / len(claimed), 2) if claimed else 0,
            "college_name":      college_name,
            "linkedin_profile":  linkedin_profile,
            "leetcode_profile":  leetcode_profile,
            "other_coding_profile": other_coding_profile,
            "graduation_year":   graduation_year,
            "cgpa":              cgpa,
        }

        # Persist on the user record so /api/interview/start can look it up
        fake_users_db[current_user["email"]]["profile"] = profile

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


# ── Gemini prompt for question generation (STEP 2, 3) ───────────────────────────
OA_SYSTEM_PROMPT = (
    "You are an expert technical assessment designer for a hiring platform. "
    "Generate a personalized Online Assessment (OA) of EXACTLY 5 coding questions, "
    "tailored to the candidate's real skills, projects, GitHub repositories, "
    "programming languages, frameworks, and experience level.\n\n"
    "STRICT difficulty distribution (in this exact order):\n"
    "  - Question id 1 → Easy\n"
    "  - Question id 2 → Easy\n"
    "  - Question id 3 → Medium\n"
    "  - Question id 4 → Medium\n"
    "  - Question id 5 → Hard\n\n"
    "Personalization rules:\n"
    "  - Favor the candidate's strongest languages/frameworks; do NOT ask about "
    "    unrelated technologies (e.g. do not ask random Java questions if the "
    "    candidate is a Python/React/SQL developer).\n"
    "  - Where natural, theme the problem context around the domains of their projects.\n"
    "  - Each problem must be a self-contained coding challenge solvable in any language.\n\n"
    "For every question provide: a clear title, a detailed problem statement, "
    "constraints (newline separated), 1-3 worked examples (input, output, explanation), "
    "and starter code for python, cpp, java and javascript. "
    "Number the questions id 1..5 following the difficulty distribution above. "
    "Return JSON only."
)


def _summarize_profile_for_oa(profile: Optional[dict]) -> str:
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


async def generate_oa_questions(profile: Optional[dict]) -> List[dict]:
    """Ask Gemini for 5 schema-validated, personalized questions."""
    profile_summary = _summarize_profile_for_oa(profile)
    user_prompt = (
        f"Candidate Profile:\n{profile_summary}\n\n"
        "Generate the 5-question personalized OA now."
    )

    try:
        response = await asyncio.to_thread(
            gemini.models.generate_content,
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=OA_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=OAQuestionSet,
                temperature=0.6,
            ),
        )
    except genai_errors.APIError as e:
        raise HTTPException(502, f"Gemini API error while generating assessment: {e}")

    if not response.text:
        raise HTTPException(502, "Gemini returned an empty assessment.")

    try:
        parsed = OAQuestionSet.model_validate(json.loads(response.text))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(502, f"Gemini returned invalid assessment JSON: {e}")

    return [q.model_dump() for q in parsed.questions]


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
    questions = await generate_oa_questions(profile)

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


# =====================================================================
# 7. FINAL CONSOLIDATED CANDIDATE REPORT (OA + Technical + HR + résumé)
# =====================================================================

class RoundScoreSummary(BaseModel):
    round: str = Field(description="OA, Technical, or HR")
    score: float = Field(description="Round score 0-100 (0 if not attempted)")
    summary: str = Field(description="Short performance summary for this round")


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


def _format_oa_for_report(oa: Optional[dict]) -> str:
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


def _format_interview_round_for_report(data: Optional[dict]) -> str:
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


async def generate_final_candidate_report(
    profile: Optional[dict],
    assessments: dict,
) -> dict:
    """Combine résumé + all three rounds into one detailed Gemini report."""
    profile_summary = _summarize_profile_for_oa(profile)
    oa_text = _format_oa_for_report(assessments.get("OA"))
    tech_text = _format_interview_round_for_report(assessments.get("Technical"))
    hr_text = _format_interview_round_for_report(assessments.get("HR"))

    user_prompt = (
        f"Candidate Résumé / Profile:\n{profile_summary}\n\n"
        f"=== OA (Online Assessment) Round ===\n{oa_text}\n\n"
        f"=== Technical Round ===\n{tech_text}\n\n"
        f"=== HR Round ===\n{hr_text}\n\n"
        "Produce the final consolidated candidate report now."
    )

    system_instruction = (
        "You are a senior technical recruiter and hiring-panel lead for TrueHire AI. "
        "Read the candidate's résumé/profile and their performance across all three interview "
        "rounds (OA coding assessment, Technical interview, HR behavioral). Produce an honest, "
        "calibrated, and DETAILED final report. Compute an overall score (0-100) that weights "
        "coding/technical ability most, then communication/behavioral. Clearly articulate the "
        "candidate's strengths, weaknesses, and specific, actionable areas to improve. Compare "
        "demonstrated ability against the résumé claims and flag any over- or under-claiming. "
        "For any round that was not attempted, note it explicitly and score conservatively. "
        "Return JSON only."
    )

    try:
        response = await asyncio.to_thread(
            gemini.models.generate_content,
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=FinalCandidateReport,
                temperature=0.3,
            ),
        )
    except genai_errors.APIError as e:
        raise HTTPException(502, f"Gemini API error while generating final report: {e}")

    if not response.text:
        raise HTTPException(502, "Gemini returned an empty final report.")

    try:
        return FinalCandidateReport.model_validate(json.loads(response.text)).model_dump()
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(502, f"Gemini returned invalid final report JSON: {e}")


@app.post("/api/oa/final-report")
async def oa_final_report(current_user: dict = Depends(get_current_user)):
    """
    Generate the final consolidated report across OA + Technical + HR + résumé.
    Uses whatever round data has been recorded this session (in-memory).
    """
    email = current_user["email"]
    assessments = candidate_assessments.get(email, {})
    profile = current_user.get("profile")

    report = await generate_final_candidate_report(profile, assessments)
    completed = [r for r in ("OA", "Technical", "HR") if assessments.get(r)]

    return {"report": report, "completed_rounds": completed}


@app.get("/")
def health_check():
    return {"status": "ok"}