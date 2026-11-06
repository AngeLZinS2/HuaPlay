from datetime import datetime, time, timedelta, timezone
from typing import Literal, Optional
import random

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

public_router = APIRouter(tags=["reports"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])

COUNTRY_ALIASES = {
    "coreia": "South Korea",
    "coreia do sul": "South Korea",
    "korea": "South Korea",
    "south korea": "South Korea",
    "tailândia": "Thailand",
    "tailandia": "Thailand",
    "thailand": "Thailand",
    "china": "China",
    "japão": "Japan",
    "japao": "Japan",
    "japan": "Japan",
    "taiwan": "Taiwan",
    "filipinas": "Philippines",
    "philippines": "Philippines",
    "vietnã": "Vietnam",
    "vietnam": "Vietnam",
}

EDITORIAL_PRESETS = [
    {
        "key": "popular",
        "title": "Em Alta no HuaPlay",
        "section_type": "popular",
        "filter_value": "",
        "item_limit": 18,
        "is_anchor": True,
        "badge": "Mais Assistidos",
        "description": "Os doramas mais assistidos e populares da plataforma.",
    },
    {
        "key": "latest",
        "title": "Novos Lançamentos",
        "section_type": "latest",
        "filter_value": "",
        "item_limit": 18,
        "is_anchor": True,
        "badge": "Lançamentos Recentes",
        "description": "Últimas produções asiáticas adicionadas ao catálogo.",
    },
    {
        "key": "wuxia",
        "title": "Dramas de Época, Wuxia & Xianxia",
        "section_type": "genre",
        "filter_value": "Wuxia",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "C-Drama Épico",
        "description": "Artes marciais chinesas, dinastias imperiais e fantasia heroica.",
    },
    {
        "key": "korea",
        "title": "Doramas Coreanos em Destaque",
        "section_type": "country",
        "filter_value": "South Korea",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "K-Drama",
        "description": "O melhor dos K-Dramas com elencos aclamados e produções de ponta.",
    },
    {
        "key": "thailand",
        "title": "Sucessos da Tailândia & Lakorns",
        "section_type": "country",
        "filter_value": "Thailand",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "Thai Drama",
        "description": "Romances dramáticos, lakorns e as séries tailandesas mais amadas.",
    },
    {
        "key": "romcom",
        "title": "Comédias Românticas Imperdíveis",
        "section_type": "genre",
        "filter_value": "Comédia",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "Rom-Com",
        "description": "Histórias apaixonantes, leves e repletas de momentos divertidos.",
    },
    {
        "key": "youth",
        "title": "Romance Escolar & Juventude",
        "section_type": "genre",
        "filter_value": "Youth",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "Juventude",
        "description": "Primeiro amor, amizades inesquecíveis e nostalgia dos tempos de colégio.",
    },
    {
        "key": "contract",
        "title": "Casamento por Contrato & Coabitação",
        "section_type": "genre",
        "filter_value": "Contrato",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "Tropo Amado",
        "description": "Casamentos falsos e convivências forçadas que viram amor verdadeiro.",
    },
    {
        "key": "bl",
        "title": "Séries BL & LGBTQIA+ Asiáticas",
        "section_type": "genre",
        "filter_value": "LGBTQIA+",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "Boys Love",
        "description": "Grandes romances Boys Love e produções LGBTQIA+ da Tailândia e Ásia.",
    },
    {
        "key": "minis",
        "title": "Mini-Dramas & Web-Séries Chinesas",
        "section_type": "genre",
        "filter_value": "Minis",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "Minis",
        "description": "Dramas chineses em episódios rápidos, intensos e viciantes.",
    },
    {
        "key": "movies",
        "title": "Sessão de Cinema Asiático",
        "section_type": "type",
        "filter_value": "Movie",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "Filmes",
        "description": "Longas-metragens emocionantes dos cinemas chinês, coreano e japonês.",
    },
    {
        "key": "fantasy",
        "title": "Fantasia, Sobrenatural & Mitologia",
        "section_type": "genre",
        "filter_value": "Fantasy",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "Xianxia & Magia",
        "description": "Reinos imortais, magia, reencarnação e seres sobrenaturais.",
    },
    {
        "key": "mystery",
        "title": "Mistério, Crime & Suspense",
        "section_type": "genre",
        "filter_value": "Mistério",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "Suspense",
        "description": "Investigações intrigantes, segredos do passado e suspense psicológico.",
    },
    {
        "key": "office",
        "title": "Romances de Escritório & Trabalho",
        "section_type": "genre",
        "filter_value": "Escritório",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "Office Romance",
        "description": "Chefes exigentes, química irresistível e romances no ambiente corporativo.",
    },
    {
        "key": "japan",
        "title": "Dramas Japoneses (J-Dramas)",
        "section_type": "country",
        "filter_value": "Japan",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "J-Drama",
        "description": "A delicadeza, o humor e as histórias tocantes da televisão japonesa.",
    },
    {
        "key": "taiwan",
        "title": "Romances de Taiwan",
        "section_type": "country",
        "filter_value": "Taiwan",
        "item_limit": 18,
        "is_anchor": False,
        "badge": "TW-Drama",
        "description": "Dramas românticos taiwaneses envolventes com fortes emoções.",
    },
]


