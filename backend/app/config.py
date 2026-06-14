# config.py
# Central configuration for the Research Agent backend.
# All model names, rate-limit settings, and tunable constants live here
# so they can be changed in one place without hunting across modules.

# ---------------------------------------------------------------------------
# Gemini models
# ---------------------------------------------------------------------------

# Primary chat model — used for query generation, insight extraction, and
# report writing.  gemini-2.5-flash gives substantially better reasoning
# quality than 2.0-flash-lite, especially for multi-step extraction tasks,
# while still having a generous free-tier rate limit.
GEMINI_CHAT_MODEL = "gemini-2.5-flash"

# Groq LLM — used for fast nodes (query generation, insight extraction).
# Free tier: 14,400 requests/day, ~500 tokens/second.
GROQ_CHAT_MODEL = "llama-3.3-70b-versatile"
GROQ_TEMPERATURE_PRECISE = 0.1

# Embedding model used by VectorMemory (changed to working gemini-embedding-2).
GEMINI_EMBEDDING_MODEL = "models/gemini-embedding-2"

# ---------------------------------------------------------------------------
# LLM call settings
# ---------------------------------------------------------------------------

# Temperature for factual extraction / query generation nodes.
LLM_TEMPERATURE_PRECISE = 0.2

# Temperature for creative / synthesis nodes (report generation).
LLM_TEMPERATURE_CREATIVE = 0.4

# ---------------------------------------------------------------------------
# Retry / rate-limit settings
# ---------------------------------------------------------------------------
# gemini-2.5-flash free tier: 15 RPM, 1M TPM, 500 RPD.
# We use tenacity to retry on 429 / 500 errors with exponential back-off.

RETRY_MAX_ATTEMPTS = 5          # Maximum number of LLM call attempts
RETRY_WAIT_MIN_SECONDS = 5      # Minimum wait between retries
RETRY_WAIT_MAX_SECONDS = 60     # Maximum wait between retries (cap)
RETRY_MULTIPLIER = 2            # Exponential back-off multiplier

# ---------------------------------------------------------------------------
# Scraper settings
# ---------------------------------------------------------------------------

# Maximum words to keep per scraped page before passing to the LLM.
# gemini-2.5-flash has a 1M token context window; 5000 words per page
# gives much richer signal without approaching any limit.
SCRAPER_MAX_WORDS = 5000

# Maximum characters of each page's content passed inside the LLM prompt
# for the extract_insights step.  Higher = better coverage per source.
INSIGHTS_CONTENT_CHARS = 6000

# ---------------------------------------------------------------------------
# Search / scraper limits
# ---------------------------------------------------------------------------

MAX_SEARCH_RESULTS_PER_QUERY = 3   # Tavily results per query (reduced for dev speed)
MAX_PAGES_TO_SCRAPE = 3            # Top N search results to scrape (reduced for dev speed)
VECTOR_MEMORY_RETRIEVE_LIMIT = 6   # Past insights to pull into context
GRAPH_MEMORY_RETRIEVE_LIMIT = 10   # Graph edges to pull into context
ASK_ENDPOINT_MEMORY_LIMIT = 8      # Insights retrieved for /ask endpoint
