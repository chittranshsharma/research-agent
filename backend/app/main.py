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
from supabase import create_client, Client

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
# Supabase Client Helper
# ---------------------------------------------------------------------------

def get_supabase_client() -> Client:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set.")
    return create_client(supabase_url, supabase_key)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/research", response_model=ResearchResponse, summary="Run a full research session")
def run_research(request: ResearchRequest):
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

    response_data = ResearchResponse(
        session_id=session_id,
        topic=request.topic,
        report=final_state.get("report", ""),
        citations=final_state.get("citations", []),
        entities=final_state.get("entities", []),
        relationships=final_state.get("relationships", []),
    )

    try:
        supabase = get_supabase_client()
        supabase.table("research_sessions").insert({
            "session_id": session_id,
            "topic": request.topic,
            "report": response_data.report,
            "citations": response_data.citations,
            "entities": response_data.entities,
            "relationships": response_data.relationships,
        }).execute()
        logger.info(f"Saved session {session_id} to research_sessions table.")
    except Exception as e:
        logger.error(f"Failed to save session to research_sessions table: {e}")

    return response_data


@app.get(
    "/memory/{session_id}",
    response_model=list[dict],
    summary="Get all stored insights for a session",
)
def get_session_memory(session_id: str):
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
def list_sessions():
    """
    Return a deduplicated list of all sessions (session_id, topic, created_at)
    stored in the research_sessions Supabase table.
    """
    logger.info("Listing all past research sessions.")
    try:
        supabase = get_supabase_client()
        response = supabase.table("research_sessions").select("session_id, topic, created_at").order("created_at", desc=True).execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Failed to list sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Session listing failed: {str(e)}")


@app.get(
    "/research/{session_id}",
    response_model=ResearchResponse,
    summary="Get a past research session",
)
def get_research_session(session_id: str):
    """
    Retrieve a full research session (report, citations, graph data) from Supabase.
    """
    logger.info(f"Fetching full research session: {session_id}")
    try:
        supabase = get_supabase_client()
        response = supabase.table("research_sessions").select("*").eq("session_id", session_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Session not found")
        data = response.data[0]
        return ResearchResponse(
            session_id=data["session_id"],
            topic=data["topic"],
            report=data["report"],
            citations=data.get("citations") or [],
            entities=data.get("entities") or [],
            relationships=data.get("relationships") or [],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch session: {str(e)}")


@app.post("/ask", response_model=AskResponse, summary="Ask a follow-up question using memory")
def ask_question(request: AskRequest):
    """
    Answer a follow-up question by retrieving relevant past insights from
    VectorMemory and generating a grounded answer with Gemini.
    """
    logger.info(f"Answering question: {request.question}")

    sources: list[dict] = []
    context_text = ""
    session_context = ""

    # 1. Retrieve the active session's report and topic to anchor the LLM context
    if request.session_id:
        try:
            supabase = get_supabase_client()
            session_res = supabase.table("research_sessions").select("topic, report").eq("session_id", request.session_id).execute()
            if session_res.data:
                session_data = session_res.data[0]
                session_context = f"Active Research Topic: {session_data['topic']}\nActive Research Report Content:\n{session_data['report']}"
                logger.info(f"Loaded active session context for session {request.session_id}.")
        except Exception as e:
            logger.error(f"Failed to fetch session context for /ask: {e}")

    # 2. Retrieve semantic memory insights
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

    prompt = f"""You are a knowledgeable research assistant. 
Answer the following follow-up question. 

First, consider the context of the active research session (the topic and full report content) if provided:
{session_context or "No active research report context provided."}

Next, consider the following retrieved memory insights:
{context_text or "No memory insights found."}

Use the above details to write a grounded, accurate answer to the question. Do not hallucinate or confuse terms. If the question refers to concepts/names within the active research session, make sure to answer in that context.

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
