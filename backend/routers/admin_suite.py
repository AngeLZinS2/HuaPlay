"""Operational admin tools kept separate from the core catalog routes."""
from datetime import datetime, timezone
import ipaddress
import json
import re
import socket
from typing import Any, Literal, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
from database import get_db

public_router = APIRouter(tags=["experience"])
admin_router = APIRouter(prefix="/admin", tags=["admin-suite"])


def row_dict(row):
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def audit(db: Session, action: str, entity_type: str, entity_id=None, payload=None):
    db.add(models.AdminAuditLog(action=action, entity_type=entity_type, entity_id=entity_id,
                                payload=json.dumps(payload, ensure_ascii=False, default=str) if payload is not None else None))


class HeroSlideIn(BaseModel):
    series_id: Optional[int] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    image_url: str
    action_url: Optional[str] = None
    position: int = 0
    duration_seconds: int = Field(8, ge=3, le=60)
    is_active: bool = True
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class HeroSlideUpdate(BaseModel):
    series_id: Optional[int] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    action_url: Optional[str] = None
    position: Optional[int] = None
    duration_seconds: Optional[int] = Field(None, ge=3, le=60)
    duration: Optional[int] = Field(None, ge=3, le=60)
    is_active: Optional[bool] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


@public_router.get("/home/hero-banners")
@public_router.get("/home/hero-slides")
def public_hero_slides(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    return db.query(models.HeroSlide).filter(
        models.HeroSlide.is_active == True,
        or_(models.HeroSlide.starts_at.is_(None), models.HeroSlide.starts_at <= now),
        or_(models.HeroSlide.ends_at.is_(None), models.HeroSlide.ends_at >= now),
    ).order_by(models.HeroSlide.position, models.HeroSlide.id).all()


@admin_router.get("/hero-banners")
@admin_router.get("/hero-slides")
def list_hero_slides(db: Session = Depends(get_db)):
    return db.query(models.HeroSlide).order_by(models.HeroSlide.position, models.HeroSlide.id).all()


@admin_router.post("/hero-banners", status_code=status.HTTP_201_CREATED)
@admin_router.post("/hero-slides", status_code=status.HTTP_201_CREATED)
def create_hero_slide(data: HeroSlideIn, db: Session = Depends(get_db)):
    row = models.HeroSlide(**data.model_dump())
    db.add(row); db.flush(); audit(db, "create", "hero_slide", row.id, row_dict(row)); db.commit(); db.refresh(row)
    return row


@admin_router.put("/hero-banners/{item_id}")
@admin_router.put("/hero-slides/{item_id}")
def update_hero_slide(item_id: int, data: HeroSlideIn, db: Session = Depends(get_db)):
    row = db.get(models.HeroSlide, item_id)
    if not row: raise HTTPException(404, "Destaque não encontrado")
    for key, value in data.model_dump().items(): setattr(row, key, value)
    audit(db, "update", "hero_slide", row.id, row_dict(row)); db.commit(); db.refresh(row)
    return row


@admin_router.patch("/hero-banners/{item_id}")
def patch_hero_slide(item_id: int, data: HeroSlideUpdate, db: Session = Depends(get_db)):
    row = db.get(models.HeroSlide, item_id)
    if not row: raise HTTPException(404, "Destaque não encontrado")
    values = data.model_dump(exclude_unset=True)
    if "duration" in values: values["duration_seconds"] = values.pop("duration")
    for key, value in values.items(): setattr(row, key, value)
    audit(db, "update", "hero_slide", row.id, values); db.commit(); db.refresh(row); return row


@admin_router.delete("/hero-banners/{item_id}", status_code=204)
@admin_router.delete("/hero-slides/{item_id}", status_code=204)
def delete_hero_slide(item_id: int, db: Session = Depends(get_db)):
    row = db.get(models.HeroSlide, item_id)
    if not row: raise HTTPException(404, "Destaque não encontrado")
    audit(db, "delete", "hero_slide", row.id, row_dict(row)); db.delete(row); db.commit()


@admin_router.get("/release-calendar")
@admin_router.get("/calendar")
def publication_calendar(start: Optional[datetime] = None, end: Optional[datetime] = None,
                         db: Session = Depends(get_db)):
    items = []
    for kind, model in (("series", models.Series), ("episode", models.Episode)):
        query = db.query(model).filter(model.scheduled_at.isnot(None))
        if start: query = query.filter(model.scheduled_at >= start)
        if end: query = query.filter(model.scheduled_at <= end)
        for row in query.all():
            items.append({"kind": kind, "id": row.id, "title": row.title,
                          "scheduled_at": row.scheduled_at, "status": row.publication_status,
                          "series_id": getattr(row, "series_id", None)})
    release_query = db.query(models.ScheduledRelease)
    if start: release_query = release_query.filter(models.ScheduledRelease.scheduled_at >= start)
    if end: release_query = release_query.filter(models.ScheduledRelease.scheduled_at <= end)
    for row in release_query.all():
        items.append({"kind": row.resource_type, "id": row.id, "resource_id": row.resource_id,
                      "title": row.title, "scheduled_at": row.scheduled_at, "status": row.status})
    return sorted(items, key=lambda item: item["scheduled_at"])


class ScheduleIn(BaseModel):
    publication_status: Literal["draft", "review", "scheduled", "published", "archived"]
    scheduled_at: Optional[datetime] = None


@admin_router.patch("/release-calendar/{kind}/{item_id}")
@admin_router.patch("/calendar/{kind}/{item_id}")
def schedule_item(kind: Literal["series", "episode"], item_id: int, data: ScheduleIn,
                  db: Session = Depends(get_db)):
    model = models.Series if kind == "series" else models.Episode
    row = db.get(model, item_id)
    if not row: raise HTTPException(404, "Conteúdo não encontrado")
    row.publication_status, row.scheduled_at = data.publication_status, data.scheduled_at
    audit(db, "schedule", kind, item_id, data.model_dump()); db.commit(); db.refresh(row)
    return row_dict(row)


class ReleaseIn(BaseModel):
    resource_type: Literal["series", "episode"] = "series"
    resource_id: Optional[int] = None
    series_id: Optional[int] = None
    episode_number: Optional[int] = None
    title: Optional[str] = None
    scheduled_at: datetime
    status: Literal["scheduled", "published", "cancelled"] = "scheduled"


@admin_router.post("/release-calendar", status_code=201)
def create_release(data: ReleaseIn, db: Session = Depends(get_db)):
    values = data.model_dump(exclude={"series_id", "episode_number"})
    values["resource_id"] = data.resource_id or data.series_id
    if not values["resource_id"]: raise HTTPException(422, "Informe a série")
    series = db.get(models.Series, data.series_id or data.resource_id)
    values["title"] = data.title or (series.title if series else "Conteúdo agendado")
    if data.episode_number is not None: values["title"] += f" · Episódio {data.episode_number}"
    row = models.ScheduledRelease(**values); db.add(row); db.flush()
    audit(db, "create", "release", row.id, data.model_dump()); db.commit(); db.refresh(row); return row


@admin_router.patch("/release-calendar/{item_id}")
def update_release(item_id: int, data: ReleaseIn, db: Session = Depends(get_db)):
    row = db.get(models.ScheduledRelease, item_id)
    if not row: raise HTTPException(404, "Agendamento não encontrado")
    values = data.model_dump(exclude={"series_id", "episode_number"})
    values["resource_id"] = data.resource_id or data.series_id or row.resource_id
    if not values.get("title"): values["title"] = row.title
    for key, value in values.items(): setattr(row, key, value)
    audit(db, "update", "release", row.id, data.model_dump()); db.commit(); db.refresh(row); return row


@admin_router.delete("/release-calendar/{item_id}", status_code=204)
def delete_release(item_id: int, db: Session = Depends(get_db)):
    row = db.get(models.ScheduledRelease, item_id)
    if not row: raise HTTPException(404, "Agendamento não encontrado")
    audit(db, "delete", "release", row.id, row_dict(row)); db.delete(row); db.commit()


def safe_remote_url(url: str):
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(422, "Informe uma URL HTTP ou HTTPS válida")
    try:
        for result in socket.getaddrinfo(parsed.hostname, None):
            if ipaddress.ip_address(result[4][0]).is_private or ipaddress.ip_address(result[4][0]).is_loopback:
                raise HTTPException(422, "Endereço local não permitido")
    except socket.gaierror:
        raise HTTPException(422, "Não foi possível localizar o site")


def scrape_preview(url: str):
    safe_remote_url(url)
    try:
        response = requests.get(url, timeout=15, headers={"User-Agent": "HuaPlay Importer/1.0"})
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(422, f"Não foi possível ler a página: {exc}")
    if len(response.content) > 4_000_000: raise HTTPException(413, "Página muito grande")
    soup = BeautifulSoup(response.text, "html.parser")
    def meta(*names):
        for name in names:
            tag = soup.find("meta", property=name) or soup.find("meta", attrs={"name": name})
            if tag and tag.get("content"): return tag["content"].strip()
    title = meta("og:title", "twitter:title") or (soup.title.string.strip() if soup.title and soup.title.string else "")
    image = meta("og:image", "twitter:image")
    description = meta("og:description", "description")
    episode_map = {}
    for anchor in soup.find_all("a", href=True):
        text = " ".join(anchor.get_text(" ", strip=True).split())
        match = re.search(r"(?:epis[oó]dio|ep\.?)[\s:#-]*(\d+)", text, re.I)
        if match:
            number = int(match.group(1)); link = urljoin(url, anchor["href"])
            episode_map.setdefault(number, {"episode_number": number, "number": number,
                "title": f"Episódio {number}", "external_link": link, "url": link})
    return {"source_url": url, "title": title, "description": description, "synopsis": description,
            "cover_image": urljoin(url, image) if image else None,
            "cover_url": urljoin(url, image) if image else None,
            "banner_image": urljoin(url, image) if image else None,
            "episodes": list(episode_map.values())}


class ImportUrl(BaseModel):
    url: str


class ImportCommit(BaseModel):
    url: str
    title: Optional[str] = None
    genre: str = "Não informado"
    type: str = "Series"
    country: str = ""
    status: str = "Em andamento"
    release_year: int = Field(default_factory=lambda: datetime.now().year)
    import_episodes: bool = True
    selected_episode_urls: Optional[list[str]] = None


@admin_router.post("/import/preview")
def import_preview(data: ImportUrl, db: Session = Depends(get_db)):
    preview = scrape_preview(data.url)
    existing = db.query(models.Series).filter(func.lower(models.Series.title) == preview["title"].casefold()).first() if preview["title"] else None
    preview["existing_series_id"] = existing.id if existing else None
    return preview


@admin_router.post("/import/confirm", status_code=201)
@admin_router.post("/import/commit", status_code=201)
def import_commit(data: ImportCommit, db: Session = Depends(get_db)):
    preview = scrape_preview(data.url)
    title = (data.title or preview["title"] or "Conteúdo importado").strip()
    row = db.query(models.Series).filter(func.lower(models.Series.title) == title.casefold()).first()
    if not row:
        row = models.Series(title=title, description=preview["description"], cover_image=preview["cover_image"],
            banner_image=preview["banner_image"], genre=data.genre, type=data.type, country=data.country,
            status=data.status, release_year=data.release_year, publication_status="draft", created_at=datetime.now())
        db.add(row); db.flush()
    imported = 0
    if data.import_episodes:
        for ep in preview["episodes"]:
            if data.selected_episode_urls is not None and ep["url"] not in data.selected_episode_urls: continue
            if db.query(models.Episode.id).filter_by(series_id=row.id, episode_number=ep["episode_number"], season_number=1).first(): continue
            clean_ep = {key: ep[key] for key in ("episode_number", "title", "external_link")}
            db.add(models.Episode(series_id=row.id, publication_status="draft", created_at=datetime.now(), **clean_ep))
            imported += 1
    audit(db, "import", "series", row.id, {"url": data.url, "episodes": imported}); db.commit(); db.refresh(row)
    return {"series": row_dict(row), "episodes_imported": imported}


@admin_router.get("/genres")
def list_genres(db: Session = Depends(get_db)):
    counts = {}
    for raw, in db.query(models.Series.genre).filter(models.Series.genre.isnot(None)).all():
        for value in re.split(r"[,;|]", raw or ""):
            value = value.strip()
            if value: counts[value] = counts.get(value, 0) + 1
    known = {row.name.casefold(): row for row in db.query(models.CatalogGenre).all()}
    for name in counts:
        if name.casefold() not in known:
            db.add(models.CatalogGenre(name=name))
    db.commit()
    rows = db.query(models.CatalogGenre).order_by(models.CatalogGenre.name).all()
    return [{"id": row.id, "name": row.name, "series_count": counts.get(row.name, 0),
             "count": counts.get(row.name, 0)} for row in rows]


class GenreIn(BaseModel):
    name: str


@admin_router.post("/genres", status_code=201)
def create_genre(data: GenreIn, db: Session = Depends(get_db)):
    name = data.name.strip()
    if not name: raise HTTPException(422, "Nome obrigatório")
    if db.query(models.CatalogGenre).filter(func.lower(models.CatalogGenre.name) == name.casefold()).first():
        raise HTTPException(409, "Gênero já cadastrado")
    row = models.CatalogGenre(name=name); db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id, "name": row.name, "series_count": 0}


