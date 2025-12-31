import sqlite3

def verify():
    conn = sqlite3.connect('weifansub.db')
    cursor = conn.cursor()
    
    # Check for items with any link
    cursor.execute("""
        SELECT title, description, drive_link, mega_link, telegram_link 
        FROM series 
        WHERE drive_link IS NOT NULL 
           OR mega_link IS NOT NULL 
           OR telegram_link IS NOT NULL
        LIMIT 5
    """)
    rows = cursor.fetchall()
    
    print(f"Found {len(rows)} dramas with links.")
    for row in rows:
        print(f"Title: {row[0]}")
        print(f"Description: {row[1][:50] if row[1] else 'None'}...")
        print(f"Drive: {row[2]}")
        print(f"Mega: {row[3]}")
        print(f"Telegram: {row[4]}")
        print("-" * 20)
        
    conn.close()

if __name__ == "__main__":
    verify()
