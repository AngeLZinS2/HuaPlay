import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
from sqlalchemy import text

def migrate():
    print("Migrating to Pixeldrain...")
    with engine.connect() as conn:
        try:
            # Check if column exists is hard in generic SQL, so just try strict add
            # But SQLite doesn't support IF NOT EXISTS in ADD COLUMN
            # However, we can just try to add it.
            conn.execute(text("ALTER TABLE episodes ADD COLUMN pixeldrain_link VARCHAR"))
            print("Added pixeldrain_link column.")
            conn.commit()
        except Exception as e:
            print(f"Adding pixeldrain_link failed (maybe exists): {e}")

if __name__ == "__main__":
    migrate()
