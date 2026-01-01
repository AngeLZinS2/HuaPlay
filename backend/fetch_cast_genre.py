import requests
from bs4 import BeautifulSoup
import sqlite3
import time
import os
import urllib.parse
import sys
import re

# Connect to the database
DB_PATH = os.path.join(os.path.dirname(__file__), "weifansub.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def search_tmdb_metadata(title):
    try:
        # Headers to look like a real browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
        
        # 1. Search for the series
        query = urllib.parse.quote(title)
        search_url = f"https://www.themoviedb.org/search/tv?query={query}"
        
        response = requests.get(search_url, headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"  [!] Search failed: {response.status_code}")
            return None, None

        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find first result card
        first_result = soup.find(class_="card")
        
        # Fallback to movie search if no TV show found
        if not first_result:
             search_url = f"https://www.themoviedb.org/search/movie?query={query}"
             response = requests.get(search_url, headers=headers, timeout=10)
             soup = BeautifulSoup(response.content, 'html.parser')
             first_result = soup.find(class_="card")
        
        if not first_result:
            return None, None
            
        # Get details link
        link_tag = first_result.find("a", class_="result") or first_result.find("a")
        if not link_tag:
            return None, None
            
        details_url = "https://www.themoviedb.org" + link_tag.get('href')
        
        # 2. Go to Details Page
        time.sleep(0.5) # Politeness delay
        resp_details = requests.get(details_url, headers=headers, timeout=10)
        soup_details = BeautifulSoup(resp_details.content, 'html.parser')
        
        # 3. Extract GENRES
        # Usually in <span class="genres"> or similar metadata section
        genres = []
        genre_span = soup_details.find("span", class_="genres")
        if genre_span:
            for a_tag in genre_span.find_all("a"):
                genres.append(a_tag.get_text(strip=True))
        
        if not genres:
             # Try Alternate structure: facts section? 
             # TMDB sometimes puts keywords/genres in sidebar, but 'span.genres' is common in header.
             pass
        
        genre_str = ", ".join(genres) if genres else None

        # 4. Extract CAST
        # TMDB usually has <ol class="people scroller">
        cast_list = []
        people_ol = soup_details.find("ol", class_="people")
        if people_ol:
            # Get only top 8 actors
            cards = people_ol.find_all("li", class_="card", limit=8)
            for card in cards:
                # Name is usually in <p><a href="...">Name</a></p>
                name_tag = card.find("p").find("a")
                if name_tag:
                    cast_list.append(name_tag.get_text(strip=True))
        
        # If no cast found on main page, try the Full Cast page
        if not cast_list:
            cast_url = details_url.rstrip("/") + "/cast"
            # print(f"    -> Checking Cast Page: {cast_url}")
            resp_cast = requests.get(cast_url, headers=headers, timeout=10)
            if resp_cast.status_code == 200:
                soup_cast = BeautifulSoup(resp_cast.content, 'html.parser')
                # Usually logic for full cast page: <section class="panel pad"> ... <ol class="people credits"> or similar?
                # Actually TMDB /cast page structure is different. It often lists Cast in tables or lists.
                # Let's look for valid actor links generally?
                # Or specific structure: <ol class="people credits">
                # Let's try finding ANY person cards if specific structure fails
                
                # Check for standard Cast & Crew section
                cast_section = soup_cast.find("section", id="cast") or soup_cast.find("div", class_="cast")
                if cast_section:
                     items = cast_section.find_all("li")
                     for item in items[:10]: # Limit to top 10
                         img = item.find("img") # Check if it has an image (usually actors do)
                         name_a = item.find("p", class_="name") or item.find("a", class_="name") or item.find("a")
                         if name_a:
                             name = name_a.get_text(strip=True)
                             if name and name not in cast_list:
                                 cast_list.append(name)
            
        cast_str = ", ".join(cast_list) if cast_list else None
        
        return cast_str, genre_str

    except Exception as e:
        print(f"  [!] Error searching '{title}': {e}")
        return None, None

def search_mydramalist(title):
    try:
        # Headers specifically for MDL
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://mydramalist.com/'
        }
        
        query = urllib.parse.quote(title)
        search_url = f"https://mydramalist.com/search?q={query}"
        
        response = requests.get(search_url, headers=headers, timeout=10)
        if response.status_code != 200:
            return None, None
            
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find first result
        # MDL search results are usually in .box
        # Look for <h6 class="text-primary title"><a href="/1234-title">Title</a></h6>
        first_result = soup.find("h6", class_="text-primary title")
        
        if not first_result:
            return None, None
            
        link_tag = first_result.find("a")
        if not link_tag:
            return None, None
            
        details_url = "https://mydramalist.com" + link_tag.get('href')
        
        # Go to Details
        time.sleep(0.5)
        resp_details = requests.get(details_url, headers=headers, timeout=10)
        soup_details = BeautifulSoup(resp_details.content, 'html.parser')
        
        # 1. Extract GENRES
        # Usually in .show-details .list-item
        # Look for label "Genres:"
        genres = []
        details_list = soup_details.find("ul", class_="list m-b-0") # This class might vary, let's look for "Genres:" text
        # MDL structure is often: <li class="list-item p-a-0"><b class="inline">Genres:</b> <a...>Genre</a>, <a...>Genre</a></li>
        
        # Safer way: Find the label "Genres:"
        genre_label = soup_details.find("b", string="Genres:")
        if genre_label:
            parent_li = genre_label.parent
            for a_tag in parent_li.find_all("a"):
                genres.append(a_tag.get_text(strip=True))

        genre_str = ", ".join(genres) if genres else None
        
        # 2. Extract CAST
        # Usually in .box-body .list-unstyled
        cast_list = []
        # Main cast section usually has headers. Let's look for cast list items.
        # MDL usually has a "Cast & Credits" box
        # Actors are in <li class="list-item col-xs-6 col-sm-4 col-md-3">
        # Name is in <a class="text-primary text-ellipsis" href="...">Name</a>
        
        cast_items = soup_details.find_all("b", attrs={"itemprop": "name"}, limit=8) # Often used in cast cards
        if not cast_items:
             # Try alternate selector
             cast_items = soup_details.select(".box-body ul.list-unstyled li.list-item b a.text-primary")
             
        for item in cast_items:
             name = item.get_text(strip=True)
             if name and name not in cast_list:
                 cast_list.append(name)
                 
        cast_str = ", ".join(cast_list) if cast_list else None
        
        if cast_str or genre_str:
            print(f"    -> [MDL] Found data on MyDramaList!")
            
        return cast_str, genre_str

    except Exception as e:
        print(f"  [!] Error searching specific source (MDL) '{title}': {e}")
        return None, None

