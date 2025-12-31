import requests
from bs4 import BeautifulSoup
import traceback

url = "https://weifansub.com.br/c-dramas-concluidos/"
headers = {'User-Agent': 'Mozilla/5.0'}

with open("index_debug.log", "w", encoding="utf-8") as f:
    try:
        response = requests.get(url, headers=headers)
        f.write(f"Status Code: {response.status_code}\n")
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Check entry-content
        entry = soup.find(class_="entry-content")
        if entry:
            f.write("Found entry-content.\n")
            # Find all links
            links = entry.find_all("a")
            f.write(f"Found {len(links)} links in entry-content.\n")
            for i, link in enumerate(links[:10]):
                f.write(f"Link {i}: {link.get_text(strip=True)} -> {link.get('href')}\n")
        else:
            f.write("No entry-content found.\n")
            # Dump all classes of divs
            divs = soup.find_all("div")
            classes = set()
            for div in divs:
                cls = div.get("class")
                if cls:
                    classes.add(tuple(cls))
            f.write(f"All div classes: {classes}\n")

    except Exception:
        f.write(traceback.format_exc())
