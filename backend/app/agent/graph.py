# agent/graph.py
# Assembles the LangGraph StateGraph for the research agent pipeline.
# Defines the node execution order and compiles the runnable graph
# exported as `research_graph` for use by the FastAPI application.

import logging
from langgraph.graph import StateGraph, END

from app.agent.state import AgentState
from app.agent.nodes import (
    retrieve_memory_node,
    generate_queries_node,
    search_node,
    scrape_node,
    extract_insights_node,
    store_memory_node,
    build_citations_node,
    generate_report_node,
)

logger = logging.getLogger(__name__)


def build_research_graph():
    """
    Construct and compile the research agent LangGraph.

    Pipeline order:
        retrieve_memory
            → generate_queries
            → search
            → scrape
            → extract_insights
            → store_memory
            → build_citations
            → generate_report
            → END

    Returns:
        A compiled LangGraph runnable.
    """
    graph = StateGraph(AgentState)

    # Register all nodes
    graph.add_node("retrieve_memory", retrieve_memory_node)
    graph.add_node("generate_queries", generate_queries_node)
    graph.add_node("search", search_node)
    graph.add_node("scrape", scrape_node)
    graph.add_node("extract_insights", extract_insights_node)
    graph.add_node("store_memory", store_memory_node)
    graph.add_node("build_citations", build_citations_node)
    graph.add_node("generate_report", generate_report_node)

    # Define the linear execution path
    graph.set_entry_point("retrieve_memory")
    graph.add_edge("retrieve_memory", "generate_queries")
    graph.add_edge("generate_queries", "search")
    graph.add_edge("search", "scrape")
    graph.add_edge("scrape", "extract_insights")
    graph.add_edge("extract_insights", "store_memory")
    graph.add_edge("store_memory", "build_citations")
    graph.add_edge("build_citations", "generate_report")
    graph.add_edge("generate_report", END)

    compiled = graph.compile()
    logger.info("Research graph compiled successfully.")
    return compiled


# Singleton graph instance — imported by main.py
research_graph = build_research_graph()
