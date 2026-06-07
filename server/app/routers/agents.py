from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta

from app.db.session import get_db
from app.models.files import Agent, FileIndex
from app.schemas.agent import AgentHeartbeat, AgentResponse, AgentUpdate, AgentUploadRequest
from app.services.ingestion import process_upload

router = APIRouter()

@router.post("/upload")
def upload_data(data: AgentUploadRequest, db: Session = Depends(get_db)):
    try:
        return process_upload(db, data)
    except Exception as e:
        print(f"Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/heartbeat")
def heartbeat(data: AgentHeartbeat, db: Session = Depends(get_db)):
    try:
        agent = db.query(Agent).filter(Agent.id == data.agent_id).first()
        if not agent:
            # New Agent
            agent = Agent(
                id=data.agent_id,
                hostname=data.hostname,
                ip_address=data.ip_address,
                mac_address=data.mac_address,
                version=data.version
            )
            db.add(agent)
        else:
            # Update existing
            agent.last_heartbeat = datetime.utcnow()
            agent.hostname = data.hostname
            if data.ip_address: agent.ip_address = data.ip_address
            if data.mac_address: agent.mac_address = data.mac_address
            agent.version = data.version
            
        db.commit()
        return {"status": "success", "timestamp": datetime.utcnow()}
    except Exception as e:
        print(f"Heartbeat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list", response_model=List[AgentResponse])
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(Agent).all()
    
    response = []
    # Threshold for "Active" status (e.g. heartbeat within last 5 minutes)
    active_threshold = datetime.utcnow() - timedelta(minutes=70) # Agent sends every hour, so 70 min buffer
    
    for a in agents:
        # Count files (optimized? for now direct count is ok for MVP)
        count = db.query(FileIndex).filter(FileIndex.agent_id == a.id).count()
        
        # Count files with embeddings
        # Note: This might be slow if table is huge. For MVP ok.
        vector_count = db.query(FileIndex).filter(FileIndex.agent_id == a.id, FileIndex.embedding.isnot(None)).count()
        
        is_active = a.last_heartbeat and a.last_heartbeat > active_threshold
        
        response.append(AgentResponse(
            id=a.id,
            hostname=a.hostname,
            alias=a.alias,
            ip_address=a.ip_address,
            mac_address=a.mac_address,
            version=a.version,
            last_heartbeat=a.last_heartbeat,
            file_count=count,
            vector_count=vector_count,
            active=bool(is_active)
        ))
        
    return response

@router.patch("/{agent_id}")
def update_agent(agent_id: str, update: AgentUpdate, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    if update.alias is not None:
        agent.alias = update.alias
        
    db.commit()
    return {"status": "updated"}

@router.delete("/{agent_id}")
def delete_agent_record(agent_id: str, db: Session = Depends(get_db)):
    """
    Delete agent record ONLY, keep data (Orphaned).
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    db.delete(agent)
    db.commit()
    return {"status": "deleted", "mode": "soft_detach"}

@router.delete("/{agent_id}/purge")
def purge_agent_data(agent_id: str, db: Session = Depends(get_db)):
    """
    Delete agent record AND all its files.
    Uses raw SQL for performance (ORM mass-delete is O(n) on SQLite).
    """
    from sqlalchemy import text as sa_text

    # 1. Delete files with raw SQL (instant, bypasses ORM object loading)
    db.execute(sa_text("DELETE FROM file_indices WHERE agent_id = :aid"), {"aid": agent_id})

    # 2. Delete agent
    db.execute(sa_text("DELETE FROM agents WHERE id = :aid"), {"aid": agent_id})

    db.commit()
    return {"status": "purged", "agent_id": agent_id}
