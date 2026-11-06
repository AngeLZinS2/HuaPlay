#!/usr/bin/env python3
"""
HuaPlay AI Synopsis Summarizer & Cleaner
=========================================
Automatically summarizes long catalog synopses using Groq (primary) and
Google Gemini (fallback), removing boilerplate credits, sources, and novel references.

Usage:
    python scripts/summarize_synopses.py [--limit N] [--apply] [--force] [--db PATH]
"""

import os
import re
import sys
import time
import sqlite3
import argparse
import requests

# Ensure proper encoding on Windows / Linux
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def load_env_file():
    """Load environment variables from nearby .env files if not already set."""
    search_dirs = [
        os.getcwd(),
        os.path.dirname(os.path.abspath(__file__)),
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ]
    for d in search_dirs:
        env_file = os.path.join(d, ".env")
        if os.path.isfile(env_file):
            try:
                with open(env_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            if k not in os.environ or not os.environ[k]:
                                os.environ[k] = v
            except Exception:
                pass


load_env_file()


def find_default_db() -> str:
    """Find the SQLite database file across common project structures."""
    env_path = os.getenv("SQLITE_PATH") or os.getenv("DATABASE_PATH")
    if env_path and os.path.exists(env_path):
        return os.path.abspath(env_path)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(script_dir, "..", "data", "weifansub.db"),
        os.path.join(script_dir, "..", "..", "data", "weifansub.db"),
        os.path.join(script_dir, "..", "weifansub.db"),
        "/home/deploy/huaplay/data/weifansub.db",
        "/app/weifansub.db",
        "data/weifansub.db",
        "weifansub.db",
    ]
    for p in candidates:
        if os.path.exists(p):
            return os.path.abspath(p)
    return os.path.abspath(os.path.join(script_dir, "..", "weifansub.db"))


DEFAULT_DB_PATH = find_default_db()

# API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

DEFAULT_GOOGLE_KEY = ""
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

MAX_CHAR_LIMIT = 260
SUMMARY_TRIGGER_LENGTH = 280

PROMPT_TEMPLATE = (
    "Resuma a seguinte sinopse de dorama/série/filme para catálogo de streaming em português do Brasil "
    "em no máximo 260 caracteres, em 1 ou 2 frases fluídas e cativantes. "
    "Remova terminantemente qualquer menção a fontes (ex: WeTV, Viki, iQIYI), autores, web novels originais, "
    "número de episódios, avisos de direitos ou créditos externos. "
    "Preserve os nomes dos personagens principais e o conflito central. "
    "Retorne APENAS o texto da sinopse resumida, sem aspas, títulos ou introduções.\n\n"
    "Sinopse original:\n{synopsis}"
)


REJECT_PHRASES = [
    "desculpe",
    "preciso da sinopse",
    "não foi fornecida",
    "não há sinopse",
    "texto fornecido",
    "não contém",
    "não é possível resumir",
    "não foi possível",
    "como uma ia",
    "como modelo de linguagem",
]


def is_garbage_or_links_only(text: str) -> bool:
    """Detect text that is merely scraped episode download links instead of synopsis."""
    links_count = len(
        re.findall(r"(mega|pixeldrain|mediafire|drive|telegram|episódio\s*\d+)", text, re.I)
    )
    words = re.findall(r"[a-záàâãéèêíïóôõöúçñ]{4,}", text, re.I)
    return links_count >= 3 and len(words) < 20


def clean_synopsis_text(text: str) -> str:
    """Strip external source tags, novel adaptations, and boilerplate noise."""
    if not text:
        return ""
    cleaned = re.sub(r"\(Fonte:[^\)]*\)", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\(Source:[^\)]*\)", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"~~\s*Adaptad[oa]\s+d[oe].*?$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\[Fonte:[^\]]*\]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.strip('"\' ')


def is_valid_ai_summary(summary: str) -> bool:
    """Check if AI generated a real summary or an apology/refusal."""
    if not summary or len(summary) < 25:
        return False
    lower = summary.lower()
    for phrase in REJECT_PHRASES:
        if phrase in lower:
            return False
    return True


