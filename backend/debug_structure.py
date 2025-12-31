import requests
from bs4 import BeautifulSoup

URL = "https://weifansub.com.br/2021/03/25/choc-tuc-vo-yeu/"

def debug_structure():
    response = requests.get(URL, headers={'User-Agent': 'Mozilla/5.0'})
    soup = BeautifulSoup(response.content, 'html.parser')
    
    print("Searching for 'Episódio' blocks...")
    count = 0
    for node in soup.find_all(string=lambda t: t and "EPISÓDIO" in t.upper()):
        print(f"\n--- MATCH {count} ---")
        print(f"Node text: {node}")
        
        parent = node.parent
        print(f"Parent tag: {parent.name}")
        
        # Go up to block
        block = parent
        while block and block.name not in ['p', 'div', 'li', 'article']:
            block = block.parent
            
        print(f"Block tag: {block.name if block else 'None'}")
        if block:
            print(f"Block text: {block.get_text().strip()[:100]}...")
            links = block.find_all('a', href=True)
            print(f"Links in block: {len(links)}")
            for l in links:
                print(f" - {l['href']}")
                
        # Check Next Sibling
        if block:
            sibling = block.find_next_sibling()
            if sibling:
                 print(f"Next Sibling tag: {sibling.name}")
                 print(f"Next Sibling text: {sibling.get_text().strip()[:100]}...")
                 s_links = sibling.find_all('a', href=True)
                 print(f"Links in sibling: {len(s_links)}")
                 for l in s_links:
                    print(f"   (sibling) {l['href']}")

        count += 1
        if count > 3: break

if __name__ == "__main__":
    debug_structure()
