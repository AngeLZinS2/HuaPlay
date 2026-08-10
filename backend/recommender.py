import math
import random
from collections import Counter
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
import models

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


def cosine_similarity(v1: Counter, v2: Counter) -> float:
    """Calculate cosine similarity score between two feature vectors."""
    dot_product = sum(weight * v2.get(term, 0.0) for term, weight in v1.items())
    mag1 = math.sqrt(sum(w * w for w in v1.values()))
    mag2 = math.sqrt(sum(w * w for w in v2.values()))
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot_product / (mag1 * mag2)


def get_ml_recommendations(db: Session, user_id: Optional[int] = None, profile_id: Optional[int] = None, limit: int = 15) -> Dict[str, Any]:
    """
    Computes personalized Machine Learning recommendations based on user watch history, likes, and saved list.
    Returns:
    - recommendations: List[Series]
    - because_you_watched: Dict containing { 'base_series': Series, 'recommendations': List[Series] } or None
    """
    all_series = db.query(models.Series).all()
    if not all_series:
        return {"recommendations": [], "because_you_watched": None, "is_personalized": False}

    # Gather user interaction history
    user_history_ids = set()
    user_profile_vector = Counter()
    recent_watched_series = None

    if profile_id:
        # 1. Watch history
        history_rows = db.query(models.WatchHistory).filter(models.WatchHistory.profile_id == profile_id).order_by(models.WatchHistory.updated_at.desc()).all()
        for row in history_rows:
            user_history_ids.add(row.series_id)
            series_item = db.query(models.Series).filter(models.Series.id == row.series_id).first()
            if series_item:
                if not recent_watched_series:
                    recent_watched_series = series_item
                vec = build_feature_vector(series_item)
                for term, weight in vec.items():
                    user_profile_vector[term] += weight * 3.0

        # 2. Likes
        like_rows = db.query(models.Like).filter(models.Like.profile_id == profile_id).all()
        for row in like_rows:
            user_history_ids.add(row.series_id)
            series_item = db.query(models.Series).filter(models.Series.id == row.series_id).first()
            if series_item:
                vec = build_feature_vector(series_item)
                for term, weight in vec.items():
                    user_profile_vector[term] += weight * 2.5

        # 3. User List (Saved)
        list_rows = db.query(models.UserList).filter(models.UserList.profile_id == profile_id).all()
        for row in list_rows:
            user_history_ids.add(row.series_id)
            series_item = db.query(models.Series).filter(models.Series.id == row.series_id).first()
            if series_item:
                vec = build_feature_vector(series_item)
                for term, weight in vec.items():
                    user_profile_vector[term] += weight * 2.0

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
        vec = build_feature_vector(s)
        score = cosine_similarity(user_profile_vector, vec)
        if s.banner_image:
            score += 0.05
        scored_series.append((score, s))

    scored_series.sort(key=lambda x: x[0], reverse=True)
    top_recommendations = [item[1] for item in scored_series[:limit]]

    # Compute "Because You Watched X" section
    because_you_watched = None
    if recent_watched_series:
        recent_vec = build_feature_vector(recent_watched_series)
        byw_scored = []
        for s in all_series:
            if s.id == recent_watched_series.id or s.id in user_history_ids:
                continue
            s_vec = build_feature_vector(s)
            sim = cosine_similarity(recent_vec, s_vec)
            byw_scored.append((sim, s))
        byw_scored.sort(key=lambda x: x[0], reverse=True)
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
