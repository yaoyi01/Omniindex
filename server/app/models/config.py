from sqlalchemy import Column, Integer, String
from app.models.base import Base


class SystemConfig(Base):
    __tablename__ = "system_config"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
