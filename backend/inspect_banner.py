import requests
from bs4 import BeautifulSoup
import traceback

url = "https://weifansub.com.br/2021/03/25/choc-tuc-vo-yeu/"
headers = {'User-Agent': 'Mozilla/5.0'}

with open("banner_debug.log", "w", encoding="utf-8") as f:
    try:
        response = requests.get(url, headers=headers)
        f.write(f"Status Code: {response.status_code}\n")
        
        soup = BeautifulSoup(response.content, 'html.parser')

        # Find container with "EPISÓDIO"
        episode_text = soup.find(string=lambda t: t and "EPISÓDIO" in t)
        if episode_text:
            container = episode_text.find_parent("div")
            if container:
                f.write(f"Found match in DIV. Classes: {container.get('class')}\n")
                # Parent
                parent = container.find_parent("div")
                if parent:
                    f.write(f"Parent DIV Classes: {parent.get('class')}\n")
                    f.write(f"Container Parent Tag: {parent.name}\n")
                    # Images in parent
                    p_imgs = parent.find_all("img")
                    f.write(f"Images in Parent: {len(p_imgs)}\n")
                    for i, img in enumerate(p_imgs[:10]):
                        src = img.get('src')
                        data_src = img.get('data-src') or img.get('data-lazy-src')
                        f.write(f"P_IMG {i} src: {src}\n")
                        f.write(f"P_IMG {i} data-src: {data_src}\n")
            else:
                f.write("Match found but no DIV parent.\n")
        else:
            f.write("No 'EPISÓDIO' text found.\n")

    except Exception:
        f.write(traceback.format_exc())
