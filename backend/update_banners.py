import requests
from bs4 import BeautifulSoup
import sqlite3
import time
import os
import re

DB_PATH = os.path.join(os.path.dirname(__file__), "weifansub.db")
Index_URL = "https://weifansub.com.br/c-dramas-concluidos/"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

BLACKLIST = [
    "emoji", "avatar", "svg", "base64", 
    "LINHA", "espaco", "CAPABLOG", 
    "placehold", "blank", "spacer",
    "pixel", "cleardot"
]

def is_valid_image(url):
    if not url: return False
    if url.startswith("data:"): return False
    for word in BLACKLIST:
        if word.lower() in url.lower():
            return False
    return True

def scrape_page(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # 1. Get Title from H1 (or Title tag)
        title_text = ""
        h1 = soup.find("h1")
        if h1:
            title_text = h1.get_text(strip=True)
        else:
            t = soup.find("title")
            if t:
                title_text = t.get_text(strip=True).replace(" – Wei Fansub", "")
        
        # Clean title
        title_text = title_text.strip()
        
        # 2. Scrape Banner
        banner_url = None
        
        # Strategy: Find container with "EPISÓDIO"
        episode_text = soup.find(string=lambda t: t and "EPISÓDIO" in t)
        content = None
        if episode_text:
             content = episode_text.find_parent("div")
        
        if not content:
            content = soup.find(class_="post-content") or soup.find(class_="entry-content")

        if content:
             imgs = content.find_all("img")
             for img in imgs:
                 src = img.get('data-src') or img.get('data-lazy-src') or img.get('src')
                 if is_valid_image(src):
                     banner_url = src
                     break # Take first valid
        
        # Fallback: IMG 0 of post-content?
        if not banner_url and content:
            # Maybe lazy loading attributes are tricky
            pass
            
        return title_text, banner_url
        
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None, None

def main():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("1. Scraping Index Page...")
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(Index_URL, headers=headers)
    soup = BeautifulSoup(response.content, 'html.parser')
    
    list_container = soup.find(class_="post-content") or soup.find(class_="page-content") or soup.find(class_="entry-content")
    
    if not list_container:
        print("Could not find list container.")
        return

    links = list_container.find_all("a")
    print(f"Found {len(links)} links. Processing...")
    
    updated_count = 0
    
    with open("deep_scrape.log", "w", encoding="utf-8") as f_log:
        for i, link in enumerate(links):
            url = link.get('href')
            if not url or "weifansub.com.br" not in url or "share" in url: continue
            if "weifansub.com.br" == url or url.endswith(".br/"): continue

            # Deep Scrape
            scraped_title, banner = scrape_page(url)
            
            if not scraped_title:
                f_log.write(f"[{i}] Failed to get title for {url}\n")
                continue
                
            f_log.write(f"[{i}] Scraped: '{scraped_title}' | Banner: {banner}\n")
            
            # Match DB
            # DB Title should match Scraped Title
            cursor.execute("SELECT id, banner_image FROM series WHERE title = ?", (scraped_title,))
            row = cursor.fetchone()
            
            if not row:
                 # Try LIKE
                 cursor.execute("SELECT id, banner_image FROM series WHERE title LIKE ?", (f"%{scraped_title}%",))
                 row = cursor.fetchone()
            
            if row:
                f_log.write(f"  -> MATCHED ID: {row['id']}\n")
                if banner and banner != row['banner_image']:
                    cursor.execute("UPDATE series SET banner_image = ? WHERE id = ?", (banner, row['id']))
                    updated_count += 1
                    f_log.write(f"  -> UPDATED Banner.\n")
                    print(f"Updated: {scraped_title}")
            else:
                f_log.write(f"  -> NO MATCH in DB.\n")
            
            if updated_count > 0 and updated_count % 10 == 0:
                conn.commit()
            
            time.sleep(0.1)
        
    conn.commit()
    conn.close()
    print(f"Done. Updated {updated_count} series.")

if __name__ == "__main__":
    main()
