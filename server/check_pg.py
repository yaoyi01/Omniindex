"""
Generate vector embeddings for files that have embeddings stored as JSON.
Used after migration from SQLite when using PostgreSQL + pgvector mode.
"""
import psycopg2
import json
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger("vector_fix")

PG_DSN = os.getenv("PG_DSN", "host=127.0.0.1 port=5432 user=admin password=securepassword dbname=terminal_index_db")

conn = psycopg2.connect(PG_DSN)
conn.autocommit = False
cur = conn.cursor()

# Check how many files have null embedding
cur.execute("SELECT COUNT(*) FROM file_indices WHERE embedding IS NULL")
null_count = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM file_indices")
total = cur.fetchone()[0]
logger.info(f"Total: {total}, Null embeddings: {null_count}")

# Try to fix version column issue
# Check schema
cur.execute("""
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'file_indices' ORDER BY ordinal_position
""")
for row in cur.fetchall():
    logger.info(f"  {row[0]}: {row[1]}")

conn.close()
logger.info("Done.")
