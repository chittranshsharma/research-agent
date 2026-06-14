# agent/nodes.py
# Contains all LangGraph node functions for the research agent pipeline.
# Each function receives the full AgentState, performs its step, and
# returns a partial dict of updated state fields.

import json
import logging
from datetime import date
from concurrent.futures import ThreadPoolExecutor

from app.agent.state import AgentState
from app.tools.search import TavilySearchTool
from app.tools.scraper import WebScraper
from app.memory.vector import VectorMemory
from app.memory.graph_db import GraphMemory
from app.services.citation import CitationService
from app.llm import get_llm, get_groq_llm, llm_invoke
from app.config import (
    MAX_SEARCH_RESULTS_PER_QUERY,
    MAX_PAGES_TO_SCRAPE,
    VECTOR_MEMORY_RETRIEVE_LIMIT,
    GRAPH_MEMORY_RETRIEVE_LIMIT,
    INSIGHTS_CONTENT_CHARS,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _extract_text(response) -> str:
    """
    Safely extract plain text from an LLM response.

    Gemini 2.5 Flash with thinking mode can return response.content as a
    list of content-part dicts (e.g. [{"type": "thinking", "thinking": ...},
    {"type": "text", "text": "..."}]) instead of a plain string.
    This helper normalises both cases to a single string.
    """
    content = response.content if hasattr(response, "content") else str(response)
    if isinstance(content, str):
        return content
    # content is a list of parts — concatenate only the 'text' parts
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                # Part may be {"type": "text", "text": "..."} or similar
                parts.append(part.get("text") or part.get("content") or "")
            else:
                # Fallback: cast to string (handles LangChain content blocks)
                text = getattr(part, "text", None) or str(part)
                parts.append(text)
        return "\n".join(p for p in parts if p)
    return str(content)


def _parse_json_from_llm(text: str) -> any:
    """
    Attempt to parse JSON from an LLM response string.
    The model sometimes wraps JSON in markdown code fences — strip those first.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Drop first line (```json or ```) and last line (```)
        cleaned = "\n".join(lines[1:-1]).strip()
    return json.loads(cleaned)


# ---------------------------------------------------------------------------
# Node 1: retrieve_memory_node
# ---------------------------------------------------------------------------

def retrieve_memory_node(state: AgentState) -> dict:
    """
    Retrieves relevant past insights from VectorMemory and GraphMemory.
    Called at the START of a session to prime the agent with prior knowledge.
    """
    topic = state["topic"]
    logger.info(f"[retrieve_memory] Retrieving memory for topic: {topic}")

    context_parts: list[str] = []

    try:
        vector_mem = VectorMemory()
        past_insights = vector_mem.retrieve(topic, limit=VECTOR_MEMORY_RETRIEVE_LIMIT)
        if past_insights:
            context_parts.append("## Relevant Past Insights (from previous sessions):")
            for item in past_insights:
                insight_text = item.get("insight", "")
                source_title = item.get("source_title", "")
                if insight_text:
                    context_parts.append(f"- {insight_text} [Source: {source_title}]")
    except Exception as e:
        logger.error(f"[retrieve_memory] VectorMemory retrieval failed: {e}")

    try:
        graph_mem = GraphMemory()
        related_graph = graph_mem.retrieve_related(topic, limit=GRAPH_MEMORY_RETRIEVE_LIMIT)
        graph_mem.close()
        if related_graph:
            context_parts.append("\n## Related Knowledge Graph Context (entities & relationships):")
            for edge in related_graph:
                context_parts.append(
                    f"- {edge['source']} --[{edge['relation']}]--> {edge['target']}"
                )
    except Exception as e:
        logger.error(f"[retrieve_memory] GraphMemory retrieval failed: {e}")

    memory_context = "\n".join(context_parts) if context_parts else ""
    logger.info(f"[retrieve_memory] Memory context length: {len(memory_context)} chars")
    return {"memory_context": memory_context}


# ---------------------------------------------------------------------------
# Node 2: generate_queries_node
# ---------------------------------------------------------------------------

def generate_queries_node(state: AgentState) -> dict:
    """
    Uses Groq (llama-3.3-70b) to generate 3-5 diverse search queries for the topic.
    Considers memory_context to avoid re-researching already-known areas.
    """
    topic = state["topic"]
    memory_context = state.get("memory_context", "")
    logger.info(f"[generate_queries] Generating queries for: {topic}")

    llm = get_groq_llm()
    logger.info("[generate_queries] Using Groq llama-3.3-70b")

    memory_section = (
        f"\n\nWe already know the following from past research sessions:\n{memory_context}"
        if memory_context
        else ""
    )

    prompt = f"""You are a research assistant generating web search queries.

Topic: {topic}{memory_section}

Generate 3-5 diverse, specific search queries that will surface high-quality information 
about this topic. If prior knowledge is provided, focus queries on gaps or deeper angles 
not already covered.

Respond ONLY with a valid JSON array of strings. Example:
["query one", "query two", "query three"]
"""

    try:
        response = llm_invoke(llm, prompt)
        queries = _parse_json_from_llm(_extract_text(response))
        if not isinstance(queries, list):
            raise ValueError("LLM did not return a list")
        queries = [str(q) for q in queries if q]
        logger.info(f"[generate_queries] Generated {len(queries)} queries.")
        return {"search_queries": queries}
    except Exception as e:
        logger.error(f"[generate_queries] Failed to parse LLM queries: {e}")
        # Fallback: use the topic itself as a single query
        return {"search_queries": [topic]}


# ---------------------------------------------------------------------------
# Node 3: search_node
# ---------------------------------------------------------------------------

def search_node(state: AgentState) -> dict:
    """
    Runs TavilySearchTool for each generated query and deduplicates results by URL.
    """
    queries = state.get("search_queries", [])
    logger.info(f"[search] Running {len(queries)} queries.")

    searcher = TavilySearchTool()
    seen_urls: set[str] = set()
    all_results: list[dict] = []

    for query in queries:
        results = searcher.search(query, max_results=MAX_SEARCH_RESULTS_PER_QUERY)
        for result in results:
            url = result.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_results.append(result)

    logger.info(f"[search] Total unique results: {len(all_results)}")
    return {"search_results": all_results}


# ---------------------------------------------------------------------------
# Node 4: scrape_node
# ---------------------------------------------------------------------------

def scrape_node(state: AgentState) -> dict:
    """
    Scrapes the top N URLs from search results in PARALLEL using a
    ThreadPoolExecutor — cuts scrape time from ~30s to ~8s.
    """
    search_results = state.get("search_results", [])
    top_results = search_results[:MAX_PAGES_TO_SCRAPE]
    logger.info(f"[scrape] Scraping {len(top_results)} URLs in parallel.")

    scraper = WebScraper()

    def scrape_single(result: dict) -> dict:
        url = result.get("url", "")
        if url:
            return scraper.scrape(url)
        return {}

    with ThreadPoolExecutor(max_workers=5) as executor:
        scraped_list = list(executor.map(scrape_single, top_results))

    scraped_content = [s for s in scraped_list if s.get("content")]
    logger.info(f"[scrape] Successfully scraped {len(scraped_content)} pages.")
    return {"scraped_content": scraped_content}


# ---------------------------------------------------------------------------
# Node 5: extract_insights_node
# ---------------------------------------------------------------------------

def extract_insights_node(state: AgentState) -> dict:
    """
    Uses Gemini to extract key insights, named entities, and entity relationships
    from the scraped web content.
    """
    scraped_content = state.get("scraped_content", [])
    topic = state["topic"]
    logger.info(f"[extract_insights] Extracting from {len(scraped_content)} pages.")

    if not scraped_content:
        return {"extracted_insights": [], "entities": [], "relationships": []}

    llm = get_groq_llm()
    logger.info("[extract_insights] Using Groq llama-3.3-70b")

    # Build content summary for the prompt — more chars thanks to gemini-2.5-flash context
    content_block = ""
    for page in scraped_content:
        content_block += (
            f"\n\n--- SOURCE ---\n"
            f"Title: {page.get('title', '')}\n"
            f"URL: {page.get('url', '')}\n"
            f"Content:\n{page.get('content', '')[:INSIGHTS_CONTENT_CHARS]}\n"
        )

    prompt = f"""You are a research analyst. Analyze the following web content about "{topic}".

{content_block}

Extract and return a JSON object with exactly these three keys:

1. "insights": array of objects, each with:
   - "insight": a key finding or important fact (2-3 sentences)
   - "source_url": the URL this insight came from
   - "source_title": the page title
   - "confidence": "high", "medium", or "low"

2. "entities": array of objects, each with:
   - "name": entity name
   - "type": one of Concept, Person, Organization, Technology, Place, Event
   - "description": brief description (1 sentence)

3. "relationships": array of objects, each with:
   - "source": name of source entity
   - "relation": relationship type (e.g., DEVELOPED_BY, PART_OF, USED_IN)
   - "target": name of target entity

Aim for 5-10 insights, 8-15 entities, and 5-10 relationships. 
Respond ONLY with valid JSON. No markdown fences, no extra text.
"""

    try:
        response = llm_invoke(llm, prompt)
        parsed = _parse_json_from_llm(_extract_text(response))

        insights = parsed.get("insights", [])
        entities = parsed.get("entities", [])
        relationships = parsed.get("relationships", [])

        logger.info(
            f"[extract_insights] Extracted {len(insights)} insights, "
            f"{len(entities)} entities, {len(relationships)} relationships."
        )
        return {
            "extracted_insights": insights,
            "entities": entities,
            "relationships": relationships,
        }
    except Exception as e:
        logger.error(f"[extract_insights] LLM extraction failed: {e}")
        return {"extracted_insights": [], "entities": [], "relationships": []}


# ---------------------------------------------------------------------------
# Node 6: store_memory_node
# ---------------------------------------------------------------------------

def store_memory_node(state: AgentState) -> dict:
    """
    Persists all extracted insights into VectorMemory (Supabase pgvector)
    and all entities/relationships into GraphMemory (Neo4j).
    Side-effects only — does not modify state.
    """
    session_id = state["session_id"]
    topic = state["topic"]
    insights = state.get("extracted_insights", [])
    entities = state.get("entities", [])
    relationships = state.get("relationships", [])

    logger.info(
        f"[store_memory] Storing {len(insights)} insights, "
        f"{len(entities)} entities, {len(relationships)} relationships."
    )

    # --- Vector memory ---
    try:
        vector_mem = VectorMemory()
        for item in insights:
            insight_text = item.get("insight", "")
            if insight_text:
                vector_mem.store(
                    session_id=session_id,
                    topic=topic,
                    insight=insight_text,
                    source_url=item.get("source_url", ""),
                    source_title=item.get("source_title", ""),
                )
    except Exception as e:
        logger.error(f"[store_memory] VectorMemory storage error: {e}")

    # --- Graph memory ---
    try:
        graph_mem = GraphMemory()
        for entity in entities:
            name = entity.get("name", "")
            if name:
                graph_mem.store_entity(
                    name=name,
                    entity_type=entity.get("type", "Entity"),
                    description=entity.get("description", ""),
                    session_id=session_id,
                )
        for rel in relationships:
            source = rel.get("source", "")
            target = rel.get("target", "")
            relation = rel.get("relation", "RELATED_TO")
            if source and target:
                graph_mem.store_relationship(
                    source_name=source,
                    relation=relation,
                    target_name=target,
                    session_id=session_id,
                )
        graph_mem.close()
    except Exception as e:
        logger.error(f"[store_memory] GraphMemory storage error: {e}")

    return {}  # No state changes


# ---------------------------------------------------------------------------
# Node 7: build_citations_node
# ---------------------------------------------------------------------------

def build_citations_node(state: AgentState) -> dict:
    """
    Builds a structured, deduplicated citation list from scraped content
    and search results using CitationService.
    """
    logger.info("[build_citations] Building citation list.")
    service = CitationService()
    citations = service.build_citations(
        scraped_content=state.get("scraped_content", []),
        search_results=state.get("search_results", []),
    )
    return {"citations": citations}


# ---------------------------------------------------------------------------
# Node 8: generate_report_node
# ---------------------------------------------------------------------------

def generate_report_node(state: AgentState) -> dict:
    """
    Uses Gemini to synthesize all gathered information into a structured
    markdown research report, enriched with context from past sessions.

    Uses the 'creative' temperature setting for richer prose synthesis.
    """
    topic = state["topic"]
    insights = state.get("extracted_insights", [])
    entities = state.get("entities", [])
    relationships = state.get("relationships", [])
    memory_context = state.get("memory_context", "")
    citations = state.get("citations", [])

    logger.info(f"[generate_report] Generating report for: {topic}")

    # Use Gemini for the final report — quality matters most here
    llm = get_llm(creative=True)
    logger.info("[generate_report] Using Gemini 2.5 Flash")

    # Format inputs for the prompt
    insights_text = "\n".join(
        [f"- {i.get('insight', '')} (Source: {i.get('source_title', '')})"
         for i in insights]
    ) or "No insights extracted."

    entities_text = "\n".join(
        [f"- [{e.get('type', 'Entity')}] {e.get('name', '')}: {e.get('description', '')}"
         for e in entities]
    ) or "No entities found."

    relationships_text = "\n".join(
        [f"- {r.get('source', '')} --[{r.get('relation', '')}]--> {r.get('target', '')}"
         for r in relationships]
    ) or "No relationships found."

    citations_text = "\n".join(
        [f"{i+1}. [{c['title']}]({c['url']}) — Accessed: {c['accessed_date']}"
         for i, c in enumerate(citations)]
    ) or "No sources available."

    memory_section = (
        f"\n\n### Context from Previous Research Sessions\n{memory_context}"
        if memory_context
        else ""
    )

    prompt = f"""You are an expert research analyst. Write a comprehensive, well-structured 
research report in markdown format based on the information provided below.

Topic: {topic}
Date: {date.today().isoformat()}

EXTRACTED INSIGHTS:
{insights_text}

KNOWLEDGE GRAPH — ENTITIES:
{entities_text}

KNOWLEDGE GRAPH — RELATIONSHIPS:
{relationships_text}
{memory_section}

CITATIONS:
{citations_text}

Write the report using EXACTLY this structure:

## Research Report: {topic}

### Executive Summary
[2-3 paragraph high-level overview]

### Key Findings
[Bullet list of the most important findings]

### Detailed Analysis
[Comprehensive analysis organized by sub-themes. Cite sources inline as [Source Title](url)]

### Knowledge Graph Insights
[Discuss the entities and relationships discovered. What do they reveal about the topic's 
structure and interconnections?]

### Sources & Citations
[Numbered list of all sources]

Be thorough, analytical, and cite specific sources throughout. Use the memory context 
to add depth from past research where relevant.
"""

    try:
        response = llm_invoke(llm, prompt)
        report = _extract_text(response)
        logger.info(f"[generate_report] Report generated ({len(report)} chars).")
        return {"report": report}
    except Exception as e:
        logger.error(f"[generate_report] LLM report generation failed: {e}")
        return {
            "report": f"## Research Report: {topic}\n\nReport generation failed: {e}"
        }
