import os
import sqlite3
import requests
from bs4 import BeautifulSoup
from datetime import datetime

# DB_PATH setup
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weifansub.db")
if not os.path.exists(DB_PATH):
    # Try parent
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "weifansub.db")

print(f"DEBUG: Using DB at {DB_PATH}")

def get_soup(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers)
        return BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def test_import():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Test inserting a dummy series to verify DB and table
        print("Testing DB connection and table...")
        try:
            cursor.execute("SELECT count(*) FROM series")
            print(f"Series count: {cursor.fetchone()[0]}")
        except Exception as e:
            print(f"DB Error (SELECT): {e}")
            return

        # Scrape 1 item
        url = "https://weifansub.com.br/2019/07/14/go-go-squid/"
        print(f"Scraping {url}...")
        soup = get_soup(url)
        
        # Extract title
        title = soup.find('h1', class_='post-title').get_text().strip()
        print(f"Title: {title}")
        
        # Try Insert
        print("Attempting insert...")
        cursor.execute("INSERT INTO series (title, type, created_at) VALUES (?, ?, ?)", (title, 'Drama', datetime.utcnow()))
        print("Insert successful (in memory).")
        conn.rollback() 
        print("Rollback successful.")
        conn.close()
        
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_import()
