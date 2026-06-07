from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, Body
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta

# Note: Running from project root (parent of server/), sys.path is set in main.py itself
import sys
import os
# Add project root to sys.path so 'from app...' imports work
_project_root = os.path.dirname(os.path.abspath(__file__))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from app.core.config import settings
from app.db.session import engine, get_db
from app.models.base import Base
from app.models.files import Agent, FileIndex, SystemConfig
from app.schemas.agent import AgentUploadRequest
from app.services.ingestion import process_upload, get_model
from app.routers import agents
from typing import List

import logging
import numpy as np
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

# CORS — must be before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router, prefix="/api/v1/agent", tags=["Agents"])


class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    agent_id: str = None


@app.get("/")
def read_root():
    return {"status": "active", "version": "0.3.0 (WSL)", "db_mode": settings.DB_MODE}


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected", "db_mode": settings.DB_MODE}
    except Exception as e:
        logger.error(f"DB Connection failed: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")


@app.get("/api/v1/files/recent")
def get_recent_files(limit: int = 50, agent_id: str = None, search: str = None, db: Session = Depends(get_db)):
    try:
        query = db.query(FileIndex)

        if agent_id:
            query = query.filter(FileIndex.agent_id == agent_id)

        if search:
            term = f"%{search}%"
            query = query.filter(
                (FileIndex.file_name.ilike(term)) |
                (FileIndex.file_path.ilike(term))
            )

        files = query.order_by(FileIndex.id.desc()).limit(limit).all()

        response = []
        for f in files:
            response.append({
                "id": f.id,
                "file_name": f.file_name,
                "file_path": f.file_path,
                "summary": f.content_summary,
                "file_size": f.file_size,
                "agent_id": f.agent_id,
                "modified": f.modified_time.isoformat() if f.modified_time else None,
                "has_embedding": f.embedding is not None,
            })
        return {"status": "success", "files": response}
    except Exception as e:
        logger.error(f"Fetch recent files failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/search/semantic")
