import sqlite3

def add_column():
    conn = sqlite3.connect('weifansub.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE episodes ADD COLUMN pixeldrain_id VARCHAR")
        conn.commit()
        print("Column 'pixeldrain_id' added successfully.")
    except sqlite3.OperationalError as e:
        print(f"Error: {e}")
        # Likely the column already exists
    
    conn.close()

if __name__ == "__main__":
    add_column()
