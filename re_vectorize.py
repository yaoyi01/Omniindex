"""
Re-vectorize all files without embeddings using DashScope API.
Usage: DASHSCOPE_API_KEY=sk-xxx python3 re_vectorize.py
"""
import sqlite3, json, sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))
from app.services.ingestion import batch_embed_texts
from app.core.config import settings

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'search_agent.db')

def main():
    if not settings.DASHSCOPE_API_KEY:
        print("❌ DASHSCOPE_API_KEY not set. Export it or set in server/.env")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    
    # Find files without embeddings
    cur = conn.execute("SELECT id, content_summary FROM file_indices WHERE embedding IS NULL")
    rows = cur.fetchall()
    total = len(rows)
    
    if total == 0:
        print("✅ All files already have embeddings")
        conn.close()
        return
    
    print(f"Found {total} files without embeddings. Re-vectorizing in batches of 25...")
    
    batch_size = 25
    for i in range(0, total, batch_size):
        batch = rows[i:i + batch_size]
        texts = [r[1] or "" for r in batch]
        ids = [r[0] for r in batch]
        
        embeddings = batch_embed_texts(texts)
        
        for j, emb in enumerate(embeddings):
            if emb is not None:
                conn.execute(
                    "UPDATE file_indices SET embedding = ? WHERE id = ?",
                    (json.dumps(emb), ids[j])
                )
        
        conn.commit()
        done = min(i + batch_size, total)
        print(f"  Progress: {done}/{total} ({done*100//total}%)")
    
    conn.close()
    print(f"✅ Done! {total} files re-vectorized.")

if __name__ == "__main__":
    main()
