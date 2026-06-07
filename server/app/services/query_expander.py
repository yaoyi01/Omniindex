"""
Query expansion via DeepSeek LLM.
Given a raw user query, LLM generates:
  - Expanded keywords for ILIKE matching
  - Optimized description for semantic embedding
"""
import json
import logging
from typing import Optional
from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger("query_expander")

# Lazy init to avoid loading on import
_client: Optional[OpenAI] = None

def _get_client() -> Optional[OpenAI]:
    global _client
    if _client is not None:
        return _client
    if not settings.DEEPSEEK_API_KEY:
        logger.warning("DEEPSEEK_API_KEY not configured, query expansion disabled")
        return None
    _client = OpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
    )
    return _client

QUERY_EXPAND_PROMPT = """You are a search query optimizer for a file indexing system. 
Given a user's search query, output a JSON object with two fields:
  - "keywords": array of related search keywords (include the original terms + Chinese/English equivalents + related concepts)
  - "embedding_text": a concise descriptive sentence (max 200 chars) that captures the semantic intent for vector similarity search

Rules:
- Keywords should cover synonyms, abbreviations, related technical terms in both Chinese and English
- The embedding_text should combine the core intent with contextually related concepts
- Keep it concise and relevant

Output ONLY valid JSON, no markdown or explanation."""


def expand_query(raw_query: str) -> dict:
    """
    Expand a raw search query via LLM.
    
    Returns dict with:
      - keywords: list[str] — expanded keywords for ILIKE matching
      - embedding_text: str — optimized text for vector embedding
      
    On failure, returns the raw query split as fallback.
    """
    client = _get_client()
    if client is None:
        return _fallback(raw_query)

    try:
        response = client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": QUERY_EXPAND_PROMPT},
                {"role": "user", "content": raw_query},
            ],
            temperature=0.1,
            max_tokens=300,
        )
        raw = response.choices[0].message.content.strip()
        # Handle markdown code fences
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
        parsed = json.loads(raw)
        
        keywords = parsed.get("keywords", [])
        embedding_text = parsed.get("embedding_text", raw_query)
        
        if not isinstance(keywords, list) or len(keywords) == 0:
            return _fallback(raw_query)
        
        logger.info(f"[QueryExpand] '{raw_query}' → {len(keywords)} keywords")
        return {"keywords": keywords, "embedding_text": embedding_text}
        
    except Exception as e:
        logger.warning(f"[QueryExpand] LLM expansion failed, using raw query. Error: {e}")
        return _fallback(raw_query)


def _fallback(raw_query: str) -> dict:
    """Fallback: use raw query split by whitespace."""
    return {
        "keywords": raw_query.split(),
        "embedding_text": raw_query,
    }
