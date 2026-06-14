# tools/scraper.py
# Fetches web pages and extracts clean main-body text using BeautifulSoup4.
# Strips navigation, footers, scripts, and ads to reduce noise for the LLM.

import logging
import requests
from bs4 import BeautifulSoup

from app.config import SCRAPER_MAX_WORDS

logger = logging.getLogger(__name__)

# Tags unlikely to contain meaningful article content
NOISE_TAGS = [
    "nav", "footer", "header", "aside", "script", "style",
    "noscript", "form", "button", "iframe", "advertisement",
    "figure", "figcaption",
]

REQUEST_TIMEOUT = 10  # seconds


class WebScraper:
    """Scrapes a URL and returns clean text content."""

    def scrape(self, url: str) -> dict:
        """
        Fetch and clean the text content of a web page.

        Args:
            url: The URL to scrape.

        Returns:
            Dict with keys: title, url, content, word_count.
            Returns an empty dict on any failure.
        """
        try:
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            }
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            # Extract page title
            title_tag = soup.find("title")
            title = title_tag.get_text(strip=True) if title_tag else url

            # Remove noise elements
            for tag in NOISE_TAGS:
                for element in soup.find_all(tag):
                    element.decompose()

            # Prefer article/main content areas; fall back to body
            main_content = (
                soup.find("article")
                or soup.find("main")
                or soup.find(id="content")
                or soup.find(class_="content")
                or soup.find("body")
            )

            if not main_content:
                logger.warning(f"No main content found for {url}")
                return {}

            # Get all paragraph text
            paragraphs = main_content.find_all(["p", "h1", "h2", "h3", "h4", "li"])
            text_parts = [p.get_text(separator=" ", strip=True) for p in paragraphs]
            full_text = " ".join(text_parts)

            # Truncate to MAX_WORDS
            words = full_text.split()
            if len(words) > SCRAPER_MAX_WORDS:
                words = words[:SCRAPER_MAX_WORDS]
            trimmed_text = " ".join(words)

            if not trimmed_text.strip():
                logger.warning(f"Scraped empty content from {url}")
                return {}

            logger.info(f"Scraped {len(words)} words from {url}")
            return {
                "title": title,
                "url": url,
                "content": trimmed_text,
                "word_count": len(words),
            }

        except requests.exceptions.Timeout:
            logger.error(f"Request timed out for URL: {url}")
            return {}
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP error scraping {url}: {e}")
            return {}
        except Exception as e:
            logger.error(f"Unexpected error scraping {url}: {e}")
            return {}
