# memory/vector.py
# Manages semantic (vector) memory using Supabase + pgvector.
# Embeds insights using Google text-embedding-004 and stores/retrieves
# them via cosine similarity search for cross-session knowledge recall.

import os
import logging
from datetime import datetime, timezone
from supabase import create_client, Client
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from app.config import GEMINI_EMBEDDING_MODEL

logger = logging.getLogger(__name__)

TABLE_NAME = "research_memory"
EMBEDDING_MODEL = GEMINI_EMBEDDING_MODEL


class VectorMemory:
    """Stores and retrieves research insights using Supabase pgvector."""

    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        google_api_key = os.getenv("GOOGLE_API_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set.")
        if not google_api_key:
            raise ValueError("GOOGLE_API_KEY must be set for embeddings.")

        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model=EMBEDDING_MODEL,
            google_api_key=google_api_key,
        )



    def _embed(self, text: str) -> list[float]:
        """Embed a text string and return the embedding vector."""
        try:
            return self.embeddings.embed_query(text)
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            raise

    def store(
        self,
        session_id: str,
        topic: str,
        insight: str,
        source_url: str,
        source_title: str,
    ) -> None:
        """
        Embed an insight and store it in the Supabase research_memory table.

        Args:
            session_id: The research session identifier.
            topic: The research topic for this session.
            insight: The insight text to embed and store.
            source_url: URL of the source this insight came from.
            source_title: Title of the source page.
        """
        try:
            embedding = self._embed(insight)
            record = {
                "session_id": session_id,
                "topic": topic,
                "insight": insight,
                "source_url": source_url,
                "source_title": source_title,
                "embedding": embedding,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self.supabase.table(TABLE_NAME).insert(record).execute()
            logger.info(f"Stored insight for session {session_id}: {insight[:60]}...")
        except Exception as e:
            logger.error(f"Failed to store insight in vector memory: {e}")

    def retrieve(self, query: str, limit: int = 5) -> list[dict]:
        """
        Retrieve the most semantically similar past insights for a query.

        Args:
            query: The query string to embed and search against.
            limit: Maximum number of results to return.

        Returns:
            List of dicts with insight data from past sessions.
        """
        try:
            query_embedding = self._embed(query)
            # Use Supabase RPC for pgvector cosine similarity search
            response = self.supabase.rpc(
                "match_research_memory",
                {
                    "query_embedding": query_embedding,
                    "match_limit": limit,
                },
            ).execute()
            results = response.data or []
            logger.info(f"Retrieved {len(results)} past insights for query: {query[:60]}")
            return results
        except Exception as e:
            logger.error(f"Failed to retrieve from vector memory: {e}")
            return []

    def get_session_history(self, session_id: str) -> list[dict]:
        """
        Return all stored insights for a given session_id.

        Args:
            session_id: The session to look up.

        Returns:
            List of insight records.
        """
        try:
            response = (
                self.supabase.table(TABLE_NAME)
                .select("id, session_id, topic, insight, source_url, source_title, created_at")
                .eq("session_id", session_id)
                .order("created_at", desc=False)
                .execute()
            )
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get session history for {session_id}: {e}")
            return []

    def get_all_sessions(self) -> list[dict]:
        """
        Return a summary of all unique sessions (session_id + topic).

        Returns:
            List of dicts with session_id and topic.
        """
        try:
            response = (
                self.supabase.table(TABLE_NAME)
                .select("session_id, topic, created_at")
                .order("created_at", desc=True)
                .execute()
            )
            data = response.data or []
            # Deduplicate by session_id, keep most recent
            seen = {}
            for row in data:
                sid = row["session_id"]
                if sid not in seen:
                    seen[sid] = {"session_id": sid, "topic": row["topic"], "created_at": row["created_at"]}
            return list(seen.values())
        except Exception as e:
            logger.error(f"Failed to retrieve all sessions: {e}")
            return []