def local_truncate_fallback(description: str, title: str = "") -> str:
    """Fallback when AI is unavailable; cuts cleanly at sentence boundary."""
    if is_garbage_or_links_only(description):
        clean_title = re.sub(r"\s*\(.*?\)", "", title or "").strip()
        return f"Acompanhe os episódios completos de {clean_title} legendados em alta qualidade no HuaPlay."

    clean = clean_synopsis_text(description)
    if len(clean) <= MAX_CHAR_LIMIT:
        return clean
    candidate = clean[: MAX_CHAR_LIMIT + 1]
    sentence_end = max(
        candidate.rfind(". "), candidate.rfind("! "), candidate.rfind("? ")
    )
    if sentence_end >= 100:
        return candidate[: sentence_end + 1].strip()
    return candidate[: candidate.rfind(" ")].rstrip(" ,;:-") + "…"


def summarize_with_groq(text: str, api_key: str) -> str:
    """Summarize using Groq OpenAI-compatible API."""
    if not api_key:
        return ""
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "temperature": 0.2,
        "max_tokens": 120,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Você é um editor de catálogo de streaming de doramas em português do Brasil. "
                    "Seu objetivo é resumir sinopses em no máximo 260 caracteres com alta qualidade, "
                    "sem menções a fontes, produtoras, novels ou créditos. Retorne apenas o resumo."
                ),
            },
            {"role": "user", "content": text},
        ],
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    summary = data["choices"][0]["message"]["content"].strip().strip('"\'')
    return clean_synopsis_text(summary)


def summarize_with_gemini(text: str, api_key: str) -> str:
    """Summarize using Google Gemini API."""
    if not api_key:
        return ""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    prompt = PROMPT_TEMPLATE.format(synopsis=text)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 150,
        },
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=12)
    resp.raise_for_status()
    data = resp.json()
    candidates = data.get("candidates", [])
    if candidates and "content" in candidates[0]:
        parts = candidates[0]["content"].get("parts", [])
        if parts and "text" in parts[0]:
            summary = parts[0]["text"].strip().strip('"\'')
            return clean_synopsis_text(summary)
    return ""


def summarize_synopsis(original_text: str, title: str = "") -> tuple[str, str]:
    """
    Attempts summarization in order: Groq -> Google Gemini -> Local cleaning/truncation.
    Returns (summarized_text, provider_name).
    """
    if is_garbage_or_links_only(original_text):
        clean_title = re.sub(r"\s*\(.*?\)", "", title or "").strip()
        return (
            f"Acompanhe os episódios completos de {clean_title} legendados em alta qualidade no HuaPlay.",
            "Padrão Editorial",
        )

    cleaned_input = clean_synopsis_text(original_text)

    # 1. Try Groq
    if GROQ_API_KEY:
        try:
            summary = summarize_with_groq(cleaned_input, GROQ_API_KEY)
            if is_valid_ai_summary(summary):
                return summary, "Groq"
        except Exception:
            pass

    # 2. Try Google Gemini
    if GOOGLE_API_KEY:
        try:
            summary = summarize_with_gemini(cleaned_input, GOOGLE_API_KEY)
            if is_valid_ai_summary(summary):
                return summary, "Google Gemini"
        except Exception:
            pass

    # 3. Local fallback
    return local_truncate_fallback(original_text, title=title), "Local Fallback"


