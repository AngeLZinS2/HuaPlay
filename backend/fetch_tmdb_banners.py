import requests
from bs4 import BeautifulSoup
import sqlite3
import time
import os
import urllib.parse

DB_PATH = os.path.join(os.path.dirname(__file__), "weifansub.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def search_tmdb(title):
    try:
        # 1. Search (TV Shows)
        # Clean title further?
        # Remove "Season 1", etc?
        query = urllib.parse.quote(title)
        search_url = f"https://www.themoviedb.org/search/tv?query={query}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
        
        response = requests.get(search_url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find first result card
        first_result = soup.find(class_="card")
        if not first_result:
             # Try movies?
             search_url = f"https://www.themoviedb.org/search/movie?query={query}"
             response = requests.get(search_url, headers=headers, timeout=10)
             soup = BeautifulSoup(response.content, 'html.parser')
             first_result = soup.find(class_="card")
        
        if not first_result:
            return None, None
            
        # Get Link
        link_tag = first_result.find("a", class_="result") or first_result.find("a")
        if not link_tag:
            return None, None
            
        details_url = "https://www.themoviedb.org" + link_tag.get('href')
        
        # 2. Get Details Page
        time.sleep(0.5) 
        
        resp_details = requests.get(details_url, headers=headers, timeout=10)
        soup_details = BeautifulSoup(resp_details.content, 'html.parser')
        
        # 3. Extract Backdrop
        banner_url = None
        # Try finding 'original' image in page source logic or simple og:image
        # og:image on TMDB often points to Poster or Backdrop depending on page type
        # But we want BACKDROP (Horizontal).
        # TMDB page usually has a section with backdrop.
        
        # Fallback to og:image and force original if it looks like TMDB image
        og_image = soup_details.find("meta", property="og:image")
        if og_image:
            image_url = og_image.get('content')
            if "image.tmdb.org" in image_url:
                banner_url = image_url.replace("/w780/", "/original/").replace("/w500/", "/original/").replace("/w1280/", "/original/")
        
        # 4. Extract Synopsis (Overview)
        description = None
        # Look for div class="overview"
        overview_div = soup_details.find(class_="overview")
        if overview_div:
            # Often inside a <p>
            description = overview_div.get_text(strip=True)
        else:
            # Maybe meta description?
            meta_desc = soup_details.find("meta", attrs={"name": "description"})
            if meta_desc:
                description = meta_desc.get('content')

        return banner_url, description

    except Exception as e:
        print(f"Error searching {title}: {e}")
        return None, None

def main():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get all series
    cursor.execute("SELECT id, title, banner_image, description FROM series")
    series_list = cursor.fetchall()
    
    print(f"Found {len(series_list)} series. Starting TMDB Fetch (Banner + Synopsis)...")
    
    updated_count = 0
    with open("tmdb_fetch_full.log", "w", encoding="utf-8") as f_log:
        for i, series in enumerate(series_list):
            title = series['title']
            clean_title = title.split("–")[0].strip()
            
            f_log.write(f"[{i}] Processing: {clean_title}...\n")
            print(f"[{i}/{len(series_list)}] Searching: {clean_title}...")
            
            new_banner, new_desc = search_tmdb(clean_title)
            
            updates = []
            params = []
            
            if new_banner: # Always update banner to ensure high quality
                updates.append("banner_image = ?")
                params.append(new_banner)
                f_log.write(f"  -> Found Banner: {new_banner}\n")
            
            if new_desc: # Update description
                # Only update if current is empty or short? Or always override?
                # User said "transcrever para a descriçao". Implies override.
                updates.append("description = ?")
                params.append(new_desc)
                f_log.write(f"  -> Found Desc: {new_desc[:30]}...\n")
            
            if updates:
                sql = f"UPDATE series SET {', '.join(updates)} WHERE id = ?"
                params.append(series['id'])
                cursor.execute(sql, tuple(params))
                updated_count += 1
                print(f"  -> Updated.")
            else:
                f_log.write(f"  -> Nothing found.\n")
                print(f"  -> Nothing found.")
                
            if updated_count % 5 == 0:
                conn.commit()

            time.sleep(1.0) 
            
    conn.commit()
    conn.close()
    print(f"Done. Updated {updated_count} series.")

if __name__ == "__main__":
    main()
