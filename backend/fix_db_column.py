import sqlite3
import os

DB_PATH = 'backend/weifansub.db'

def fix_db():
    if not os.path.exists(DB_PATH):
        # Try relative path
        DB_PATH_REL = 'weifansub.db'
        if os.path.exists(DB_PATH_REL):
            db_path = DB_PATH_REL
        else:
            print(f"Database not found at {DB_PATH}")
            # Try absolute path based on cwd
            db_path = os.path.join(os.getcwd(), 'backend', 'weifansub.db')
            if not os.path.exists(db_path):
                 db_path = os.path.join(os.getcwd(), 'weifansub.db')
                 if not os.path.exists(db_path):
                      print("Cannot find weifansub.db")
                      return
    else:
        db_path = DB_PATH

    print(f"Opening database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check columns in episodes table
    cursor.execute("PRAGMA table_info(episodes)")
    columns = [info[1] for info in cursor.fetchall()]
    print(f"Current columns in episodes: {columns}")
    
    if 'pixeldrain_link' not in columns:
        print("pixeldrain_link missing. Adding...")
        try:
            cursor.execute("ALTER TABLE episodes ADD COLUMN pixeldrain_link VARCHAR")
            conn.commit()
            print("Successfully added pixeldrain_link.")
        except Exception as e:
            print(f"Error adding column: {e}")
    else:
        print("pixeldrain_link already exists.")

    conn.close()

if __name__ == "__main__":
    fix_db()
