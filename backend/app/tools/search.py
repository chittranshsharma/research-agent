# tools/search.py
# Wraps the Tavily API client for web search.
# Returns structured search result dicts that feed into the scraping step.

import os
import logging
from tavily import TavilyClient

logger = logging.getLogger(__name__)


class TavilySearchTool:
    """Performs web searches using the Tavily API."""

    def __init__(self):
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            raise ValueError("TAVILY_API_KEY environment variable is not set.")
        self.client = TavilyClient(api_key=api_key)

    def search(self, query: str, max_results: int = 5) -> list[dict]:
        """
        Search the web for the given query.

        Args:
            query: The search string.
            max_results: Maximum number of results to return.

        Returns:
            List of dicts with keys: title, url, content, score.
            Returns an empty list if an error occurs.
        """
        try:
            response = self.client.search(
                query=query,
                max_results=max_results,
                search_depth="advanced",
                include_raw_content=False,
            )
            results = []
            for item in response.get("results", []):
                results.append(
                    {
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "content": item.get("content", ""),
                        "score": item.get("score", 0.0),
                    }
                )
            logger.info(f"Tavily search for '{query}' returned {len(results)} results.")
            return results
        except Exception as e:
            logger.error(f"Tavily search failed for query '{query}': {e}")
            return []
