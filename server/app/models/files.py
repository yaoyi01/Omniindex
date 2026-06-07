from sqlalchemy import Column, Integer, String, DateTime, Text, BigInteger
from sqlalchemy import JSON
from app.models.base import Base
import datetime


class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, index=True)
    hostname = Column(String)
    ip_address = Column(String, nullable=True)
    alias = Column(String, nullable=True)
    mac_address = Column(String, nullable=True)
    version = Column(String, nullable=True)
    last_heartbeat = Column(DateTime, default=datetime.datetime.utcnow)


class FileIndex(Base):
    __tablename__ = "file_indices"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String, index=True)

    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(BigInteger, nullable=True)

    created_time = Column(DateTime, nullable=True)
    modified_time = Column(DateTime, nullable=True)

    content_summary = Column(Text, nullable=True)

    # Embedding stored as JSON list (384 dims for all-MiniLM-L6-v2 / text-embedding-v3)
    # In Postgres+pgvector mode, this is stored as vector type
    embedding = Column(JSON)


class SystemConfig(Base):
    __tablename__ = "system_configs"

    key = Column(String, primary_key=True)
    value = Column(String)
