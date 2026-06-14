# services/citation.py
# Builds structured citation records from scraped content and search results.
# Deduplicates by URL, applies today's access date, and formats them
# consistently so they can be injected into reports and API responses.

import logging
from datetime import date

logger = logging.getLogger(__name__)


class CitationService:
    """Builds and deduplicates structured citation records."""

    def build_citations(
        self,
        scraped_content: list[dict],
        search_results: list[dict],
    ) -> list[dict]:
        """
        Merge scraped content and search results into a deduplicated citation list.

        Args:
            scraped_content: List of dicts with title, url, content, word_count.
            search_results: List of dicts with title, url, content, score.

        Returns:
            Deduplicated list of citation dicts:
              { title, url, accessed_date }
        """
        today = date.today().isoformat()
        seen_urls: set[str] = set()
        citations: list[dict] = []

        # Prioritise scraped content (richer metadata)
        for item in scraped_content:
            url = item.get("url", "").strip()
            title = item.get("title", url).strip()
            if url and url not in seen_urls:
                seen_urls.add(url)
                citations.append(
                    {
                        "title": title or url,
                        "url": url,
                        "accessed_date": today,
                    }
                )

        # Fill in anything from search results not already covered
        for item in search_results:
            url = item.get("url", "").strip()
            title = item.get("title", url).strip()
            if url and url not in seen_urls:
                seen_urls.add(url)
                citations.append(
                    {
                        "title": title or url,
                        "url": url,
                        "accessed_date": today,
                    }
                )

        logger.info(f"Built {len(citations)} unique citations.")
        return citations

    def format_citations_markdown(self, citations: list[dict]) -> str:
        """
        Render citations as a numbered markdown list.

        Args:
            citations: List of citation dicts produced by build_citations().

        Returns:
            Markdown string suitable for embedding in a report.
        """
        if not citations:
            return "_No sources recorded._"

        lines = []
        for i, c in enumerate(citations, start=1):
            lines.append(
                f"{i}. [{c['title']}]({c['url']}) — Accessed: {c['accessed_date']}"
            )
        return "\n".join(lines)