def main():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if user wants a dry run
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print(">>> DRY RUN MODE: No database changes will be saved. <<<")

    limit = None
    if "--limit" in sys.argv:
        try:
            limit_idx = sys.argv.index("--limit")
            limit = int(sys.argv[limit_idx + 1])
        except (ValueError, IndexError):
            print("Invalid limit specified.")
            return

            print("Invalid limit specified.")
            return

    missing_only = "--missing-only" in sys.argv
    
    if missing_only:
        print(">>> Mode: MISSING ONLY (skipping completed items) <<<")
        # Note: 'cast' is reserved, user double quotes
        cursor.execute('SELECT id, title, "cast", genre FROM series WHERE "cast" IS NULL OR "cast" = "" OR genre IS NULL OR genre = ""')
    else:
        cursor.execute('SELECT id, title, "cast", genre FROM series')

    all_rows = cursor.fetchall()
    series_list = all_rows[:limit] if limit else all_rows
    
    print(f"Found {len(series_list)} series to process (limit={limit}). Starting Metadata Fetch...")
    
    updated_count = 0
    
    for i, series in enumerate(series_list):
        original_title = series['title']
        
        # Improved Title Cleaning:
        # 1. Remove things in brackets/parentheses: [Completed], (2024)
        clean_title = re.sub(r"\[.*?\]", "", original_title)
        clean_title = re.sub(r"\(.*?\)", "", clean_title)
        
        # 2. Remove "Season X", "S1", "Ep. 1"
        clean_title = re.sub(r"(?i)\bseason\s*\d+\b", "", clean_title)
        clean_title = re.sub(r"(?i)\bs\d+\b", "", clean_title)
        
        # 3. Split by dash if it looks like a separator (checking if it leaves enough text)
        if "–" in clean_title:
             parts = clean_title.split("–")
             if len(parts[0]) > 2: clean_title = parts[0]
        elif "-" in clean_title:
             # Be careful not to split "X-Men" or hyphenated names too aggressively?
             # Only split if surrounded by spaces or at end? 
             # For now, let's keep the simple split but check length
             parts = clean_title.split("-")
             if len(parts[0]) > 2: clean_title = parts[0]

        clean_title = clean_title.strip()
        
        print(f"[{i+1}/{len(series_list)}] Processing: {clean_title} (Orig: {original_title})")
        
        # Skip if already has both? (Optional optimization, maybe user wants to force update)
        # Uncomment to skip if data exists:
        # if series['cast'] and series['genre']:
        #     print("  -> Already has data. Skipping.")
        #     continue

        found_cast, found_genre = search_tmdb_metadata(clean_title)
        
        # Fallback to MyDramaList if missing data
        if not found_cast or not found_genre:
            print("  -> TMDB data incomplete, trying MyDramaList...")
            mdl_cast, mdl_genre = search_mydramalist(clean_title)
            
            # Merge results (prefer TMDB if exists, otherwise take MDL)
            if not found_cast and mdl_cast:
                found_cast = mdl_cast
                print(f"  -> Found Cast (MDL): {found_cast}")
            
            if not found_genre and mdl_genre:
                found_genre = mdl_genre
                print(f"  -> Found Genre (MDL): {found_genre}")
        
        updates = []
        params = []
        
        if found_cast:
            updates.append("cast = ?")
            params.append(found_cast)
            if not mdl_cast: # Print TMDB cast if we haven't printed MDL cast
                 print(f"  -> Found Cast (TMDB): {found_cast}")
        else:
            print("  -> No cast found.")

        if found_genre:
            updates.append("genre = ?")
            params.append(found_genre)
            if not mdl_genre:
                 print(f"  -> Found Genre (TMDB): {found_genre}")
        else:
            print("  -> No genre found.")
            
        if updates:
            sql = f"UPDATE series SET {', '.join(updates)} WHERE id = ?"
            params.append(series['id'])
            
            if not dry_run:
                cursor.execute(sql, tuple(params))
                updated_count += 1
                if updated_count % 5 == 0:
                    conn.commit()
            else:
                print("  -> [Dry Run] would match update.")
        
        print("-" * 30)
        time.sleep(1.0) # Politeness
            
    if not dry_run:
        conn.commit()
        print(f"Done. Updated {updated_count} series.")
    else:
        print("Done. Dry run finished.")
        
    conn.close()

if __name__ == "__main__":
    main()
