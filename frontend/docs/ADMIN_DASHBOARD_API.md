# Contrato da área administrativa

Os nomes dos endpoints abaixo foram conferidos com `backend/routers/admin.py`.

## `GET /admin/dashboard`

A Visão geral consome os campos `total_content`, `total_episodes`, `total_actors`, `total_views`, `quality_alerts`, `top_content` e `recent_content`. Aceita dados agregados como `catalog`, `content_health` e `top_by_views` para futuras ampliações. Se o endpoint falhar, tenta compatibilidade com `/series/stats`, `/actors/` e `/series/`; nesse fallback não há métricas de qualidade e reprodução.

## `GET /admin/catalog/health`

Retorna `{ "summary": { "series_without_cover": 2 }, "issues": [...] }`. Cada ocorrência da resposta atual pode trazer `id`, `series_id`, `title`, `label` e `severity`. Também aceita `series_title`, `issue`, `message` e `href` para compatibilidade.

## `GET /admin/reports?status=open`

Retorna uma lista de relatos, cada um com `id`, `series_id`, `episode_id`, `reason`, `message`, `page_url`, `source_url`, `status`, `admin_note` e datas de criação/atualização. Os filtros aceitos pela tela são `open`, `in_progress`, `resolved`, `dismissed` e `all` (sem parâmetro).

## `PATCH /admin/reports/{id}`

Ações de status enviam `{ "status": "resolved", "admin_note": "..." }`. Status válidos no backend: `open`, `in_progress`, `resolved` e `dismissed`.