def search_semantic(request: SearchRequest, db: Session = Depends(get_db)):
    try:
        import time as _time
        t0 = _time.time()

        # 0. LLM Query Expansion
        from app.services.query_expander import expand_query
        expanded = expand_query(request.query)
        expanded_keywords = expanded.get("keywords", [request.query])
        embedding_query = expanded.get("embedding_text", request.query)

        logger.info(f"[Search] '{request.query}' expanded → {expanded_keywords[:5]}... ({_time.time()-t0:.2f}s)")

        results_map = {}

        # 1. Keyword Search (split multi-word queries, OR matching)
        terms = expanded_keywords
        from sqlalchemy import or_
        kw_conditions = []
        for term in terms:
            kw_conditions.append(FileIndex.file_name.ilike(f"%{term}%"))
            kw_conditions.append(FileIndex.content_summary.ilike(f"%{term}%"))
        kw_query = db.query(FileIndex).filter(or_(*kw_conditions))
        if request.agent_id:
            kw_query = kw_query.filter(FileIndex.agent_id == request.agent_id)

        keyword_matches = kw_query.limit(request.limit).all()
        for r in keyword_matches:
            results_map[r.id] = (r, 1.0)

        # 2. Semantic Search (fill remaining slots)
        if len(results_map) < request.limit:
            from app.services.ingestion import embed_text

            query_embedding = embed_text(embedding_query)
            if query_embedding is not None:
                query_vector = np.array(query_embedding, dtype=np.float32)
                query_norm = np.linalg.norm(query_vector)
                if query_norm == 0:
                    query_norm = 1e-9
                q_normalized = query_vector / query_norm

                if settings.DB_MODE == "postgres":
                    # PostgreSQL + pgvector: use native <=> cosine distance
                    # pgvector cosine distance = 1 - cosine_similarity
                    # We convert to vector literal for the query
                    vec_str = "[" + ",".join(f"{x:.8f}" for x in q_normalized.tolist()) + "]"
                    # Use raw SQL for pgvector operator
                    from sqlalchemy import text as sa_text
                    sql = sa_text("""
                        SELECT id, agent_id, file_name, file_path, file_size,
                               modified_time, content_summary,
                               1 - (embedding <=> :vec::vector) AS cosine_score
                        FROM file_indices
                        WHERE embedding IS NOT NULL
                        {agent_filter}
                        AND (1 - (embedding <=> :vec::vector)) >= 0.3
                        ORDER BY embedding <=> :vec::vector
                        LIMIT :lim
                    """.format(
                        agent_filter="AND agent_id = :agent_id" if request.agent_id else ""
                    ))
                    params = {"vec": vec_str, "lim": request.limit - len(results_map)}
                    if request.agent_id:
                        params["agent_id"] = request.agent_id

                    vector_results = db.execute(sql, params).fetchall()
                    for row in vector_results:
                        # Skip if already in keyword results
                        if row[0] in results_map:
                            continue
                        # Build a FileIndex-like object
                        from collections import namedtuple
                        FileRow = namedtuple("FileRow",
                            ["id", "agent_id", "file_name", "file_path", "file_size",
                             "modified_time", "content_summary", "embedding"])
                        file_obj = FileRow(
                            id=row[0], agent_id=row[1], file_name=row[2],
                            file_path=row[3], file_size=row[4],
                            modified_time=row[5], content_summary=row[6],
                            embedding=None
                        )
                        score = float(row[7])
                        if score > 0:
                            results_map[file_obj.id] = (file_obj, score)

                else:
                    # SQLite mode: in-memory cosine similarity
                    MAX_CANDIDATES = 5000
                    sem_query = db.query(FileIndex).filter(FileIndex.embedding.isnot(None))
                    if request.agent_id:
                        sem_query = sem_query.filter(FileIndex.agent_id == request.agent_id)

                    total_with_emb = sem_query.count()
                    if total_with_emb <= MAX_CANDIDATES:
                        candidates = sem_query.all()
                    else:
                        # Fast sampling: just take first MAX_CANDIDATES by id
                        # (ORDER BY RANDOM() is too slow on 167K+ rows)
                        candidates = sem_query.order_by(FileIndex.id).limit(MAX_CANDIDATES).all()

                    scored_candidates = []
                    for c in candidates:
                        if c.id in results_map:
                            continue
                        try:
                            emb = np.array(c.embedding, dtype=np.float32)
                            emb_norm = np.linalg.norm(emb)
                            if emb_norm == 0:
                                continue
                            e_normalized = emb / emb_norm
                            cosine_sim = float(np.dot(q_normalized, e_normalized))
                            score = max(0.0, cosine_sim)
                            if score >= 0.3:
                                scored_candidates.append((c, score))
                        except Exception:
                            continue

                    scored_candidates.sort(key=lambda x: x[1], reverse=True)
                    for c, score in scored_candidates:
                        if len(results_map) >= request.limit:
                            break
                        results_map[c.id] = (c, score)

        # Format response
        response = []
        sorted_results = sorted(results_map.values(), key=lambda x: x[1], reverse=True)

        for r, score in sorted_results:
            response.append({
                "id": r.id,
                "file_name": r.file_name,
                "file_path": r.file_path,
                "summary": r.content_summary,
                "file_size": r.file_size,
                "agent_id": r.agent_id,
                "modified": r.modified_time.isoformat() if r.modified_time else None,
                "score": round(score, 4),
            })

        return {"status": "success", "results": response}

    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/stats")
def get_stats(db: Session = Depends(get_db)):
    total_agents = db.query(Agent).count()
    active_threshold = datetime.utcnow() - timedelta(minutes=70)
    active_agents = db.query(Agent).filter(Agent.last_heartbeat > active_threshold).count()
    file_count = db.query(FileIndex).count()
    vector_count = db.query(FileIndex).filter(FileIndex.embedding.isnot(None)).count()

    return {
        "total_agents": total_agents,
        "active_agents": active_agents,
        "files": file_count,
        "vectors": vector_count,
        "db_mode": settings.DB_MODE,
    }


class ConfigUpdate(BaseModel):
    collection_limit: int
    interval_seconds: int
    allowed_extensions: List[str] = []


@app.get("/api/v1/config")
def get_config(db: Session = Depends(get_db)):
    defaults = {"collection_limit": "0", "interval_seconds": "3600", "allowed_extensions": "[]"}
    configs = db.query(SystemConfig).all()
    current_config = {c.key: c.value for c in configs}
    final_config = {**defaults, **current_config}
    return {
        "collection_limit": int(final_config["collection_limit"]),
        "interval_seconds": int(final_config["interval_seconds"]),
        "allowed_extensions": json.loads(final_config["allowed_extensions"]),
    }


@app.post("/api/v1/config")
def update_config(config: ConfigUpdate, db: Session = Depends(get_db)):
    try:
        def upsert(key, value):
            obj = db.query(SystemConfig).filter(SystemConfig.key == key).first()
            if not obj:
                obj = SystemConfig(key=key, value=str(value))
                db.add(obj)
            else:
                obj.value = str(value)

        upsert("collection_limit", config.collection_limit)
        upsert("interval_seconds", config.interval_seconds)
        upsert("allowed_extensions", json.dumps(config.allowed_extensions))
        db.commit()
        return {"status": "success", "config": config}
    except Exception as e:
        logger.error(f"Config update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
