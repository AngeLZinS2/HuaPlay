"""List or add Firebase Authentication authorized domains.

Why this exists: `firebase deploy --only auth` applies the providers declared in
firebase.json but silently ignores its `authorizedDomains` field (verified
against firebase-tools 15.30.2). Without the domain on that list, Google sign-in
opens and immediately fails with auth/unauthorized-domain.

    python scripts/firebase_authorized_domains.py                 # list
    python scripts/firebase_authorized_domains.py 192.168.0.50    # add

Authenticates with the refresh token that `firebase login` already stored, so it
needs no extra credentials. Never pass a protocol or port — "localhost", not
"http://localhost:5173".
"""
import json
import os
import sys
import time

import requests

PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "gtavi-6991d")
CONFIG_PATH = os.path.expanduser(r"~\.config\configstore\firebase-tools.json")
CONFIG_URL = f"https://identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT_ID}/config"

# Public OAuth client of the Firebase CLI; not a secret of this project.
CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi"


def access_token() -> str:
    try:
        tokens = json.load(open(CONFIG_PATH, encoding="utf-8"))["tokens"]
    except (OSError, KeyError) as exc:
        raise SystemExit(
            f"Could not read Firebase CLI credentials at {CONFIG_PATH}.\n"
            "Run: npx -y firebase-tools@latest login"
        ) from exc

    cached = tokens.get("access_token")
    if cached and tokens.get("expires_at", 0) / 1000 > time.time() + 60:
        return cached

    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "refresh_token": tokens["refresh_token"],
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def main(argv: list[str]) -> int:
    headers = {"Authorization": "Bearer " + access_token()}

    current = requests.get(CONFIG_URL, headers=headers, timeout=30)
    current.raise_for_status()
    domains = current.json().get("authorizedDomains", [])

    to_add = [d.strip() for d in argv if d.strip()]
    for domain in to_add:
        if "://" in domain or ":" in domain.split("]")[-1].strip("[]"):
            print(f"refusing {domain!r}: use a bare host, no protocol or port")
            return 1

    missing = [d for d in to_add if d not in domains]
    if missing:
        response = requests.patch(
            CONFIG_URL + "?updateMask=authorizedDomains",
            headers=headers,
            json={"authorizedDomains": domains + missing},
            timeout=30,
        )
        response.raise_for_status()
        domains = response.json().get("authorizedDomains", [])
        print(f"added: {', '.join(missing)}")
    elif to_add:
        print("already authorized")

    print("authorized domains:")
    for domain in domains:
        print(f"  - {domain}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