@admin_router.put("/genres/{genre_id}")
def update_genre(genre_id: int, data: GenreIn, db: Session = Depends(get_db)):
    row = db.get(models.CatalogGenre, genre_id)
    if not row: raise HTTPException(404, "Gênero não encontrado")
    old = row.name; row.name = data.name.strip()
    rename_genre(GenreChange(source=old, target=row.name), db)
    db.refresh(row); return {"id": row.id, "name": row.name}


@admin_router.delete("/genres/{genre_id}", status_code=204)
def delete_genre(genre_id: int, db: Session = Depends(get_db)):
    row = db.get(models.CatalogGenre, genre_id)
    if not row: raise HTTPException(404, "Gênero não encontrado")
    if db.query(models.Series.id).filter(models.Series.genre.ilike(f"%{row.name}%")).first():
        raise HTTPException(409, "Gênero ainda está em uso")
    db.delete(row); db.commit()


class GenreChange(BaseModel):
    source: Optional[str] = None
    target: Optional[str] = None
    source_id: Optional[int] = None
    target_id: Optional[int] = None


@admin_router.post("/genres/rename")
@admin_router.post("/genres/merge")
def rename_genre(data: GenreChange, db: Session = Depends(get_db)):
    source = data.source
    target = data.target
    if data.source_id:
        row = db.get(models.CatalogGenre, data.source_id); source = row.name if row else None
    if data.target_id:
        row = db.get(models.CatalogGenre, data.target_id); target = row.name if row else None
    if not source or not target: raise HTTPException(422, "Informe os gêneros de origem e destino")
    changed = 0
    for row in db.query(models.Series).filter(models.Series.genre.ilike(f"%{source}%")).all():
        parts = [part.strip() for part in re.split(r"([,;|])", row.genre or "")]
        row.genre = "".join(target if part.casefold() == source.strip().casefold() else part for part in parts)
        changed += 1
    if data.source_id and data.target_id:
        old = db.get(models.CatalogGenre, data.source_id)
        if old: db.delete(old)
    audit(db, "genre_rename", "genre", payload=data.model_dump() | {"changed": changed}); db.commit()
    return {"changed": changed}


