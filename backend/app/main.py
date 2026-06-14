# main.py
# FastAPI application entrypoint for the Research Agent backend.
# Exposes four endpoints:
#   POST /research  — run a full research session
#   GET  /memory/{session_id} — get all stored insights for a session
#   GET  /sessions  — list all past research sessions
#   POST /ask       — answer a follow-up question using memory

import os
import logging
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()  # Load .env before anything else imports os.getenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from app.agent.graph import research_graph
from app.memory.vector import VectorMemory
from app.llm import get_llm, llm_invoke
from app.agent.nodes import _extract_text
from app.config import ASK_ENDPOINT_MEMORY_LIMIT

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Model name is managed centrally in app/config.py

# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Research Agent API starting up.")
    yield
    logger.info("Research Agent API shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Research Agent API",
    description=(
        "A LangGraph-based autonomous research agent with persistent memory "
        "powered by Supabase pgvector and Neo4j AuraDB."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class ResearchRequest(BaseModel):
    topic: str = Field(..., min_length=3, description="The research topic to investigate.")
    session_id: Optional[str] = Field(
        default=None,
        description="Optional session ID. A new UUID is generated if not provided.",
    )

class ResearchResponse(BaseModel):
    session_id: str
    topic: str
    report: str
    citations: list[dict]
    entities: list[dict]
    relationships: list[dict]


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, description="The follow-up question to answer.")
    session_id: Optional[str] = Field(
        default=None,
        description="Optional session ID to scope memory retrieval.",
    )

class AskResponse(BaseModel):
    answer: str
    sources: list[dict]


class SessionSummary(BaseModel):
    session_id: str
    topic: str
    created_at: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/research", response_model=ResearchResponse, summary="Run a full research session")
async def run_research(request: ResearchRequest):
    """
    Invoke the LangGraph research pipeline for the given topic.
    Returns the generated report, citations, entities, and relationships.
    """
    session_id = request.session_id or str(uuid.uuid4())
    logger.info(f"Starting research session {session_id} for topic: {request.topic}")

    initial_state = {
        "topic": request.topic,
        "session_id": session_id,
        "search_queries": [],
        "search_results": [],
        "scraped_content": [],
        "extracted_insights": [],
        "entities": [],
        "relationships": [],
        "memory_context": "",
        "report": "",
        "citations": [],
        "messages": [],
    }

    try:
        final_state = research_graph.invoke(initial_state)
    except Exception as e:
        logger.error(f"Research graph failed for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Research pipeline failed: {str(e)}")

    return ResearchResponse(
        session_id=session_id,
        topic=request.topic,
        report=final_state.get("report", ""),
        citations=final_state.get("citations", []),
        entities=final_state.get("entities", []),
        relationships=final_state.get("relationships", []),
    )


@app.get(
    "/memory/{session_id}",
    response_model=list[dict],
    summary="Get all stored insights for a session",
)
async def get_session_memory(session_id: str):
    """
    Retrieve all insights stored in VectorMemory for a given session ID.
    """
    logger.info(f"Fetching memory for session: {session_id}")
    try:
        vector_mem = VectorMemory()
        history = vector_mem.get_session_history(session_id)
        return history
    except Exception as e:
        logger.error(f"Failed to fetch memory for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Memory retrieval failed: {str(e)}")


@app.get(
    "/sessions",
    response_model=list[dict],
    summary="List all past research sessions",
)
async def list_sessions():
    """
    Return a deduplicated list of all sessions (session_id, topic, created_at)
    stored in Supabase.
    """
    logger.info("Listing all past research sessions.")
    try:
        vector_mem = VectorMemory()
        sessions = vector_mem.get_all_sessions()
        return sessions
    except Exception as e:
        logger.error(f"Failed to list sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Session listing failed: {str(e)}")


@app.post("/ask", response_model=AskResponse, summary="Ask a follow-up question using memory")
async def ask_question(request: AskRequest):
    """
    Answer a follow-up question by retrieving relevant past insights from
    VectorMemory and generating a grounded answer with Gemini.
    """
    logger.info(f"Answering question: {request.question}")

    sources: list[dict] = []
    context_text = ""

    try:
        vector_mem = VectorMemory()
        past_insights = vector_mem.retrieve(request.question, limit=ASK_ENDPOINT_MEMORY_LIMIT)
        if past_insights:
            context_lines = []
            for item in past_insights:
                insight = item.get("insight", "")
                source_title = item.get("source_title", "")
                source_url = item.get("source_url", "")
                if insight:
                    context_lines.append(f"- {insight}")
                    if source_url and source_url not in [s.get("url") for s in sources]:
                        sources.append({"title": source_title, "url": source_url})
            context_text = "\n".join(context_lines)
    except Exception as e:
        logger.error(f"Memory retrieval for /ask failed: {e}")
        context_text = ""

    llm = get_llm(creative=False)

    if context_text:
        prompt = f"""You are a knowledgeable research assistant. 
Answer the following question using the provided context from past research sessions.
Be specific and cite the context where relevant.

Context:
{context_text}

Question: {request.question}

Answer:"""
    else:
        prompt = f"""You are a knowledgeable research assistant. 
Answer the following question as accurately as possible. Note that no prior 
research context was found for this question.

Question: {request.question}

Answer:"""

    try:
        response = llm_invoke(llm, prompt)
        answer = _extract_text(response)
    except Exception as e:
        logger.error(f"LLM failed to answer question: {e}")
        raise HTTPException(status_code=500, detail=f"Answer generation failed: {str(e)}")

    return AskResponse(answer=answer, sources=sources)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", summary="Health check")
async def health_check():
    return {"status": "ok", "service": "Research Agent API"}
