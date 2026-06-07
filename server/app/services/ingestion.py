from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.files import Agent, FileIndex
from app.schemas.agent import AgentUploadRequest
from app.core.config import settings
import datetime
import json
import logging
import numpy as np
from typing import Optional

logger = logging.getLogger("ingestion")

# Embedding cache for this process
_embedding_cache = {}


def _call_dashscope_embed(texts: list[str]) -> Optional[list[list[float]]]:
    """Call DashScope text-embedding-v3 API to get embeddings."""
    if not settings.DASHSCOPE_API_KEY:
        logger.warning("DASHSCOPE_API_KEY not configured, skipping vectorization")
        return None

    try:
        import dashscope
        dashscope.api_key = settings.DASHSCOPE_API_KEY

        resp = dashscope.TextEmbedding.call(
            model=settings.EMBEDDING_MODEL,
            input=texts,
        )
        if resp.status_code != 200:
            logger.error(f"DashScope API error: {resp.status_code} {resp.message}")
            return None

        embeddings = [item["embedding"] for item in resp.output["embeddings"]]
        return embeddings
    except Exception as e:
        logger.error(f"DashScope embedding call failed: {e}")
        return None


def get_model():
    """Compatibility stub — returns None, embedding now uses API."""
    return None


def embed_text(text: str) -> Optional[list[float]]:
    """Embed a single text string using DashScope API."""
    # Check cache first
    cache_key = text[:200]  # Truncate cache key
    if cache_key in _embedding_cache:
        return _embedding_cache[cache_key]

    result = _call_dashscope_embed([text])
    if result and len(result) > 0:
        _embedding_cache[cache_key] = result[0]
        return result[0]
    return None


def batch_embed_texts(texts: list[str]) -> list[Optional[list[float]]]:
    """Batch embed texts. Returns None for items that failed."""
    if not texts:
        return []

    # Check cache first
    uncached = []
    uncached_indices = []
    results = [None] * len(texts)

    for i, t in enumerate(texts):
        cache_key = t[:200]
        if cache_key in _embedding_cache:
            results[i] = _embedding_cache[cache_key]
        else:
            uncached.append(t)
            uncached_indices.append(i)

    if uncached:
        # DashScope limits batch to 10 texts per call
        DASHSCOPE_BATCH_SIZE = 10
        for b_start in range(0, len(uncached), DASHSCOPE_BATCH_SIZE):
            b_end = min(b_start + DASHSCOPE_BATCH_SIZE, len(uncached))
            b_texts = uncached[b_start:b_end]
            b_indices = uncached_indices[b_start:b_end]
            batch_result = _call_dashscope_embed(b_texts)
            if batch_result:
                for idx, emb in zip(b_indices, batch_result):
                    cache_key = texts[idx][:200]
                    _embedding_cache[cache_key] = emb
                    results[idx] = emb
            else:
                logger.warning(f"Batch embedding failed for {len(b_texts)} items")

    return results


def process_upload(db: Session, data: AgentUploadRequest):
    # 1. Update/Create Agent
    agent = db.query(Agent).filter(Agent.id == data.agent_id).first()
    if not agent:
        agent = Agent(id=data.agent_id, hostname=data.hostname)
        db.add(agent)
    agent.last_heartbeat = datetime.datetime.utcnow()
    db.commit()

    # 2. Process Files
    texts_to_vectorize = []
    file_meta_list = []

    for file in data.files:
        text_content = file.summary if file.summary else file.name
        texts_to_vectorize.append(text_content)
        file_meta_list.append(file)

    if not texts_to_vectorize:
        return {"processed": 0, "updated": 0, "inserted": 0}

    # Generate embeddings via API
    logger.info(f"Vectorizing {len(texts_to_vectorize)} items...")
    embeddings = batch_embed_texts(texts_to_vectorize)

    # Batch upsert
    rows = []
    for i, file_data in enumerate(file_meta_list):
        mod_time = None
        try:
            if file_data.date_modified:
                dt_obj = datetime.datetime.fromisoformat(file_data.date_modified)
                mod_time = dt_obj.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        except:
            pass

        embedding_json = None
        if embeddings and i < len(embeddings) and embeddings[i] is not None:
            embedding_json = json.dumps(embeddings[i])

        rows.append({
            "agent_id": data.agent_id,
            "file_name": file_data.name,
            "file_path": file_data.path,
            "file_size": file_data.size,
            "modified_time": str(mod_time) if mod_time else None,
            "content_summary": file_data.summary or file_data.name,
            "embedding": embedding_json,
        })

    try:
        db.execute(
            text("""
                INSERT INTO file_indices
                    (agent_id, file_name, file_path, file_size, modified_time, content_summary, embedding)
                VALUES
                    (:agent_id, :file_name, :file_path, :file_size, :modified_time, :content_summary, :embedding)
                ON CONFLICT(agent_id, file_path) DO UPDATE SET
                    file_name       = excluded.file_name,
                    file_size       = excluded.file_size,
                    modified_time   = excluded.modified_time,
                    content_summary = excluded.content_summary,
                    embedding       = excluded.embedding
            """),
            rows
        )
        db.commit()
        logger.info(f"Batch upserted {len(rows)} files for agent {data.agent_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Batch upsert failed: {e}")
        # Fallback: insert one by one
        for row in rows:
            try:
                existing = db.query(FileIndex).filter(
                    FileIndex.agent_id == row["agent_id"],
                    FileIndex.file_path == row["file_path"]
                ).first()
                if existing:
                    existing.file_name = row["file_name"]
                    existing.file_size = row["file_size"]
                    existing.modified_time = datetime.datetime.fromisoformat(row["modified_time"]) if row["modified_time"] else None
                    existing.content_summary = row["content_summary"]
                    if row["embedding"]:
                        existing.embedding = json.loads(row["embedding"])
                else:
                    new_file = FileIndex(
                        agent_id=row["agent_id"],
                        file_name=row["file_name"],
                        file_path=row["file_path"],
                        file_size=row["file_size"],
                        modified_time=datetime.datetime.fromisoformat(row["modified_time"]) if row["modified_time"] else None,
                        content_summary=row["content_summary"],
                        embedding=json.loads(row["embedding"]) if row["embedding"] else None,
                    )
                    db.add(new_file)
                db.commit()
            except Exception as e2:
                db.rollback()
                logger.error(f"Single insert failed for {row['file_path']}: {e2}")

    return {"processed": len(rows), "inserted": len(rows), "updated": 0}
