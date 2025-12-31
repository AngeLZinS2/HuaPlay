import sqlite3
import os

DB_PATH = "weifansub.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    columns = [
        ("drive_link", "TEXT"),
        ("mega_link", "TEXT"),
        ("mediafire_link", "TEXT"),
        ("telegram_link", "TEXT")
    ]

    print("Migrating 'episodes' table...")
    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE episodes ADD COLUMN {col_name} {col_type}")
            print(f"  Added column: {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"  Column {col_name} already exists.")
            else:
                print(f"  Error adding {col_name}: {e}")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
