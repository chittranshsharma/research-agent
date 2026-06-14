# llm.py
# Shared LLM factory and retry-decorated invoke helper.
#
# Why this exists:
#   gemini-2.5-flash (free tier) is capped at 15 RPM.  The research pipeline
#   makes 3 sequential LLM calls per session, so bursts or concurrent
#   requests can easily trigger HTTP 429 responses.  Wrapping every call
#   with tenacity's exponential back-off means the pipeline self-heals
#   instead of crashing.
#
# Usage:
#   from app.llm import get_llm, llm_invoke
#   response = llm_invoke(get_llm(), my_prompt)

import os
import logging
from typing import Union

from langchain_google_genai import ChatGoogleGenerativeAI
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
    """Return True for HTTP 429 (rate limit) and 500-level server errors."""
    msg = str(exc).lower()
    retryable_signals = [
        "429",
        "quota",
        "rate limit",
        "resource exhausted",
        "503",
        "500",
        "internal server error",
        "service unavailable",
    ]
    return any(signal in msg for signal in retryable_signals)


# ---------------------------------------------------------------------------
# LLM factory
# ---------------------------------------------------------------------------

def get_llm(creative: bool = False) -> ChatGoogleGenerativeAI:
    """
    Return a configured Gemini 2.5 Flash LLM instance.

    Args:
        creative: If True, uses a higher temperature suitable for report
                  synthesis.  If False (default), uses the precise/low
                  temperature for extraction and query generation.

    Returns:
        A ChatGoogleGenerativeAI instance ready for invocation.
    """
    temperature = LLM_TEMPERATURE_CREATIVE if creative else LLM_TEMPERATURE_PRECISE
    return ChatGoogleGenerativeAI(
        model=GEMINI_CHAT_MODEL,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        temperature=temperature,
    )


# ---------------------------------------------------------------------------
# Retry-wrapped invoke
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
def llm_invoke(llm: ChatGoogleGenerativeAI, prompt: Union[str, list]) -> BaseMessage:
    """
    Invoke the LLM with automatic retry on rate-limit and server errors.

    Uses exponential back-off (configured in config.py).  All retryable
    errors are logged at WARNING level before each sleep.

    Args:
        llm:    A ChatGoogleGenerativeAI instance (from get_llm()).
        prompt: A string prompt or list of LangChain messages.

    Returns:
        The LLM's response BaseMessage.

    Raises:
        The last exception if all retry attempts are exhausted.
    """
    return llm.invoke(prompt)