def main():
    parser = argparse.ArgumentParser(
        description="HuaPlay Batch AI Synopsis Summarizer"
    )
    parser.add_argument(
        "--db", default=DEFAULT_DB_PATH, help=f"Path to SQLite database (default: {DEFAULT_DB_PATH})"
    )
    parser.add_argument(
        "--id", type=int, default=0, help="Process a specific series ID only"
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="Maximum number of records to process (0 = all)"
    )
    parser.add_argument(
        "--apply", action="store_true", help="Save changes to the database (without this, runs in dry-run mode)"
    )
    parser.add_argument(
        "--force", action="store_true", help="Process even short synopses (<= 280 chars) to clean boilerplate"
    )
    parser.add_argument(
        "--delay", type=float, default=0.3, help="Delay in seconds between requests to avoid rate limits"
    )
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"Erro: Banco de dados não encontrado em '{args.db}'")
        sys.exit(1)

    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()

    if args.id > 0:
        query = "SELECT id, title, description FROM series WHERE id = ?"
        cursor.execute(query, (args.id,))
    else:
        query = "SELECT id, title, description FROM series WHERE description IS NOT NULL AND length(trim(description)) > 0"
        cursor.execute(query)
    all_rows = cursor.fetchall()

    items_to_process = []
    boilerplate_pattern = re.compile(r"\(Fonte:|~~\s*Adaptad|\(Source:|Adaptado\s+do", re.IGNORECASE)

    for row_id, title, desc in all_rows:
        needs_summary = (
            args.id > 0
            or args.force
            or len(desc) > SUMMARY_TRIGGER_LENGTH
            or bool(boilerplate_pattern.search(desc))
        )
        if needs_summary:
            items_to_process.append((row_id, title, desc))

    total_candidates = len(items_to_process)
    if args.limit > 0:
        items_to_process = items_to_process[: args.limit]

    print("=" * 60)
    print("HuaPlay - Resumidor Automático de Sinopses por IA")
    print("=" * 60)
    print(f"Banco de dados: {args.db}")
    print(f"Modo: {'APLICAR NO BANCO (--apply)' if args.apply else 'SIMULAÇÃO / DRY-RUN (use --apply para salvar)'}")
    print(f"Total de títulos encontrados no catálogo: {len(all_rows)}")
    print(f"Títulos candidatos a resumo (> {SUMMARY_TRIGGER_LENGTH} caracteres ou com créditos): {total_candidates}")
    print(f"Serão processados nesta execução: {len(items_to_process)}")
    print(f"Provedores ativos: Groq={'Sim' if GROQ_API_KEY else 'Não'} | Gemini={'Sim' if GOOGLE_API_KEY else 'Não'}")
    print("=" * 60)

    stats = {"Groq": 0, "Google Gemini": 0, "Local Fallback": 0, "Errors": 0}
    updated_count = 0

    for idx, (series_id, title, original_desc) in enumerate(items_to_process, start=1):
        try:
            summary, provider = summarize_synopsis(original_desc, title=title)
            stats[provider] = stats.get(provider, 0) + 1

            print(f"\n[{idx}/{len(items_to_process)}] #{series_id} \"{title}\" via [{provider}]")
            print(f"  Original ({len(original_desc)} chars): {original_desc[:120]}...")
            print(f"  Resumo   ({len(summary)} chars): {summary}")

            if args.apply:
                cursor.execute(
                    "UPDATE series SET description = ? WHERE id = ?",
                    (summary, series_id),
                )
                conn.commit()
                updated_count += 1

            if args.delay > 0 and idx < len(items_to_process):
                time.sleep(args.delay)

        except Exception as e:
            stats["Errors"] += 1
            print(f"  [ERRO ao processar #{series_id}]: {e}")

    conn.close()

    print("\n" + "=" * 60)
    print("Resumo da Execução:")
    print(f"  Total avaliado: {len(items_to_process)}")
    print(f"  Processados por Groq: {stats['Groq']}")
    print(f"  Processados por Gemini: {stats['Google Gemini']}")
    print(f"  Fallback Local: {stats['Local Fallback']}")
    print(f"  Erros: {stats['Errors']}")
    if args.apply:
        print(f"  Alterações salvas no banco: {updated_count}")
    else:
        print("  AVISO: Nenhuma alteração foi persistida (modo simulação). Para salvar, execute com --apply.")
    print("=" * 60)


if __name__ == "__main__":
    main()
