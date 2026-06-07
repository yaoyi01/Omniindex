"""
Migrate data from SQLite search_agent.db to PostgreSQL terminal_index_db
Usage: python3 migrate_sqlite_to_pg.py
"""
import sqlite3
import psycopg2
import json
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger("migrate")

# SQLite connection
sqlite_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "search_agent.db")

logger.info(f"SQLite DB: {sqlite_path}")
sqlite_conn = sqlite3.connect(sqlite_path)
sqlite_conn.row_factory = sqlite3.Row

# PostgreSQL connection
pg_conn = psycopg2.connect(
    host="127.0.0.1",
    port=5432,
    user="admin",
    password="securepassword",
    dbname="terminal_index_db"
)
pg_conn.autocommit = False
pg_cur = pg_conn.cursor()

# Create tables in PostgreSQL
logger.info("Creating PostgreSQL tables with pgvector...")
pg_cur.execute("""
    CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR PRIMARY KEY,
        hostname VARCHAR,
        ip_address VARCHAR,
        alias VARCHAR,
        mac_address VARCHAR,
        version VARCHAR,
        last_heartbeat TIMESTAMP
    )
""")

pg_cur.execute("""
    CREATE TABLE IF NOT EXISTS file_indices (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR,
        file_name VARCHAR NOT NULL,
        file_path VARCHAR NOT NULL,
        file_size BIGINT,
        created_time TIMESTAMP,
        modified_time TIMESTAMP,
        content_summary TEXT,
        embedding vector(1024),
        UNIQUE(agent_id, file_path)
    )
""")

pg_cur.execute("""
    CREATE TABLE IF NOT EXISTS system_configs (
        key VARCHAR PRIMARY KEY,
        value VARCHAR
    )
""")

# Create indexes
pg_cur.execute("CREATE INDEX IF NOT EXISTS idx_file_indices_agent_id ON file_indices(agent_id);")
pg_cur.execute("CREATE INDEX IF NOT EXISTS idx_file_indices_embedding ON file_indices USING hnsw (embedding vector_cosine_ops);")

pg_conn.commit()
logger.info("Tables created.")

# Migrate agents
logger.info("Migrating agents...")
rows = sqlite_conn.execute("SELECT * FROM agents").fetchall()
logger.info(f"  Agents: {len(rows)} to migrate")
migrated_agents = 0
for r in rows:
    try:
        pg_cur.execute(
            "INSERT INTO agents (id, hostname, ip_address, alias, mac_address, version, last_heartbeat) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (id) DO NOTHING",
            (r["id"], r["hostname"], r["ip_address"], r["alias"], r["mac_address"], r["version"], r["last_heartbeat"])
        )
        migrated_agents += 1
    except Exception as e:
        logger.error(f"  Agent {r['id']} failed: {e}")
pg_conn.commit()
logger.info(f"  Migrated {migrated_agents} agents")

# Migrate system_configs
logger.info("Migrating system configs...")
rows = sqlite_conn.execute("SELECT * FROM system_configs").fetchall()
for r in rows:
    try:
        pg_cur.execute(
            "INSERT INTO system_configs (key, value) VALUES (%s, %s) ON CONFLICT (key) DO NOTHING",
            (r["key"], r["value"])
        )
    except Exception as e:
        logger.error(f"  Config {r['key']} failed: {e}")
pg_conn.commit()

# Migrate file_indices with embedding conversion
logger.info("Migrating file_indices (this may take a while)...")
total = sqlite_conn.execute("SELECT COUNT(*) FROM file_indices").fetchone()[0]
logger.info(f"  Total files: {total}")

BATCH_SIZE = 500
offset = 0
migrated = 0
errors = 0

while offset < total:
    rows = sqlite_conn.execute(
        "SELECT * FROM file_indices ORDER BY id LIMIT ? OFFSET ?",
        (BATCH_SIZE, offset)
    ).fetchall()

    for r in rows:
        try:
            embedding = None
            if r["embedding"] is not None:
                emb_list = json.loads(r["embedding"])
                # Convert 384d embedding to 1024d by padding with zeros
                if len(emb_list) == 384:
                    emb_list = emb_list + [0.0] * (1024 - 384)
                embedding = json.dumps(emb_list)

            pg_cur.execute(
                """INSERT INTO file_indices
                    (agent_id, file_name, file_path, file_size, modified_time, content_summary, embedding)
                   VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                   ON CONFLICT (agent_id, file_path) DO UPDATE SET
                       file_name = EXCLUDED.file_name,
                       file_size = EXCLUDED.file_size,
                       modified_time = EXCLUDED.modified_time,
                       content_summary = EXCLUDED.content_summary,
                       embedding = EXCLUDED.embedding""",
                (
                    r["agent_id"],
                    r["file_name"],
                    r["file_path"],
                    r["file_size"],
                    r["modified_time"] if r["modified_time"] else None,
                    r["content_summary"],
                    embedding
                )
            )
            migrated += 1
        except Exception as e:
            errors += 1
            if errors <= 3:
                logger.error(f"  File {r['id']} ({r['file_name']}): {e}")

    pg_conn.commit()
    offset += BATCH_SIZE
    if offset % 5000 == 0 or offset >= total:
        logger.info(f"  Progress: {offset}/{total} ({migrated} migrated, {errors} errors)")

logger.info(f"Migration complete: {migrated} files migrated, {errors} errors")

sqlite_conn.close()
pg_cur.close()
pg_conn.close()
logger.info("Done.")
