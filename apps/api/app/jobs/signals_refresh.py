"""Signals cycle refresh — RSS pull + Sonnet distill + persist.

For MVP we use a small hand-curated feed list per category and skip the
per-user personalization layer. Distillation is a non-streaming Sonnet call
with structured tool-output for clean JSON.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import feedparser

from app.core.db import SessionLocal
from app.core.log import log
from app.integrations.anthropic import MODEL_IDS, get_client
from app.integrations.voyage import embed
from app.models import Signal


# Hand-curated v1 sources. Tune over time.
FEEDS: dict[str, list[tuple[str, str]]] = {
    "global": [
        ("Reuters Top News", "https://feeds.reuters.com/reuters/topNews"),
        ("BBC", "http://feeds.bbci.co.uk/news/world/rss.xml"),
    ],
    "tech": [
        ("Hacker News", "https://hnrss.org/frontpage"),
        ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ],
    "mathematics": [
        ("Quanta Magazine — Math", "https://www.quantamagazine.org/feed/"),
    ],
    "arabic_philosophy": [
        ("Stanford Encyclopedia of Philosophy — Arabic & Islamic",
         "https://plato.stanford.edu/rss/sep.xml"),
    ],
    "chinese_philosophy": [
        ("Aeon", "https://aeon.co/feed.rss"),
    ],
    "research": [
        ("arXiv cs.AI", "http://export.arxiv.org/rss/cs.AI"),
    ],
}


DISTILL_TOOL = {
    "name": "emit_signal",
    "description": "Emit the distilled signal in ESUI house voice.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "concise headline (≤80 chars)"},
            "body": {"type": "string", "description": "2–4 sentences distilling the signal"},
        },
        "required": ["title", "body"],
    },
}

DISTILL_SYSTEM = """You distill source material into a single clear signal in
ESUI's house voice — calm, intellectual, warm. Output a 2–4 sentence summary that
preserves the load-bearing fact and discards the rest. No clickbait, no preamble.
The reader is sharp; respect their time."""


async def refresh_cycle() -> None:
    """Pull feeds, distill, persist a fresh cycle. Idempotent on cycle_id."""
    cycle_id = uuid4()
    cycle_started = datetime.now(tz=timezone.utc)
    expires_at = cycle_started + timedelta(hours=24)

    log.info("signals.refresh.start", cycle_id=str(cycle_id))

    candidates: list[tuple[str, str, str, str, str]] = []  # (category, title, body, url, source)
    for category, sources in FEEDS.items():
        for source_name, url in sources:
            try:
                parsed = await asyncio.to_thread(feedparser.parse, url)
            except Exception as e:
                log.warn("signals.feed.error", source=source_name, error=str(e))
                continue
            for entry in parsed.entries[:5]:
                title = getattr(entry, "title", "") or ""
                summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
                link = getattr(entry, "link", "") or ""
                if title and summary:
                    candidates.append((category, title, summary, link, source_name))

    # Distill (parallel; cap concurrency to be polite)
    sem = asyncio.Semaphore(4)

    async def _distill_one(c: tuple[str, str, str, str, str]) -> tuple[str, dict, str, str] | None:
        category, title, body, url, source = c
        async with sem:
            try:
                distilled = await _distill(title, body)
                return category, distilled, url, source
            except Exception as e:
                log.warn("signals.distill.error", title=title[:60], error=str(e))
                return None

    # Take up to 4 per category before distillation to leave room for failures.
    by_cat: dict[str, list] = {}
    for c in candidates:
        by_cat.setdefault(c[0], []).append(c)
    selected = []
    for cat, items in by_cat.items():
        selected.extend(items[:4])

    distilled_results = await asyncio.gather(*[_distill_one(c) for c in selected])

    # Keep top 3 per category
    final_by_cat: dict[str, list] = {}
    for r in distilled_results:
        if r is None:
            continue
        cat = r[0]
        final_by_cat.setdefault(cat, [])
        if len(final_by_cat[cat]) < 3:
            final_by_cat[cat].append(r)

    # Embed bodies in one batch
    bodies = [r[1]["body"] for cat in final_by_cat for r in final_by_cat[cat]]
    if not bodies:
        log.warn("signals.refresh.empty_cycle")
        return

    vectors = await embed(bodies, input_type="document")
    vec_iter = iter(vectors)

    # Pull recent signal embeddings (last 7 days) for cross-cycle dedup.
    from sqlalchemy import text as _t
    async with SessionLocal() as session:
        recent = (await session.execute(_t("""
            SELECT embedding FROM signals
            WHERE fetched_at > now() - interval '7 days'
              AND embedding IS NOT NULL
        """))).all()
        recent_vecs = [list(r[0]) for r in recent if r[0] is not None]

        inserted = 0
        skipped = 0
        for cat, items in final_by_cat.items():
            for category, distilled, url, source in items:
                vec = next(vec_iter)
                if _is_duplicate(vec, recent_vecs, threshold=0.92):
                    skipped += 1
                    continue
                session.add(Signal(
                    category=category,
                    title=distilled["title"][:200],
                    body=distilled["body"],
                    source_url=url or None,
                    source_name=source,
                    fetched_at=cycle_started,
                    expires_at=expires_at,
                    cycle_id=cycle_id,
                    embedding=vec,
                ))
                recent_vecs.append(vec)  # dedup against this cycle's own additions
                inserted += 1
        await session.commit()
    log.info("signals.refresh.persisted", inserted=inserted, deduped=skipped)

    log.info("signals.refresh.done", cycle_id=str(cycle_id),
             count=sum(len(v) for v in final_by_cat.values()))

    # Notify clients
    try:
        from app.main import sio
        await sio.emit("cycle:refreshed", {
            "cycle_id": str(cycle_id),
            "refreshed_at": cycle_started.isoformat(),
            "expires_at": expires_at.isoformat(),
        })
    except Exception:
        pass


async def expire_cleanup() -> None:
    """Delete signals past expires_at that aren't pinned by anyone."""
    from sqlalchemy import text
    async with SessionLocal() as session:
        await session.execute(text("""
            DELETE FROM signals
            WHERE expires_at < now()
              AND id NOT IN (SELECT signal_id FROM signal_pins)
        """))
        await session.commit()


# ---------- helpers ----------


def _is_duplicate(
    candidate: list[float],
    recent: list[list[float]],
    threshold: float,
) -> bool:
    if not recent:
        return False
    na = sum(x * x for x in candidate) ** 0.5
    if na == 0:
        return False
    for r in recent:
        nr = sum(x * x for x in r) ** 0.5
        if nr == 0:
            continue
        dot = sum(x * y for x, y in zip(candidate, r, strict=True))
        sim = dot / (na * nr)
        if sim >= threshold:
            return True
    return False


async def _distill(title: str, body: str) -> dict[str, str]:
    client = get_client()
    user = f"Source title: {title}\n\nSource body:\n{body[:4000]}"
    resp = await client.messages.create(
        model=MODEL_IDS["sonnet"],
        max_tokens=400,
        temperature=0.4,
        system=DISTILL_SYSTEM,
        tools=[DISTILL_TOOL],
        tool_choice={"type": "tool", "name": "emit_signal"},
        messages=[{"role": "user", "content": user}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_signal":
            return {"title": b.input["title"], "body": b.input["body"]}
    raise RuntimeError("no signal emitted")