def resolve_home_section_items(section: models.HomeSection, db: Session):
    query = db.query(models.Series).filter(models.Series.publication_status == "published")
    limit = max(1, min(section.item_limit or 18, 30))
    kind = section.section_type
    value = (section.filter_value or "").strip()

    if kind == "manual":
        ids = [int(raw.strip()) for raw in (section.series_ids or "").split(",") if raw.strip().isdigit()]
        if not ids:
            return []
        rows = query.filter(models.Series.id.in_(ids[:30])).all()
        order = {series_id: index for index, series_id in enumerate(ids)}
        return sorted(rows, key=lambda item: order.get(item.id, len(order)))[:limit]
    if kind == "popular":
        return query.order_by(models.Series.views_count.desc(), models.Series.id.desc()).limit(limit).all()
    if kind == "genre" and value:
        query = query.filter(models.Series.genre.ilike(f"%{value}%"))
    elif kind == "type" and value:
        query = query.filter(models.Series.type == value)
    elif kind == "country" and value:
        mapped = COUNTRY_ALIASES.get(value.lower().strip(), value)
        query = query.filter(or_(models.Series.country.ilike(f"%{value}%"), models.Series.country.ilike(f"%{mapped}%")))
    elif kind == "status" and value:
        query = query.filter(models.Series.status == value)
    return query.order_by(models.Series.created_at.desc(), models.Series.id.desc()).limit(limit).all()


def home_section_payload(section: models.HomeSection, db: Session):
    return {
        "id": section.id, "title": section.title, "section_type": section.section_type,
        "filter_value": section.filter_value, "series_ids": section.series_ids,
        "item_limit": section.item_limit, "position": section.position,
        "is_active": section.is_active, "created_at": section.created_at,
        "updated_at": section.updated_at, "items": resolve_home_section_items(section, db),
    }


@public_router.get("/home/sections", response_model=list[schemas.HomeSection])
def get_public_home_sections(db: Session = Depends(get_db)):
    sections = db.query(models.HomeSection).filter(models.HomeSection.is_active == True).order_by(
        models.HomeSection.position.asc(), models.HomeSection.id.asc()
    ).all()
    return [home_section_payload(section, db) for section in sections]


@admin_router.get("/home-sections", response_model=list[schemas.HomeSection])
def list_home_sections(db: Session = Depends(get_db)):
    sections = db.query(models.HomeSection).order_by(
        models.HomeSection.position.asc(), models.HomeSection.id.asc()
    ).all()
    return [home_section_payload(section, db) for section in sections]


