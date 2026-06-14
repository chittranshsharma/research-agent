# llm.py
# Shared LLM factories and retry-decorated invoke helper.
#
# LLM Strategy:
#   - Groq (llama-3.3-70b):  generate_queries_node, extract_insights_node
#       Free tier: 14,400 requests/day, ~500 tokens/second. No cold starts.
#   - Gemini 2.5 Flash:       generate_report_node (final report only)
#       Free tier: 15 RPM, 500 RPD. Used sparingly for maximum quality.
#
# Both LLMs are wrapped with the same tenacity retry decorator so rate-limit
# errors from either provider are handled identically.
#
# Usage:
#   from app.llm import get_llm, get_groq_llm, llm_invoke
#   response = llm_invoke(get_groq_llm(), my_prompt)

import os
import logging
from typing import Union

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception,
    before_sleep_log,
)

from app.config import (
    GEMINI_CHAT_MODEL,
    LLM_TEMPERATURE_PRECISE,
    LLM_TEMPERATURE_CREATIVE,
    GROQ_CHAT_MODEL,
    GROQ_TEMPERATURE_PRECISE,
    RETRY_MAX_ATTEMPTS,
    RETRY_WAIT_MIN_SECONDS,
    RETRY_WAIT_MAX_SECONDS,
    RETRY_MULTIPLIER,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Retry predicate — catch rate-limit and transient server errors
# ---------------------------------------------------------------------------

def _is_retryable(exc: BaseException) -> bool:
    """Return True for HTTP 429 (rate limit) and 500-level server errors from any provider."""
    msg = str(exc).lower()
    retryable_signals = [
        "429",
        "quota",
        "rate limit",
        "rate_limit_exceeded",
        "resource exhausted",
        "groq",
        "503",
        "500",
        "internal server error",
        "service unavailable",
    ]
    return any(signal in msg for signal in retryable_signals)


# ---------------------------------------------------------------------------
# LLM factories
# ---------------------------------------------------------------------------

def get_llm(creative: bool = False) -> ChatGoogleGenerativeAI:
    """
    Return a configured Gemini 2.5 Flash LLM instance.
    Use only for generate_report_node where quality matters most.

    Args:
        creative: If True, uses a higher temperature suitable for report
                  synthesis.  If False (default), uses the precise/low
                  temperature for extraction and query generation.
    """
    temperature = LLM_TEMPERATURE_CREATIVE if creative else LLM_TEMPERATURE_PRECISE
    return ChatGoogleGenerativeAI(
        model=GEMINI_CHAT_MODEL,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        temperature=temperature,
    )


def get_groq_llm() -> ChatGroq:
    """
    Return a configured Groq LLM instance (llama-3.3-70b-versatile).
    Used for fast, high-throughput nodes (query generation, insight extraction).
    Groq free tier: 14,400 requests/day, ~500 tokens/second — no cold starts.
    """
    return ChatGroq(
        model=GROQ_CHAT_MODEL,
        groq_api_key=os.getenv("GROQ_API_KEY"),
        temperature=GROQ_TEMPERATURE_PRECISE,
    )


# ---------------------------------------------------------------------------
# Retry-wrapped invoke (works for both Gemini and Groq)
# ---------------------------------------------------------------------------

@retry(
    retry=retry_if_exception(_is_retryable),
    stop=stop_after_attempt(RETRY_MAX_ATTEMPTS),
    wait=wait_exponential(
        multiplier=RETRY_MULTIPLIER,
        min=RETRY_WAIT_MIN_SECONDS,
        max=RETRY_WAIT_MAX_SECONDS,
    ),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def llm_invoke(llm: Union[ChatGoogleGenerativeAI, ChatGroq], prompt: Union[str, list]) -> BaseMessage:
    """
    Invoke the LLM with automatic retry on rate-limit and server errors.
    Works identically for both Gemini and Groq instances.

    Args:
        llm:    A ChatGoogleGenerativeAI or ChatGroq instance.
        prompt: A string prompt or list of LangChain messages.

    Returns:
        The LLM's response BaseMessage.

    Raises:
        The last exception if all retry attempts are exhausted.
    """
    return llm.invoke(prompt)
