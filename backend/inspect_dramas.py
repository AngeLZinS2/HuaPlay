import requests
from bs4 import BeautifulSoup
import traceback

def inspect():
    with open("inspection.txt", "w", encoding="utf-8") as f:
        try:
            url = "https://weifansub.com.br/2021/03/25/choc-tuc-vo-yeu/"
            f.write(f"Fetching {url}...\n")
            
            headers = {'User-Agent': 'Mozilla/5.0'}
            r = requests.get(url, headers=headers)
            f.write(f"Status Code: {r.status_code}\n")
            
            soup = BeautifulSoup(r.text, 'html.parser')
            
            # Robust search
            f.write("\n--- Robust Search ---\n")
            
            # Title
            h1s = soup.find_all('h1')
            for h in h1s:
                f.write(f"H1: {h.get_text().strip()} (Classes: {h.get('class')})\n")
            
            # Date (2021)
            f.write("\n--- Date Search ---\n")
            for t in soup.find_all(string=lambda x: x and "2021" in x):
                parent = t.parent
                f.write(f"Found '2021' in <{parent.name} class='{parent.get('class')}'>: {t.strip()[:50]}...\n")

            # Episodes
            f.write("\n--- Episode Search ---\n")
            # Search for "EPISÓDIO" in text nodes
            for t in soup.find_all(string=lambda x: x and "EPISÓDIO" in x.upper()):
                parent = t.parent
                f.write(f"Found 'EPISÓDIO' in <{parent.name} class='{parent.get('class')}'>\n")
                # Check siblings or children for links
                links = parent.find_all('a', href=True)
                if links:
                     for l in links:
                         f.write(f"  Link: {l.get_text()} -> {l['href']}\n")
                         
        except Exception:
            f.write(f"Exception: {traceback.format_exc()}\n")

if __name__ == "__main__":
    inspect()