@admin_router.get("/home-section-options")
def get_home_section_options(db: Session = Depends(get_db)):
    """Return the values already used by catalog items for the Home editor."""
    genre_values = db.query(models.Series.genre).filter(
        models.Series.genre.isnot(None), models.Series.genre != ""
    ).all()
    genres_by_key = {}
    for (raw_value,) in genre_values:
        for genre in str(raw_value).replace(";", ",").replace("|", ",").split(","):
            cleaned = genre.strip()
            if cleaned:
                genres_by_key.setdefault(cleaned.casefold(), cleaned)
    for row in db.query(models.CatalogGenre).all():
        genres_by_key.setdefault(row.name.casefold(), row.name)
    return {"genres": sorted(genres_by_key.values(), key=str.casefold)}


@admin_router.post("/home-sections/reorder", response_model=list[schemas.HomeSection])
def reorder_home_sections(data: schemas.HomeSectionReorder, db: Session = Depends(get_db)):
    sections = db.query(models.HomeSection).all()
    by_id = {section.id: section for section in sections}
    if set(data.ids) != set(by_id):
        raise HTTPException(status_code=422, detail="A ordem deve conter todas as seções uma única vez")
    for position, section_id in enumerate(data.ids):
        by_id[section_id].position = position
    db.commit()
    ordered = [by_id[section_id] for section_id in data.ids]
    return [home_section_payload(section, db) for section in ordered]


@admin_router.post("/home-sections", response_model=schemas.HomeSection, status_code=status.HTTP_201_CREATED)
def create_home_section(data: schemas.HomeSectionCreate, db: Session = Depends(get_db)):
    payload = data.model_dump()
    payload["title"] = payload["title"].strip()
    if not payload["title"]:
        raise HTTPException(status_code=422, detail="O título da fileira é obrigatório")
    payload["item_limit"] = max(1, min(payload["item_limit"], 30))
    max_position = db.query(func.max(models.HomeSection.position)).scalar()
    payload["position"] = (max_position + 1) if max_position is not None else 0
    section = models.HomeSection(**payload)
    db.add(section)
    db.commit()
    db.refresh(section)
    return home_section_payload(section, db)


@admin_router.put("/home-sections/{section_id}", response_model=schemas.HomeSection)
def update_home_section(section_id: int, data: schemas.HomeSectionUpdate, db: Session = Depends(get_db)):
    section = db.query(models.HomeSection).filter(models.HomeSection.id == section_id).first()
    if section is None:
        raise HTTPException(status_code=404, detail="Fileira não encontrada")
    values = data.model_dump(exclude_unset=True)
    if "title" in values:
        values["title"] = (values["title"] or "").strip()
        if not values["title"]:
            raise HTTPException(status_code=422, detail="O título da fileira é obrigatório")
    if "item_limit" in values and values["item_limit"] is not None:
        values["item_limit"] = max(1, min(values["item_limit"], 30))
    for key, value in values.items():
        setattr(section, key, value)
    db.commit()
    db.refresh(section)
    return home_section_payload(section, db)


