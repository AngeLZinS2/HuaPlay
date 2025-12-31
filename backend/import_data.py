import sqlite3
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import time
import re

def parse_pt_date(date_str):
    if not date_str: return None
    months = {
        'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4, 'maio': 5, 'junho': 6,
        'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
    }
    date_str = date_str.lower()
    for name, month in months.items():
        if f"de {name} de" in date_str:
            try:
                parts = date_str.split(f"de {name} de")
                day = int(parts[0].strip())
                year = int(parts[1].strip())
                return year
            except:
                pass
    # Fallback basic year search
    match = re.search(r'\d{4}', date_str)
    if match: return int(match.group(0))
    return None

import os

# Database connection
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weifansub.db")
print(f"DEBUG: Using DB at {DB_PATH}")

def get_soup(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def scrape_actor_details(profile_url):
    print(f"  Scraping details from {profile_url}...")
    soup = get_soup(profile_url)
    if not soup:
        return {}
    
    details = {
        'bio': None,
        'birth_date': None,
        'social_media': None,
        'real_name': None
    }
    
    content_div = soup.find('div', class_='entry-content')
    if not content_div:
        content_div = soup.find('article')

    if content_div:
        # Get text with newlines preserved to help parsing
        text = content_div.get_text(separator="\n")
        
        # Helper to extract value by label
        def extract_by_label(label_list):
            for line in text.split('\n'):
                for label in label_list:
                    if label.lower() in line.lower():
                        # Return text after the label
                        parts = line.split(label, 1)
                        if len(parts) > 1:
                            return parts[1].strip()
            return None

        # 1. Real Name
        # "Nome: Ai Mi (艾米)"
        details['real_name'] = extract_by_label(["Nome:", "Name:"])

        # 2. Birth Date
        # "Data de Nascimento: 13 de julho de 2008"
        details['birth_date'] = extract_by_label(["Data de Nascimento:", "Birth Date:", "Nascimento:"])

        # 3. Bio
        # "Biografia: Ai Mi é uma atriz..."
        # Sometimes Bio is a separate paragraph. We try finding the label first.
        bio_text = []
        capture = False
        for line in text.split('\n'):
            clean_line = line.strip()
            if not clean_line: continue
            
            if "Biografia:" in clean_line or "Biography:" in clean_line:
                capture = True
                # If the line has content after "Biografia:", add it
                parts = clean_line.split(":", 1)
                if len(parts) > 1 and len(parts[1].strip()) > 5:
                     bio_text.append(parts[1].strip())
                continue
            
            if capture:
                # Stop capturing if we hit other metadata or "Compartilhe"
                # "Fonte" might validly appear in text, but usually at the end it starts a new block
                # Check case-insensitive and startswith
                lower_line = clean_line.lower()
                if lower_line.startswith("fonte") or lower_line == "fonte":
                    break
                if any(x in clean_line for x in ["Compartilhe", "Source:", "Redes sociais"]):
                    break
                
                # Skip garbage lines like "– 💎 –", ")", or just numbers
                if '💎' in clean_line or clean_line.strip().isdigit() or clean_line.strip() == ')':
                    continue
                    
                bio_text.append(clean_line)
        
        if bio_text:
            details['bio'] = "\n\n".join(bio_text)
        
        # 4. Social Media
        # Look for links in the whole content div
        social_links = []
        possible_socials = ['instagram.com', 'weibo.com', 'twitter.com', 'facebook.com', 'douyin.com', 'tiktok.com']
        
        for link in content_div.find_all('a', href=True):
            href = link['href']
            # Avoid sharing links
            if 'share' in href or 'intent' in href: continue
            
            if any(s in href for s in possible_socials):
                social_links.append(href)
        
        if social_links:
            details['social_media'] = ",".join(list(set(social_links)))

    return details

def save_actor(cursor, actor_data):
    try:
        # Check for duplicates by name
        cursor.execute("SELECT id FROM actors WHERE name = ?", (actor_data['name'],))
        row = cursor.fetchone()
        
        if row:
            # Update existing actor with new details
            # We only update if fields are currently null or we force update. 
            # For now, let's always update detailed fields.
            cursor.execute("""
                UPDATE actors 
                SET bio = ?, birth_date = ?, real_name = ?, social_media = ?, image_url = ?
                WHERE id = ?
            """, (
                actor_data.get('bio'),
                actor_data.get('birth_date'),
                actor_data.get('real_name'),
                actor_data.get('social_media'),
                actor_data.get('image_url'),
                row[0]
            ))
            print(f"Updated: {actor_data['name']}")
            return 1 # Count as processed
        else:
            # Insert new
            cursor.execute("""
                INSERT INTO actors (name, gender, image_url, bio, birth_date, real_name, social_media, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                actor_data['name'], 
                actor_data['gender'], 
                actor_data['image_url'],
                actor_data.get('bio'), 
                actor_data.get('birth_date'),
                actor_data.get('real_name'),
                actor_data.get('social_media'),
                datetime.utcnow()
            ))
            print(f"Added: {actor_data['name']}")
            return 1
            
    except Exception as e:
        print(f"Error saving {actor_data['name']}: {e}")
        return 0

def import_category(url, gender):
    print(f"Fetching {gender}s from {url}...")
    soup = get_soup(url)
    if not soup:
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Ensure columns exist - crude migration
    # This acts as a safeguard if the migration didn't run.
    try:
        cursor.execute("SELECT bio FROM actors LIMIT 1")
    except sqlite3.OperationalError:
        print("Migrating database (adding new columns)...")
        try:
            cursor.execute("ALTER TABLE actors ADD COLUMN bio TEXT")
            cursor.execute("ALTER TABLE actors ADD COLUMN birth_date TEXT")
            cursor.execute("ALTER TABLE actors ADD COLUMN real_name TEXT")
            cursor.execute("ALTER TABLE actors ADD COLUMN social_media TEXT")
        except Exception as e:
            print(f"Migration warning: {e}")
    
    count = 0
    
    # parsing logic
    # The list of actors is inside 'post-content' or 'entry-content' as 'figure' elements
    main_content = soup.find('div', class_='post-content')
    if not main_content:
        main_content = soup.find('div', class_='entry-content')
    
    items = []
    if main_content:
        items = main_content.find_all('figure')
        
    if not items:
        # Fallback: look for generic figures or articles if separate
        items = soup.find_all('figure')
        
    print(f"Found {len(items)} potential items.")

    for item in items:
        # Check for link
        link_tag = item.find('a', href=True)
        if not link_tag: continue
        
        href = link_tag['href']
        
        # Filters
        if any(x in href for x in ['/page/', '/category/', '/tag/', '/schedule/', '/contact-us/']):
            continue
            
        # Basic parsing
        # Try to find name and image in the item
        img_tag = item.find('img')
        image_url = None
        if img_tag:
            image_url = img_tag.get('data-src') or img_tag.get('src')
        
        # Name derived from slug is safer given the captions are often emojis
        slug = href.strip('/').split('/')[-1]
        name = slug.replace('-', ' ').title()
        
        # Only use caption if it looks like a real name (not just symbols)
        caption = item.find('figcaption')
        if caption:
            cap_text = caption.get_text().strip()
            # If caption has letters and is not just punctuation/emoji
            if any(c.isalpha() for c in cap_text) and len(cap_text) > 3:
                name = cap_text
        
        # Skip if name contains diamond emoji or is invalid
        if '💎' in name or not any(c.isalpha() for c in name):
            print(f"Skipping invalid item: {name}")
            continue
        
        # Step into detail page
        details = scrape_actor_details(href)
        
        actor_data = {
            'name': name,
            'gender': gender,
            'image_url': image_url,
            **details
        }
        
        count += save_actor(cursor, actor_data)
        # Be nice to the server, but not too slow
        # time.sleep(0.1) 

    conn.commit()
    conn.close()
    print(f"Processed {count} {gender}s.")

def save_series(cursor, series_data):
    try:
        # Check for duplicates by title
        cursor.execute("SELECT id FROM series WHERE title = ?", (series_data['title'],))
        row = cursor.fetchone()
        
        if row:
            # Update links if they exist
            cursor.execute("""
                UPDATE series 
                SET drive_link = ?, mega_link = ?, mediafire_link = ?, telegram_link = ?, description = ?
                WHERE id = ?
            """, (
                series_data.get('drive_link'),
                series_data.get('mega_link'),
                series_data.get('mediafire_link'),
                series_data.get('telegram_link'),
                series_data.get('description'),
                row[0]
            ))
            print(f"Updated Series: {series_data['title']}")
            return 1
        else:
            # Insert new
            cursor.execute("""
                INSERT INTO series (title, description, cover_image, banner_image, genre, type, country, status, release_year, drive_link, mega_link, mediafire_link, telegram_link, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                series_data['title'],
                series_data.get('description'),
                series_data.get('cover_image'),
                series_data.get('cover_image'), # Use cover as banner fallback initially
                series_data.get('genre', 'Drama'),
                'Series',
                'China', # Default to China for C-Dramas
                'Completo',
                datetime.now().year, # Default current year if unknown
                series_data.get('drive_link'),
                series_data.get('mega_link'),
                series_data.get('mediafire_link'),
                series_data.get('telegram_link'),
                datetime.utcnow()
            ))
            print(f"Added Series: {series_data['title']}")
            
        # Get ID (either existing row or new insert)
        series_id = row[0] if row else cursor.lastrowid
        
        # Update Year if found
        if series_data.get('year'):
             cursor.execute("UPDATE series SET release_year = ? WHERE id = ?", (series_data['year'], series_id))

        # Save Episodes
        if 'episodes' in series_data and series_data['episodes']:
            print(f"  Saving {len(series_data['episodes'])} episodes for {series_data['title']}...")
            for ep in series_data['episodes']:
                cursor.execute("SELECT id FROM episodes WHERE series_id = ? AND episode_number = ?", (series_id, ep['number']))
                ep_row = cursor.fetchone()
                
                if ep_row:
                    cursor.execute("""
                        UPDATE episodes SET 
                            title = ?, drive_link = ?, mega_link = ?, mediafire_link = ?, pixeldrain_link = ? 
                        WHERE id = ?
                    """, (ep['title'], ep['drive_link'], ep['mega_link'], ep['mediafire_link'], ep['pixeldrain_link'], ep_row[0]))
                else:
                    cursor.execute("""
                        INSERT INTO episodes (series_id, title, episode_number, drive_link, mega_link, mediafire_link, pixeldrain_link, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (series_id, ep['title'], ep['number'], ep['drive_link'], ep['mega_link'], ep['mediafire_link'], ep['pixeldrain_link'], datetime.utcnow()))
        
        return 1
            
    except Exception as e:
        print(f"Error saving series {series_data['title']}: {e}")
        return 0

def scrape_drama_details(url):
    print(f"  Scraping drama details from {url}...")
    soup = get_soup(url)
    if not soup:
        return {}
    
    details = {
        'description': None, # Will populate
        'drive_link': None,
        'mega_link': None,
        'mediafire_link': None,
        'telegram_link': None,
        'cast': None
    }
    
    # 1. Description
    # User feedback: "Take from image". 
    # Attempt 1: Check ALT text
    # Extract links from content
    content_div = soup.find('div', class_='entry-content')
    if not content_div:
        content_div = soup.find('article')
        
    found_description = False
    
    if content_div:
        # Check images for long ALT text which is often the synopsis image
        images = content_div.find_all('img')
        for img in images:
            alt = img.get('alt', '').strip()
            if len(alt) > 50: # Arbitrary length for a synopsis
                details['description'] = alt
                found_description = True
                break
    
    # Attempt 2: Meta description (Fallback if no image text)
    if not found_description:
         meta_desc = soup.find('meta', property='og:description')
         if meta_desc:
             details['description'] = meta_desc.get('content')
    
    # Attempt 3: Paragraph text (excluding "Download" block)
    if not details['description'] and content_div:
         for p in content_div.find_all('p'):
            text = p.get_text().strip()
            # Heuristic: Synopsis usually long, doesn't start with "Episodio", doesn't have "http"
            if len(text) > 60 and "http" not in text and "Download" not in text and "Mega" not in text:
                details['description'] = text
                break
                
    if content_div:
        # 2. Extract Links
        links = content_div.find_all('a', href=True)
        for l in links:
            href = l['href']
            text = l.get_text().strip().lower()
            
            # Helper to check soft match
            def is_link_type(type_key):
                 # Strict exclusions
                 if 'whatsapp.com' in href or 'facebook.com' in href or 'twitter.com' in href:
                     return False
                 return type_key in href.lower() or type_key in text
            
            if is_link_type('drive.google'):
                details['drive_link'] = href
            elif is_link_type('mega.nz'):
                details['mega_link'] = href
            elif is_link_type('mediafire'):
                details['mediafire_link'] = href
            elif is_link_type('pixeldrain') or 'pixeldrain.com' in href: # Added Pixeldrain
                details['pixeldrain_link'] = href # Assuming a new field for pixeldrain
            elif is_link_type('t.me') or is_link_type('telegram'):
                details['telegram_link'] = href
    
    # 3. Date / Year
    details['year'] = None
    date_span = soup.find('span', class_='post-date')
    if date_span:
        details['year'] = parse_pt_date(date_span.get_text())
    
    # 4. Episodes
    details['episodes'] = []
    seen_eps = set()
    
    # Search for "EPISÓDIO" text nodes
    for node in soup.find_all(string=lambda t: t and "EPISÓDIO" in t.upper()):
        # Go up to container (p or div)
        line_el = node.parent
        while line_el and line_el.name not in ['p', 'div', 'li', 'article']:
            line_el = line_el.parent
        
        if not line_el: continue
        
        # Parse number
        match = re.search(r'EPISÓDIO\s+(\d+)', node.string or line_el.get_text(), re.IGNORECASE)
        if match:
            ep_num = int(match.group(1))
            if ep_num in seen_eps: continue
            seen_eps.add(ep_num)
            
            # Extract links in this block
            links = line_el.find_all('a', href=True)
            
            # Check next sibling if it contains links and is not another episode header
            next_el = line_el.find_next_sibling()
            if next_el and next_el.name in ['p', 'div', 'ul', 'ol']:
                next_text = next_el.get_text().strip()
                if "Episódio" not in next_text and "EPISÓDIO" not in next_text.upper():
                     sibling_links = next_el.find_all('a', href=True)
                     links.extend(sibling_links)
            ep_data = {
                'number': ep_num,
                'title': f"Episódio {ep_num}",
                'drive_link': None, 'mega_link': None, 'mediafire_link': None, 'pixeldrain_link': None
            }
            
            for l in links:
                href = l['href']
                text = l.get_text().strip().lower()
                
                 # Helper to check soft match
                def is_link_type_ep(type_key, h, t):
                     if 'whatsapp.com' in h or 'facebook.com' in h or 'uqload.com' in h: return False
                     return type_key in h.lower() or type_key in t

                if is_link_type_ep('drive.google', href, text): ep_data['drive_link'] = href
                elif is_link_type_ep('mega.nz', href, text): ep_data['mega_link'] = href
                elif is_link_type_ep('mediafire', href, text): ep_data['mediafire_link'] = href
                elif is_link_type_ep('pixeldrain', href, text) or 'pixeldrain.com' in href: ep_data['pixeldrain_link'] = href
            
            details['episodes'].append(ep_data)

    return details

def import_dramas():
    url = "https://weifansub.com.br/c-dramas-concluidos/"
    print(f"Fetching dramas from {url}...")
    soup = get_soup(url)
    if not soup: return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Logic similar to actors list
    main_content = soup.find('div', class_='post-content') or soup.find('div', class_='entry-content')
    items = []
    if main_content:
        items = main_content.find_all('figure')
        
    if not items:
         items = soup.find_all('figure')
         
    print(f"Found {len(items)} items in list.")
    count = 0
    
    for item in items:
        link_tag = item.find('a', href=True)
        if not link_tag: continue
        
        href = link_tag['href']
        
        # --- Filters ---
        # 1. Skip Image Direct Links (separators)
        if any(href.lower().endswith(ext) for ext in ['.jpg', '.png', '.jpeg', '.gif', '.webp']):
            continue
            
        # 2. Skip Internal functional links
        if any(x in href for x in ['/page/', '/category/', '/tag/', '/schedule/', '/contact-us/']):
            continue
            
        # Metadata from list item
        img_tag = item.find('img')
        image_url = None
        if img_tag:
            image_url = img_tag.get('data-src') or img_tag.get('src')
            
        # Title logic
        caption = item.find('figcaption')
        title = ""
        if caption:
            cap_text = caption.get_text().strip()
            # Filter garbage captions
            if not '💎' in cap_text and len(cap_text) > 2:
                 title = cap_text
        
        # Fallback title if caption was garbage or missing
        if not title:
            # Try to get it from the link text if reasonable
            link_text = link_tag.get_text().strip()
            if len(link_text) > 3:
                title = link_text
            else:
                 # Slug fallback
                 slug = href.strip('/').split('/')[-1]
                 title = slug.replace('-', ' ').title()
        
        # Skip if title is still suspicious (e.g. just a number or symbol)
        if len(title) < 2 or '💎' in title:
            continue
            
        # Refine content
        details = scrape_drama_details(href)
        
        series_data = {
            'title': title,
            'cover_image': image_url,
            **details
        }
        
        count += save_series(cursor, series_data)
        # time.sleep(0.1)

    conn.commit()
    conn.close()
    print(f"Processed {count} dramas.")

def import_single_drama(url):
    print(f"Importing single drama: {url}")
    soup = get_soup(url)
    if not soup: return

    # Title
    title = "Unknown"
    h1 = soup.find('h1', class_='post-title')
    if h1: title = h1.get_text().strip()
    
    # Image
    image_url = None
    meta_img = soup.find('meta', property='og:image')
    if meta_img: image_url = meta_img.get('content')
    
    # Details
    details = scrape_drama_details(url)
    
    series_data = {
        'title': title,
        'cover_image': image_url,
        **details
    }
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    count = save_series(cursor, series_data)
    conn.commit()
    conn.close()
    if count:
        print("Single import finished.")
    else:
        print("Import failed.")

def main():
    print("Starting import...")
    import_dramas()
    # import_single_drama("https://weifansub.com.br/2021/03/25/choc-tuc-vo-yeu/")
    # import_category("https://weifansub.com.br/atrizes/", "Female")
    # import_category("https://weifansub.com.br/atores/", "Male")
    print("Import complete.")

if __name__ == "__main__":
    main()
