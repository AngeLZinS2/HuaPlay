import requests
from bs4 import BeautifulSoup
import re

URL = "https://weifansub.com.br/2021/03/25/choc-tuc-vo-yeu/"

def debug_scrape():
    print(f"Scraping {URL}")
    response = requests.get(URL, headers={'User-Agent': 'Mozilla/5.0'})
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Try different selectors
    links = soup.find_all('a', href=True)
    pixeldrain_links = [l['href'] for l in links if 'pixeldrain' in l['href'] or 'pixeldrain' in l.text.lower()]
    
    print(f"Found {len(pixeldrain_links)} Pixeldrain links:")
    for l in pixeldrain_links:
        print(f" - {l}")
        
    # Check for specific text
    content_area = soup.find('div', class_='entry-content')
    if content_area:
        print("\nChecking entry-content text for 'Pixeldrain':")
        if 'Pixeldrain' in content_area.text:
            print("Found 'Pixeldrain' text in content.")
        else:
            print("Did NOT find 'Pixeldrain' text in content.")

if __name__ == "__main__":
    debug_scrape()
