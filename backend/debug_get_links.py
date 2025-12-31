import requests
import re

def get_links():
    url = "https://weifansub.com.br/atrizes/"
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        link_pattern = re.compile(r'<a[^>]+href=["\'](https://weifansub\.com\.br/[^"\']+/?)["\'][^>]*>(.*?)</a>', re.DOTALL)
        matches = link_pattern.findall(response.text)
        
        with open("links.txt", "w", encoding="utf-8") as f:
            for i, (url, content) in enumerate(matches):
                f.write(f"{url}\n")
                if i > 50: break

    except Exception as e:
        with open("links.txt", "w") as f:
            f.write(str(e))

if __name__ == "__main__":
    get_links()