@admin_router.delete("/home-sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_home_section(section_id: int, db: Session = Depends(get_db)):
    section = db.query(models.HomeSection).filter(models.HomeSection.id == section_id).first()
    if section is None:
        raise HTTPException(status_code=404, detail="Fileira não encontrada")
    db.delete(section)
    db.commit()
    remaining = db.query(models.HomeSection).order_by(models.HomeSection.position.asc()).all()
    for position, item in enumerate(remaining):
        item.position = position
    db.commit()
    return None


@admin_router.get("/home-section-presets")
def get_home_section_presets(db: Session = Depends(get_db)):
    """Return all curated Asian presets with catalog match counts and added status."""
    existing_sections = db.query(models.HomeSection).all()
    existing_keys = {(s.section_type, (s.filter_value or "").strip().lower()) for s in existing_sections}
    existing_titles = {s.title.strip().lower() for s in existing_sections}

    results = []
    for preset in EDITORIAL_PRESETS:
        kind = preset["section_type"]
        val = (preset["filter_value"] or "").strip()
        mapped = COUNTRY_ALIASES.get(val.lower(), val) if kind == "country" else val

        q = db.query(func.count(models.Series.id)).filter(models.Series.publication_status == "published")
        if kind == "country":
            q = q.filter(or_(models.Series.country.ilike(f"%{val}%"), models.Series.country.ilike(f"%{mapped}%")))
        elif kind == "genre":
            q = q.filter(models.Series.genre.ilike(f"%{val}%"))
        elif kind == "type":
            q = q.filter(models.Series.type == val)

        count = q.scalar() or 0
        is_added = (kind, val.lower()) in existing_keys or preset["title"].strip().lower() in existing_titles

        results.append({
            **preset,
            "count": count,
            "is_added": is_added,
        })
    return results


@admin_router.post("/home-sections/auto-curate", response_model=list[schemas.HomeSection])
def auto_curate_home_sections(db: Session = Depends(get_db)):
    """Apply the complete, curated Asian drama catalog lineup (12-16 sections)."""
    db.query(models.HomeSection).delete()
    db.commit()

    created = []
    pos = 0
    for preset in EDITORIAL_PRESETS:
        kind = preset["section_type"]
        val = preset["filter_value"]
        if not preset.get("is_anchor"):
            mapped = COUNTRY_ALIASES.get(val.lower(), val) if kind == "country" else val
            q = db.query(func.count(models.Series.id)).filter(models.Series.publication_status == "published")
            if kind == "country":
                q = q.filter(or_(models.Series.country.ilike(f"%{val}%"), models.Series.country.ilike(f"%{mapped}%")))
            elif kind == "genre":
                q = q.filter(models.Series.genre.ilike(f"%{val}%"))
            elif kind == "type":
                q = q.filter(models.Series.type == val)
            if (q.scalar() or 0) < 8:
                continue

        section = models.HomeSection(
            title=preset["title"],
            section_type=preset["section_type"],
            filter_value=preset["filter_value"],
            item_limit=preset.get("item_limit", 18),
            position=pos,
            is_active=True,
        )
        db.add(section)
        created.append(section)
        pos += 1

    db.commit()
    for s in created:
        db.refresh(s)
    return [home_section_payload(s, db) for s in created]


@admin_router.post("/home-sections/rotate", response_model=list[schemas.HomeSection])
def rotate_home_sections(db: Session = Depends(get_db)):
    """Keep anchors (positions 0 & 1) fixed and shuffle the thematic rows."""
    sections = db.query(models.HomeSection).order_by(models.HomeSection.position.asc()).all()
    if len(sections) > 3:
        anchors = sections[:2]
        thematics = list(sections[2:])
        random.shuffle(thematics)
        all_ordered = anchors + thematics
        for pos, s in enumerate(all_ordered):
            s.position = pos
        db.commit()
    sections = db.query(models.HomeSection).order_by(models.HomeSection.position.asc()).all()
    return [home_section_payload(s, db) for s in sections]


@admin_router.post("/home-sections/add-preset", response_model=schemas.HomeSection, status_code=status.HTTP_201_CREATED)
def add_preset_home_section(data: dict, db: Session = Depends(get_db)):
    """Add a specific preset directly to the Home."""
    preset_key = data.get("key")
    preset = next((p for p in EDITORIAL_PRESETS if p["key"] == preset_key), None)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset não encontrado")

    max_position = db.query(func.max(models.HomeSection.position)).scalar()
    new_pos = (max_position + 1) if max_position is not None else 0
    section = models.HomeSection(
        title=preset["title"],
        section_type=preset["section_type"],
        filter_value=preset["filter_value"],
        item_limit=preset.get("item_limit", 18),
        position=new_pos,
        is_active=True,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return home_section_payload(section, db)


@public_router.post("/reports", response_model=schemas.PlaybackReport, status_code=status.HTTP_201_CREATED)
def create_playback_report(report: schemas.PlaybackReportCreate, db: Session = Depends(get_db)):
    if report.series_id is not None and db.query(models.Series.id).filter(models.Series.id == report.series_id).first() is None:
        raise HTTPException(status_code=404, detail="Series not found")
    if report.episode_id is not None and db.query(models.Episode.id).filter(models.Episode.id == report.episode_id).first() is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    values = report.model_dump()
    # Support both the UI's descriptive field and the generic API alias while
    # preserving page_url and source_url as separate diagnostic values.
    values["reason"] = values["reason"] or values["category"]
    values["message"] = values.pop("description") or values["message"]
    row = models.PlaybackReport(**values)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@admin_router.get("/dashboard")
def get_admin_dashboard(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    week_ago = now - timedelta(days=7)
    series = models.Series
    episode_count = db.query(func.count(models.Episode.id)).scalar() or 0
    series_without_episodes = db.query(func.count(series.id)).filter(~series.episodes.any()).scalar() or 0

    def missing_count(column):
        return db.query(func.count(series.id)).filter(or_(column.is_(None), func.trim(column) == "")).scalar() or 0

    missing_episode_sources = db.query(func.count(models.Episode.id)).filter(
        *[or_(column.is_(None), func.trim(column) == "") for column in (
            models.Episode.embed_url_1, models.Episode.embed_url_2, models.Episode.download_link,
            models.Episode.external_link, models.Episode.drive_link, models.Episode.mega_link,
            models.Episode.mediafire_link, models.Episode.pixeldrain_link, models.Episode.youtube_link,
        )]
    ).scalar() or 0
    new_today = db.query(func.count(series.id)).filter(series.created_at >= today).scalar() or 0
    new_7d = db.query(func.count(series.id)).filter(series.created_at >= week_ago).scalar() or 0
    recent_episodes_today = db.query(func.count(models.Episode.id)).filter(models.Episode.created_at >= today).scalar() or 0
    recent_episodes_7d = db.query(func.count(models.Episode.id)).filter(models.Episode.created_at >= week_ago).scalar() or 0
    top = db.query(series).order_by(series.views_count.desc(), series.id.desc()).limit(10).all()
    recent_series = db.query(series).order_by(series.created_at.desc(), series.id.desc()).limit(10).all()
    total_views = db.query(func.coalesce(func.sum(series.views_count), 0)).scalar() or 0
    health = {"series_without_episodes": series_without_episodes,
              "series_without_cover": missing_count(series.cover_image),
              "series_without_banner": missing_count(series.banner_image),
              "series_without_synopsis": missing_count(series.description),
              "series_without_trailer": missing_count(series.trailer_url),
              "episodes_without_source": missing_episode_sources}
    total_series = db.query(func.count(series.id)).scalar() or 0
    total_actors = db.query(func.count(models.Actor.id)).scalar() or 0
    top_content = [{"id": item.id, "title": item.title, "type": item.type,
                    "cover_image": item.cover_image, "views_count": item.views_count or 0}
                   for item in top]
    recent_content = [{"id": item.id, "title": item.title, "type": item.type,
                       "cover_image": item.cover_image, "views_count": item.views_count or 0,
                       "created_at": item.created_at}
                      for item in recent_series]
    health_labels = {
        "series_without_episodes": "Séries sem episódios",
        "series_without_cover": "Séries sem capa",
        "series_without_banner": "Séries sem banner",
        "series_without_synopsis": "Séries sem sinopse",
        "series_without_trailer": "Séries sem trailer",
        "episodes_without_source": "Episódios sem fonte",
    }
    quality_alerts = [
        {"label": health_labels.get(key, key), "count": count, "href": "/admin/health"}
        for key, count in health.items() if count
    ]

    return {
        "catalog": {"series": total_series, "episodes": episode_count, "actors": total_actors},
        "content_health": health,
        "recent": {"series_today": new_today, "series_7d": new_7d,
                   "episodes_today": recent_episodes_today, "episodes_7d": recent_episodes_7d},
        "top_by_views": [{"id": item.id, "title": item.title, "views_count": item.views_count or 0} for item in top],
        # Flat aliases keep the admin screens compatible with their existing
        # dashboard contract while the grouped fields expose the richer metrics.
        "total_content": total_series,
        "total_series": total_series,
        "total_episodes": episode_count,
        "total_actors": total_actors,
        "total_views": total_views,
        "quality_alerts": quality_alerts,
        "top_content": top_content,
        "recent_content": recent_content,
    }


@admin_router.get("/catalog/health")
@admin_router.get("/catalog-health")
def get_catalog_health(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=100),
    search: Optional[str] = Query(None, max_length=100),
    issue_type: Literal["all", "cover", "banner", "synopsis", "trailer", "episodes", "source"] = "all",
    severity: Literal["all", "warning", "critical"] = "all",
    db: Session = Depends(get_db),
):
    series = db.query(models.Series).all()
    episodes = db.query(models.Episode).all()
    summary = get_admin_dashboard(db)["content_health"]
    issues_by_series = {
        item.id: {
            "id": f"series-{item.id}", "series_id": item.id,
            "title": item.title, "series_title": item.title,
            "missing": [], "episodes_without_source": 0,
            "severity": "warning",
        }
        for item in series
    }
    series_checks = (
        ("cover_image", "capa"), ("banner_image", "banner"),
        ("description", "sinopse"), ("trailer_url", "trailer"),
    )
    for item in series:
        issue = issues_by_series[item.id]
        for attribute, field_name in series_checks:
            if not (getattr(item, attribute) or "").strip():
                issue["missing"].append(field_name)
        if not item.episodes:
            issue["missing"].append("episódios")
    source_fields = ("embed_url_1", "embed_url_2", "download_link", "external_link", "drive_link",
                     "mega_link", "mediafire_link", "pixeldrain_link", "youtube_link")
    for episode in episodes:
        if not any((getattr(episode, field) or "").strip() for field in source_fields):
            issue = issues_by_series.get(episode.series_id)
            if issue:
                issue["episodes_without_source"] += 1
                issue["severity"] = "critical"

    issues = []
    for issue in issues_by_series.values():
        descriptions = []
        if issue["missing"]:
            descriptions.append("Falta: " + ", ".join(issue["missing"]))
        source_count = issue["episodes_without_source"]
        if source_count:
            suffix = "episódio sem fonte de reprodução" if source_count == 1 else "episódios sem fonte de reprodução"
            descriptions.append(f"{source_count} {suffix}")
        if descriptions:
            issue["label"] = "; ".join(descriptions)
            issues.append(issue)

    if search:
        needle = search.strip().casefold()
        issues = [issue for issue in issues if needle in (issue["title"] or "").casefold()]
    if severity != "all":
        issues = [issue for issue in issues if issue["severity"] == severity]
    if issue_type != "all":
        issue_fields = {
            "cover": "capa", "banner": "banner", "synopsis": "sinopse",
            "trailer": "trailer", "episodes": "episódios",
        }
        if issue_type == "source":
            issues = [issue for issue in issues if issue["episodes_without_source"] > 0]
        else:
            field_name = issue_fields[issue_type]
            issues = [issue for issue in issues if field_name in issue["missing"]]

    issues.sort(key=lambda issue: (issue["severity"] != "critical", (issue["title"] or "").casefold()))
    total = len(issues)
    total_pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, total_pages)
    offset = (page - 1) * page_size
    page_items = issues[offset:offset + page_size]
    return {"summary": summary, "issues": page_items, "total": total,
            "page": page, "page_size": page_size, "total_pages": total_pages,
            "checked_at": datetime.now(timezone.utc).isoformat()}


@admin_router.get("/reports", response_model=list[schemas.PlaybackReport])
def list_playback_reports(
    report_status: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(models.PlaybackReport)
    if report_status:
        query = query.filter(models.PlaybackReport.status == report_status)
    return query.order_by(models.PlaybackReport.created_at.desc(), models.PlaybackReport.id.desc()).offset(skip).limit(limit).all()


@admin_router.patch("/reports/{report_id}", response_model=schemas.PlaybackReport)
def update_playback_report(report_id: int, changes: schemas.PlaybackReportUpdate, db: Session = Depends(get_db)):
    row = db.query(models.PlaybackReport).filter(models.PlaybackReport.id == report_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Report not found")
    values = changes.model_dump(exclude_unset=True)
    if "status" in values and values["status"] not in {"open", "in_progress", "resolved", "dismissed"}:
        raise HTTPException(status_code=422, detail="Invalid report status")
    for key, value in values.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row
