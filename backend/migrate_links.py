import sqlite3

def migrate():
    print("Migrating database to add new link columns...")
    conn = sqlite3.connect('weifansub.db')
    cursor = conn.cursor()
    
    columns = [
        'drive_link',
        'mega_link',
        'mediafire_link',
        'telegram_link'
    ]
    
    for col in columns:
        try:
            cursor.execute(f"ALTER TABLE series ADD COLUMN {col} TEXT")
            print(f"Added column: {col}")
        except sqlite3.OperationalError:
            print(f"Column {col} already exists.")
            
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
