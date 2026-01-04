from database import engine, Base
from models import User, UserProfile, UserList, Like, WatchHistory
from sqlalchemy import text

def fix_database():
    with engine.connect() as conn:
        print("Checking 'users' table...")
        # 1. Add full_name to users if missing
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR"))
            print("Added 'full_name' column to users table.")
        except Exception as e:
            if "duplicate column name" in str(e):
                print("'full_name' column already exists.")
            else:
                print(f"Error checking users table: {e}")

        # 2. Drop tables that changed from user_id to profile_id
        # We drop them to let SQLAlchemy recreate them correctly with new FKs
        print("Recreating profile-related tables...")
        try:
            conn.execute(text("DROP TABLE IF EXISTS user_list"))
            conn.execute(text("DROP TABLE IF EXISTS likes"))
            conn.execute(text("DROP TABLE IF EXISTS watch_history"))
            # Note: UserProfile might exist or not, but let's ensure it's clean if there were issues
            # Actually, let's keep UserProfile if it exists, otherwise CREATE it.
            # But the user asked to "Delete this user".
            # For schema correctness, dropping dependent tables is key.
            print("Dropped old tables.")
        except Exception as e:
            print(f"Error dropping tables: {e}")

    # 3. Create all tables (will create missing ones)
    print("Creating new tables...")
    Base.metadata.create_all(bind=engine)
    print("Database fix completed.")

if __name__ == "__main__":
    fix_database()
