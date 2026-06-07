from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class FileMetadata(BaseModel):
    name: str
    path: str
    summary: Optional[str] = None
    size: Optional[int] = None
    date_modified: Optional[str] = None

class AgentUploadRequest(BaseModel):
    agent_id: str
    hostname: str
    files: List[FileMetadata]

class AgentHeartbeat(BaseModel):
    agent_id: str
    hostname: str
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    version: str = "1.0.0"

class AgentUpdate(BaseModel):
    alias: Optional[str] = None

class AgentResponse(BaseModel):
    id: str
    hostname: str
    alias: Optional[str] = None
    ip_address: Optional[str] = None
    version: Optional[str] = None
    mac_address: Optional[str] = None
    last_heartbeat: Optional[datetime] = None
    file_count: int = 0
    vector_count: int = 0
    active: bool = False

    model_config = {"from_attributes": True}
