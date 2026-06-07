from server.app.db.session import engine
from sqlalchemy import text

def clear_data():
    print("Clearing all file records from database...")
    try:
        with engine.connect() as connection:
            # Truncate is faster and cleaner for clearing everything
            connection.execute(text("TRUNCATE TABLE file_indices CASCADE"))
            connection.commit()
        print("Database cleared successfully.")
    except Exception as e:
        print(f"Error clearing database: {e}")

if __name__ == "__main__":
    clear_data()
