import requests

def get_html():
    url = "https://weifansub.com.br/atrizes/"
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        with open("debug_html.txt", "w", encoding="utf-8") as f:
            f.write(response.text)
            
    except Exception as e:
        print(e)

if __name__ == "__main__":
    get_html()