@admin_router.get("/episodes")
def episode_center(search: Optional[str] = None, series_id: Optional[int] = None,
                   publication_status: Optional[str] = Query(None, alias="status"), missing_source: bool = False,
                   skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
                   page: Optional[int] = Query(None, ge=1), page_size: Optional[int] = Query(None, ge=1, le=200),
                   db: Session = Depends(get_db)):
    if page_size is not None: limit = page_size
    if page is not None: skip = (page - 1) * limit
    query = db.query(models.Episode)
    if search: query = query.filter(models.Episode.title.ilike(f"%{search}%"))
    if series_id: query = query.filter(models.Episode.series_id == series_id)
    if publication_status: query = query.filter(models.Episode.publication_status == publication_status)
    if missing_source:
        fields = [models.Episode.embed_url_1, models.Episode.embed_url_2, models.Episode.external_link,
                  models.Episode.download_link, models.Episode.youtube_link, models.Episode.drive_link,
                  models.Episode.mega_link, models.Episode.mediafire_link, models.Episode.pixeldrain_link]
        query = query.filter(*[or_(field.is_(None), field == "") for field in fields])
    total = query.count(); rows = query.order_by(models.Episode.created_at.desc()).offset(skip).limit(limit).all()
    series_names = dict(db.query(models.Series.id, models.Series.title).filter(
        models.Series.id.in_({row.series_id for row in rows})
    ).all()) if rows else {}
    items = []
    for row in rows:
        item = row_dict(row)
        item["series_title"] = series_names.get(row.series_id)
        item["video_url"] = row.embed_url_1 or row.embed_url_2 or row.youtube_link
        item["source_url"] = row.external_link or row.drive_link or row.mega_link or row.mediafire_link or row.pixeldrain_link
        items.append(item)
    return {"items": items, "total": total, "skip": skip, "limit": limit,
            "page": (skip // limit) + 1, "page_size": limit, "pages": max(1, (total + limit - 1) // limit)}


class EpisodeBatchIn(BaseModel):
    series_id: int
    season_number: int = 1
    start_number: int = Field(1, ge=0)
    count: int = Field(1, ge=1, le=100)
    title_template: str = "Episódio {number}"
    publication_status: Literal["draft", "review", "scheduled", "published", "archived"] = "draft"


@admin_router.post("/episodes/batch", status_code=201)
def episode_batch(data: EpisodeBatchIn, db: Session = Depends(get_db)):
    if not db.get(models.Series, data.series_id): raise HTTPException(404, "Série não encontrada")
    created = []
    for number in range(data.start_number, data.start_number + data.count):
        exists = db.query(models.Episode.id).filter_by(series_id=data.series_id, season_number=data.season_number, episode_number=number).first()
        if exists: continue
        row = models.Episode(series_id=data.series_id, season_number=data.season_number, episode_number=number,
            title=data.title_template.format(number=number), publication_status=data.publication_status, created_at=datetime.now())
        db.add(row); db.flush(); created.append(row_dict(row))
    audit(db, "batch_create", "episode", payload={"series_id": data.series_id, "count": len(created)}); db.commit()
    return {"created": created, "count": len(created)}


@admin_router.get("/analytics")
def analytics(period: str = "30d", db: Session = Depends(get_db)):
    top = db.query(models.Series).order_by(models.Series.views_count.desc()).limit(20).all()
    watched = db.query(models.Episode.series_id, func.count(models.WatchHistory.id)).join(
        models.WatchHistory, models.WatchHistory.episode_id == models.Episode.id).group_by(models.Episode.series_id).order_by(func.count(models.WatchHistory.id).desc()).limit(20).all()
    zero = db.query(models.SearchEvent.query, func.count(models.SearchEvent.id).label("count")).filter(
        models.SearchEvent.result_count == 0).group_by(models.SearchEvent.query).order_by(func.count(models.SearchEvent.id).desc()).limit(30).all()
    total_plays = db.query(func.count(models.WatchHistory.id)).scalar() or 0
    unique_viewers = db.query(func.count(func.distinct(models.WatchHistory.profile_id))).scalar() or 0
    searches = db.query(func.count(models.SearchEvent.id)).scalar() or 0
    completed = db.query(func.count(models.WatchHistory.id)).filter(models.WatchHistory.completed == True).scalar() or 0
    return {"total_plays": total_plays, "unique_viewers": unique_viewers, "searches": searches,
            "completion_rate": round((completed / total_plays * 100), 1) if total_plays else 0,
            "top_content": [{"id": r.id, "title": r.title, "views": r.views_count or 0} for r in top],
            "top_views": [{"id": r.id, "title": r.title, "views": r.views_count or 0} for r in top],
            "top_watched": [{"series_id": sid, "plays": count} for sid, count in watched],
            "searches_without_results": [{"query": query, "title": query, "count": count, "value": count} for query, count in zero]}


class SearchEventIn(BaseModel):
    query: str
    result_count: int = Field(0, ge=0)


@public_router.post("/analytics/search", status_code=204)
def record_search(data: SearchEventIn, db: Session = Depends(get_db)):
    if data.query.strip(): db.add(models.SearchEvent(query=data.query.strip()[:200], result_count=data.result_count)); db.commit()


class NotificationIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    message: str = Field(..., min_length=1, max_length=1000)
    image_url: Optional[str] = Field(None, max_length=500)
    action_url: Optional[str] = Field(None, max_length=500)
    audience: Literal["all", "web", "android"] = "all"
    status: Literal["draft", "scheduled", "published", "sent", "cancelled"] = "draft"
    scheduled_at: Optional[datetime] = None
    send_now: bool = False


@admin_router.get("/notifications/push-config-status")
def get_push_status():
    from fcm_service import get_fcm_config_status
    return get_fcm_config_status()


@admin_router.get("/notifications")
def list_notifications(db: Session = Depends(get_db)):
    return db.query(models.AdminNotification).order_by(models.AdminNotification.id.desc()).all()


@admin_router.post("/notifications", status_code=201)
def create_notification(data: NotificationIn, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    values = data.model_dump(exclude={"send_now"})
    if data.send_now:
        values.update(
            status="published",
            sent_at=now,
            push_status="pending",
            retry_count=0,
            next_retry_at=None,
        )
    elif data.scheduled_at:
        values["status"] = "scheduled"
        values["push_status"] = "pending"
        values["retry_count"] = 0
    else:
        values["status"] = "draft"
        values["push_status"] = "not_requested"

    row = models.AdminNotification(**values)
    db.add(row)
    db.flush()
    audit(db, "create", "notification", row.id)
    db.commit()
    db.refresh(row)
    return row


@admin_router.patch("/notifications/{item_id}")
@admin_router.put("/notifications/{item_id}")
def update_notification(item_id: int, data: NotificationIn, db: Session = Depends(get_db)):
    row = db.get(models.AdminNotification, item_id)
    if not row:
        raise HTTPException(404, "Notificação não encontrada")

    now = datetime.now(timezone.utc)
    was_published_or_sent = row.status in ("published", "sent")

    update_data = data.model_dump(exclude={"send_now"})
    for k, v in update_data.items():
        setattr(row, k, v)

    if data.send_now:
        row.status = "published"
        row.sent_at = now
        row.push_status = "pending"
        row.push_error = None
        row.retry_count = 0
        row.next_retry_at = None
        row.claimed_at = None
        row.claimed_by = None
    elif data.scheduled_at and row.status == "scheduled":
        pass
    elif row.status == "cancelled":
        row.push_status = "cancelled"
        row.claimed_at = None
        row.claimed_by = None
    elif was_published_or_sent:
        # Simple edit: preserve sent_at, push_status, retry counts to prevent duplicate broadcasts
        pass

    row.updated_at = now
    audit(db, "update", "notification", row.id)
    db.commit()
    db.refresh(row)
    return row


@admin_router.post("/notifications/{item_id}/dispatch-now")
def dispatch_notification_now(item_id: int, db: Session = Depends(get_db)):
    """Trigger immediate publishing and background push attempt."""
    row = db.get(models.AdminNotification, item_id)
    if not row:
        raise HTTPException(404, "Notificação não encontrada")

    now = datetime.now(timezone.utc)
    row.status = "published"
    row.sent_at = now
    row.push_status = "pending"
    row.push_error = None
    row.retry_count = 0
    row.next_retry_at = None
    row.claimed_at = None
    row.claimed_by = None
    row.updated_at = now

    audit(db, "dispatch_now", "notification", row.id)
    db.commit()
    db.refresh(row)
    return row


@admin_router.post("/notifications/{item_id}/cancel")
def cancel_notification(item_id: int, db: Session = Depends(get_db)):
    """Cancel a scheduled or draft notification."""
    row = db.get(models.AdminNotification, item_id)
    if not row:
        raise HTTPException(404, "Notificação não encontrada")

    row.status = "cancelled"
    row.push_status = "cancelled"
    row.claimed_at = None
    row.claimed_by = None
    row.updated_at = datetime.now(timezone.utc)

    audit(db, "cancel", "notification", row.id)
    db.commit()
    db.refresh(row)
    return row


@admin_router.delete("/notifications/{item_id}", status_code=204)
def delete_notification(item_id: int, db: Session = Depends(get_db)):
    row = db.get(models.AdminNotification, item_id)
    if not row:
        raise HTTPException(404, "Notificação não encontrada")
    audit(db, "delete", "notification", row.id, row_dict(row))
    db.delete(row)
    db.commit()


class HomeDraftIn(BaseModel):
    sections: list[dict[str, Any]]


@admin_router.get("/home-layout")
def get_home_layout(db: Session = Depends(get_db)):
    draft = db.query(models.HomeLayoutVersion).filter_by(status="draft").order_by(models.HomeLayoutVersion.id.desc()).first()
    published = db.query(models.HomeLayoutVersion).filter_by(status="published").order_by(models.HomeLayoutVersion.id.desc()).first()
    return {"draft": json.loads(draft.payload) if draft else None, "draft_id": draft.id if draft else None,
            "published": json.loads(published.payload) if published else None, "published_id": published.id if published else None}


@admin_router.put("/home-layout/draft")
def save_home_draft(data: HomeDraftIn, db: Session = Depends(get_db)):
    row = db.query(models.HomeLayoutVersion).filter_by(status="draft").order_by(models.HomeLayoutVersion.id.desc()).first()
    if not row: row = models.HomeLayoutVersion(status="draft"); db.add(row)
    row.payload = json.dumps(data.sections, ensure_ascii=False); db.flush(); audit(db, "save_draft", "home_layout", row.id); db.commit(); return {"id": row.id, "sections": data.sections}


@admin_router.post("/home-layout/publish")
def publish_home_draft(db: Session = Depends(get_db)):
    row = db.query(models.HomeLayoutVersion).filter_by(status="draft").order_by(models.HomeLayoutVersion.id.desc()).first()
    if not row: raise HTTPException(404, "Nenhum rascunho salvo")
    db.query(models.HomeLayoutVersion).filter_by(status="published").update({"status": "archived"})
    row.status = "published"; row.published_at = datetime.now(timezone.utc)
    audit(db, "publish", "home_layout", row.id); db.commit(); return {"id": row.id, "published_at": row.published_at}


@admin_router.get("/home-preview")
def home_preview(db: Session = Depends(get_db)):
    from routers.admin import home_section_payload
    sections = db.query(models.HomeSection).order_by(models.HomeSection.position, models.HomeSection.id).all()
    section_payloads = [home_section_payload(row, db) for row in sections]
    for section in section_payloads:
        for item in section["items"]:
            item.cover_url = item.cover_image
            item.banner = item.banner_image
    banners = list_hero_slides(db)
    hero = None
    if banners:
        first = banners[0]
        hero = {"id": first.id, "title": first.title, "banner": first.image_url, "cover_url": first.image_url}
    else:
        # Keep the preview faithful to the public Home even before the editor
        # has its first custom banner: use the current catalog highlight.
        featured = db.query(models.Series).filter(
            models.Series.is_featured == True,
            models.Series.banner_image.isnot(None),
            models.Series.banner_image != "",
        ).first()
        if not featured:
            config = db.query(models.FeaturedConfig).first()
            if config and config.manual_series_id:
                featured = db.query(models.Series).filter(
                    models.Series.id == config.manual_series_id,
                    models.Series.banner_image.isnot(None),
                    models.Series.banner_image != "",
                ).first()
        if not featured:
            featured = db.query(models.Series).filter(
                models.Series.banner_image.isnot(None),
                models.Series.banner_image != "",
            ).order_by(models.Series.views_count.desc(), models.Series.id.desc()).first()
        if featured:
            hero = {"id": featured.id, "title": featured.title,
                    "banner": featured.banner_image, "cover_url": featured.cover_image}
    return {"hero": hero, "sections": section_payloads,
            "hero_banners": banners, "generated_at": datetime.now(timezone.utc)}


@admin_router.get("/history")
@admin_router.get("/audit")
def list_audit(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    rows = db.query(models.AdminAuditLog).order_by(models.AdminAuditLog.id.desc()).limit(limit).all()
    return [row_dict(row) | {"description": f"{row.action} · {row.entity_type}"} for row in rows]


@admin_router.get("/trash")
def list_trash(db: Session = Depends(get_db)):
    rows = db.query(models.TrashItem).filter(models.TrashItem.restored_at.is_(None)).order_by(models.TrashItem.id.desc()).all()
    return [row_dict(row) | {"kind": row.entity_type, "item_id": row.entity_id, "title": row.label} for row in rows]


@admin_router.post("/trash/{kind}/{item_id}", status_code=201)
def move_to_trash(kind: Literal["series", "episode"], item_id: int, db: Session = Depends(get_db)):
    model = models.Series if kind == "series" else models.Episode
    row = db.get(model, item_id)
    if not row: raise HTTPException(404, "Conteúdo não encontrado")
    payload = row_dict(row)
    if kind == "series": payload["episodes"] = [row_dict(ep) for ep in row.episodes]
    trash = models.TrashItem(entity_type=kind, entity_id=item_id, label=row.title,
                             payload=json.dumps(payload, ensure_ascii=False, default=str))
    db.add(trash); db.delete(row); db.flush(); audit(db, "trash", kind, item_id); db.commit(); db.refresh(trash); return trash


@admin_router.post("/trash/{trash_id}/restore")
def restore_trash(trash_id: int, db: Session = Depends(get_db)):
    trash = db.get(models.TrashItem, trash_id)
    if not trash or trash.restored_at: raise HTTPException(404, "Item não encontrado na lixeira")
    data = json.loads(trash.payload); episodes = data.pop("episodes", [])
    model = models.Series if trash.entity_type == "series" else models.Episode
    if db.get(model, data.get("id")): data.pop("id", None)
    row = model(**{k: v for k, v in data.items() if hasattr(model, k)})
    db.add(row); db.flush()
    if trash.entity_type == "series":
        for ep_data in episodes:
            ep_data["series_id"] = row.id
            if db.get(models.Episode, ep_data.get("id")): ep_data.pop("id", None)
            db.add(models.Episode(**{k: v for k, v in ep_data.items() if hasattr(models.Episode, k)}))
    trash.restored_at = datetime.now(timezone.utc); audit(db, "restore", trash.entity_type, row.id); db.commit()
    return {"restored": True, "id": row.id}


@admin_router.post("/trash/{resource}/{trash_id}/restore")
def restore_trash_alias(resource: str, trash_id: int, db: Session = Depends(get_db)):
    return restore_trash(trash_id, db)


@admin_router.post("/maintenance/scan")
@admin_router.get("/maintenance")
@admin_router.get("/maintenance/scan")
def maintenance_scan(db: Session = Depends(get_db)):
    series = db.query(models.Series).all(); episodes = db.query(models.Episode).all()
    missing_images = [{"id": r.id, "title": r.title, "missing": [k for k in ("cover_image", "banner_image") if not getattr(r, k)]} for r in series if not r.cover_image or not r.banner_image]
    missing_links = [{"id": e.id, "series_id": e.series_id, "title": e.title} for e in episodes if not any(
        getattr(e, k) for k in ("embed_url_1", "embed_url_2", "external_link", "youtube_link", "drive_link", "mega_link", "mediafire_link", "pixeldrain_link"))]
    duplicates = db.query(models.Episode.series_id, models.Episode.season_number, models.Episode.episode_number,
        func.count(models.Episode.id)).group_by(models.Episode.series_id, models.Episode.season_number,
        models.Episode.episode_number).having(func.count(models.Episode.id) > 1).all()
    incomplete = []
    for r in series:
        if (r.status or "").casefold() in {"completo", "completed", "concluído", "concluido"}:
            nums = sorted({e.episode_number for e in r.episodes if (e.season_number or 1) == 1})
            missing = [n for n in range(1, max(nums) + 1) if n not in nums] if nums else [1]
            if missing: incomplete.append({"id": r.id, "title": r.title, "missing_episodes": missing})
    issues = []
    for item in missing_images:
        issues.append({"id": f"image-{item['id']}", "type": "broken_image", "title": item["title"],
                       "message": "Falta " + " e ".join(item["missing"]), "severity": "warning", "fixable": False})
    for item in missing_links:
        issues.append({"id": f"link-{item['id']}", "type": "broken_link", "title": item["title"],
                       "message": "Episódio sem link de reprodução", "severity": "critical", "fixable": False})
    for sid, season, episode, count in duplicates:
        issues.append({"id": f"duplicate-{sid}-{season}-{episode}", "type": "duplicate",
                       "title": f"Episódio {episode} duplicado", "message": f"{count} registros na temporada {season}",
                       "severity": "warning", "fixable": False})
    for item in incomplete:
        issues.append({"id": f"incomplete-{item['id']}", "type": "incomplete", "title": item["title"],
                       "message": "Marcada como completa, mas faltam episódios: " + ", ".join(map(str, item["missing_episodes"])),
                       "severity": "warning", "fixable": False})
    return {"issues": issues, "summary": {"missing_images": len(missing_images), "missing_links": len(missing_links),
        "duplicates": len(duplicates), "incomplete_completed": len(incomplete)}, "missing_images": missing_images,
        "missing_links": missing_links, "duplicates": [{"series_id": a, "season": b, "episode": c, "count": d} for a,b,c,d in duplicates],
        "incomplete_completed": incomplete, "checked_at": datetime.now(timezone.utc)}


class MaintenanceFix(BaseModel):
    issue_id: str


@admin_router.post("/maintenance/fix")
def maintenance_fix(data: MaintenanceFix):
    return {"fixed": False, "issue_id": data.issue_id,
            "message": "Abra o conteúdo para revisar este item com segurança."}
