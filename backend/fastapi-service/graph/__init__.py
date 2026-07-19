"""
TrueHire AI - LangGraph workflow package.

This package refactors the AI workflow of the FastAPI service into modular
LangGraph graphs. It is an internal implementation detail of the FastAPI
service only — the React frontend and the Express backend are unaware that
LangGraph is being used. All public HTTP endpoint paths, request models and
response shapes remain unchanged.

Layout:
    llm.py        - shared Gemini client + structured-generation helpers
    schemas.py    - Pydantic schemas produced by the AI nodes (Gemini output)
    prompts.py    - centralized system prompts / prompt builders
    utils.py      - shared utilities (PDF text, GitHub analysis, formatters)
    state.py      - TypedDict shared-state definitions for each graph
    nodes/        - individual graph nodes (one AI task per node)
    profile_graph.py  - backs POST /build-profile
    oa_graph.py       - backs POST /api/oa/generate
    report_graph.py   - backs POST /api/oa/final-report
"""
