from database import engine
from sqlalchemy import text

def add_gender_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE actors ADD COLUMN gender VARCHAR DEFAULT 'Female'"))
            conn.commit()
            print("Successfully added 'gender' column to 'actors' table.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    add_gender_column()
