import math
import random
import time
from collections import Counter
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
import models

# Inverse document frequency cache. Rebuilt when the catalog size changes or the
# TTL lapses — genres and cast change rarely, and rebuilding costs a full pass.
_IDF_CACHE: Dict[str, Any] = {"idf": None, "count": -1, "built_at": 0.0}
_IDF_TTL_SECONDS = 600

def build_feature_vector(series: models.Series) -> Counter:
    """Extract tokenized TF-IDF feature weights for a series (genres, country, cast, type)."""
    tokens = Counter()
    
    # Genres (weight = 2.5)
    if series.genre:
        for g in series.genre.split(','):
            g_clean = g.strip().lower()
            if g_clean:
                tokens[f"genre:{g_clean}"] += 2.5

    # Country (weight = 1.8)
    if series.country:
        tokens[f"country:{series.country.strip().lower()}"] += 1.8

    # Type (weight = 1.5)
    if series.type:
        tokens[f"type:{series.type.strip().lower()}"] += 1.5

    # Cast / Actors (weight = 1.2)
    if series.cast:
        for c in series.cast.split(','):
            c_clean = c.strip().lower()
            if c_clean and len(c_clean) > 2:
                tokens[f"cast:{c_clean}"] += 1.2

    return tokens


def compute_idf(all_series: List[models.Series]) -> Dict[str, float]:
    """Inverse document frequency for every term in the catalog.

    Without this, "genre:drama" — which nearly every title carries — weighs the
    same as "genre:wuxia", so hundreds of series tie on identical scores. Rare
    terms are what actually discriminate, and log(N / df) is what expresses that.
    """
    total = len(all_series)
    if not total:
        return {}

    doc_freq: Counter = Counter()
    for series in all_series:
        for term in build_feature_vector(series):
            doc_freq[term] += 1

    # 1 + log(...) keeps a term that appears in every document at a small positive
    # weight instead of exactly zero, so it still breaks ties between equals.
    return {term: 1.0 + math.log(total / df) for term, df in doc_freq.items()}


def get_idf(db: Session, all_series: List[models.Series]) -> Dict[str, float]:
    """Cached compute_idf, keyed on catalog size with a TTL fallback."""
    now = time.time()
    fresh = (
        _IDF_CACHE["idf"] is not None
        and _IDF_CACHE["count"] == len(all_series)
        and (now - _IDF_CACHE["built_at"]) < _IDF_TTL_SECONDS
    )
    if not fresh:
        _IDF_CACHE["idf"] = compute_idf(all_series)
        _IDF_CACHE["count"] = len(all_series)
        _IDF_CACHE["built_at"] = now
    return _IDF_CACHE["idf"]


def weighted_vector(series: models.Series, idf: Dict[str, float]) -> Counter:
    """Feature vector scaled by inverse document frequency."""
    vec = build_feature_vector(series)
    return Counter({term: weight * idf.get(term, 1.0) for term, weight in vec.items()})


def cosine_similarity(v1: Counter, v2: Counter) -> float:
    """Calculate cosine similarity score between two feature vectors."""
    dot_product = sum(weight * v2.get(term, 0.0) for term, weight in v1.items())
    mag1 = math.sqrt(sum(w * w for w in v1.values()))
    mag2 = math.sqrt(sum(w * w for w in v2.values()))
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot_product / (mag1 * mag2)


def get_ml_recommendations(
    db: Session,
    watched_ids: Optional[List[int]] = None,
    liked_ids: Optional[List[int]] = None,
    listed_ids: Optional[List[int]] = None,
    recent_series_id: Optional[int] = None,
    limit: int = 15,
) -> Dict[str, Any]:
    """Content-based recommendations from a profile's interaction signals.

    The signals arrive from the caller rather than being read from the database:
    likes, my-list and watch history live in Firestore now, owned by the client,
    while the catalog stays here. That keeps this function stateless about users
    and avoids giving the backend Firestore credentials just to read them.
    """
    all_series = db.query(models.Series).all()
    if not all_series:
        return {"recommendations": [], "because_you_watched": None, "is_personalized": False}

    idf = get_idf(db, all_series)

    by_id = {s.id: s for s in all_series}
    user_history_ids = set()
    user_profile_vector = Counter()
    recent_watched_series = by_id.get(recent_series_id) if recent_series_id else None

    # Weights mirror how strong each signal is as evidence of taste.
    for ids, weight in (
        (watched_ids or [], 3.0),
        (liked_ids or [], 2.5),
        (listed_ids or [], 2.0),
    ):
        for series_id in ids:
            series_item = by_id.get(series_id)
            if not series_item:
                continue
            user_history_ids.add(series_item.id)
            if recent_watched_series is None and weight == 3.0:
                recent_watched_series = series_item
            for term, value in weighted_vector(series_item, idf).items():
                user_profile_vector[term] += value * weight

    # If user profile vector is empty (Cold Start), generate a randomized diverse high-quality selection
    if not user_profile_vector:
        candidates = [s for s in all_series if s.banner_image and s.cover_image]
        if not candidates:
            candidates = all_series
        # Shuffle dynamically so initial homepage load is always fresh & different!
        shuffled = list(candidates)
        random.shuffle(shuffled)
        return {
            "recommendations": shuffled[:limit],
            "because_you_watched": None,
            "is_personalized": False
        }

    # Compute similarity score for candidates not yet watched
    scored_series = []
    for s in all_series:
        if s.id in user_history_ids:
            continue
        vec = weighted_vector(s, idf)
        score = cosine_similarity(user_profile_vector, vec)
        if s.banner_image:
            score += 0.05
        scored_series.append((score, s))

    # Ties are common for series carrying a single common genre, where IDF cannot
    # separate candidates that share exactly the same terms. Fall back to
    # popularity rather than insertion order, which was effectively sorting by id.
    scored_series.sort(key=lambda x: (x[0], x[1].views_count or 0), reverse=True)
    top_recommendations = [item[1] for item in scored_series[:limit]]

    # Compute "Because You Watched X" section
    because_you_watched = None
    if recent_watched_series:
        recent_vec = weighted_vector(recent_watched_series, idf)
        byw_scored = []
        for s in all_series:
            if s.id == recent_watched_series.id or s.id in user_history_ids:
                continue
            s_vec = weighted_vector(s, idf)
            sim = cosine_similarity(recent_vec, s_vec)
            byw_scored.append((sim, s))
        byw_scored.sort(key=lambda x: (x[0], x[1].views_count or 0), reverse=True)
        byw_list = [item[1] for item in byw_scored[:12]]
        if byw_list:
            because_you_watched = {
                "base_series": recent_watched_series,
                "recommendations": byw_list
            }

    return {
        "recommendations": top_recommendations,
        "because_you_watched": because_you_watched,
        "is_personalized": True
    }
