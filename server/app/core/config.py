from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os
from pathlib import Path

# Load .env file explicitly (uvicorn doesn't auto-load it)
_env_path = Path(__file__).resolve().parent.parent / ".env"  # server/.env
if _env_path.exists():
    load_dotenv(_env_path)
elif (_env_path.parent.parent / ".env").exists():
    load_dotenv(_env_path.parent.parent / ".env")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Terminal Index Manager"
    API_V1_STR: str = "/api/v1"

    # Database mode: "sqlite" (default, uses existing search_agent.db) or "postgres"
    DB_MODE: str = os.getenv("DB_MODE", "sqlite")

    # SQLite (default)
    SQLITE_PATH: str = os.getenv("SQLITE_PATH", "")

    # PostgreSQL (when DB_MODE=postgres)
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "admin")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "securepassword")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "terminal_index_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")

    # DashScope API for embedding (replaces local sentence-transformers)
    DASHSCOPE_API_KEY: str = os.getenv("DASHSCOPE_API_KEY", "")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-v3")

    # DeepSeek API for query expansion (LLM preprocessing)
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    DEEPSEEK_MODEL: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

    # Agent config defaults
    DEFAULT_COLLECTION_LIMIT: int = 0  # 0 = unlimited
    DEFAULT_INTERVAL_SECONDS: int = 3600

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DB_MODE == "postgres":
            return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        # SQLite mode — use existing DB file
        db_path = self.SQLITE_PATH
        if not db_path:
            # The search_agent.db is at project root (parent of server/)
            # __file__ is /path/to/server/app/core/config.py
            # We go up 3 levels to reach project root
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            db_path = os.path.join(base_dir, "search_agent.db")
        return f"sqlite:///{db_path}"

settings = Settings()
