from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as connection:
        try:
            # Check if column exists
            result = connection.execute(text("PRAGMA table_info(series)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'is_featured' not in columns:
                print("Adding is_featured column to series table...")
                connection.execute(text("ALTER TABLE series ADD COLUMN is_featured BOOLEAN DEFAULT 0"))
                connection.commit()
                print("Migration successful!")
            else:
                print("Column is_featured already exists.")
                
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
