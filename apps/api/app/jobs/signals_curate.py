"""Daily Signals — hourly AI curation from four sources.

Sources, locked:
  - chinese_philosophy   classical Chinese thought
  - arabic_philosophy    classical Islamic / Arabic thought
  - francis_su           Mathematics for Human Flourishing (Francis Su)
  - inspiration          real wisdom, not cringe (the "not cringe" filter
                         is encoded explicitly in the system prompt)

One quote per category per cycle. Persistent (no expiration).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text as _t

from app.core.db import SessionLocal
from app.core.log import log
from app.integrations.anthropic import MODEL_IDS, get_client
from app.integrations.voyage import embed_one
from app.models import AICall, Signal

CATEGORIES = ("chinese_philosophy", "arabic_philosophy", "francis_su", "inspiration")


CURATE_TOOL = {
    "name": "emit_quote",
    "description": "Emit one curated quote in the requested category.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "Declarative, ≤ 80 chars. Not a question.",
            },
            "body": {
                "type": "string",
                "description": "The quote itself, in plain prose. 1–4 sentences.",
            },
            "source_name": {
                "type": "string",
                "description": "Author · Work, with chapter/section if applicable.",
            },
            "source_url": {
                "type": "string",
                "description": "Optional canonical link (Stanford Encyclopedia, etc.).",
            },
        },
        "required": ["title", "body", "source_name"],
    },
}


CURATE_SYSTEM = """You curate one quote at a time for ESUI's daily intelligence
feed — a small, slow stream for a sharp, intellectually serious reader.

You draw from one of FOUR sources. Each cycle, the user message tells you
which:

────────────────────────────────────────────────────────────────────────────
CHINESE PHILOSOPHY

Pool: Tao Te Ching · Zhuangzi · Confucius (Analects) · Mencius · Sun Tzu ·
Wang Yangming · Han Feizi · Zhu Xi · Mozi · Liezi · Xunzi.

Bias toward terseness — these traditions are masters of compression. Cite
chapter/section when present (e.g. "Tao Te Ching · ch. 11").

────────────────────────────────────────────────────────────────────────────
ARABIC PHILOSOPHY

Pool: Al-Kindi · Al-Farabi · Ibn Sina (Avicenna) · Al-Ghazali · Ibn Rushd
(Averroes) · Ibn Tufayl (Hayy ibn Yaqzan) · Ibn Khaldun (Muqaddimah) ·
Suhrawardi · Ibn al-Arabi · Ibn Bajja · Avicebron.

Prefer the more cited works (Muqaddimah, Hayy ibn Yaqzan, Tahafut series,
Deliverance from Error). When you cite Ibn Khaldun, name the chapter of
the Muqaddimah.

────────────────────────────────────────────────────────────────────────────
FRANCIS SU — MATHEMATICS FOR HUMAN FLOURISHING

Quote from this specific book. Themes: meaning, beauty, struggle, freedom,
permanence, justice, love, and the moral case for mathematics. Avoid the
single most-quoted passage if you can.

────────────────────────────────────────────────────────────────────────────
INSPIRATION TEXTS — NOT CRINGE

Pool: Marcus Aurelius · Seneca · Epictetus · Simone Weil · Iris Murdoch ·
Wendell Berry · Annie Dillard · Mary Oliver · Anne Carson · Rilke · Borges ·
Tolstoy (essays) · Dostoyevsky (notebooks) · Susan Sontag · Hannah Arendt ·
Carl Jung · Mary Karr · Marilynne Robinson · Czesław Miłosz · Pessoa.

CRINGE is:
  - Instagram-quote pseudo-profundity ("believe in yourself, the universe
    will conspire").
  - LinkedIn-stoicism ("hustle is mindset", "discipline = freedom" out of
    its naval-special-warfare context).
  - Steve-Jobs-commencement-loop platitudes.
  - Hallmark-card aphorism.
  - Anonymous "ancient proverb" attributions.
  - Mis-attributed quotes (the Mark Twain / Einstein / Twain trap).
  - "Rumi" quotes that are actually Coleman Barks paraphrasing.

REAL is:
  A sentence that surprises, that costs the writer something, that has
  weight when read alone on the page. "Beauty is nothing but the start
  of terror we can just barely endure" — that texture. Not "good vibes."

────────────────────────────────────────────────────────────────────────────
ACCURACY

Only output quotes you are confident are real. If uncertain about exact
wording, paraphrase carefully and write source_name as
"paraphrased from <Author · Work>". Better to under-quote than misattribute.

────────────────────────────────────────────────────────────────────────────
OUTPUT

emit_quote with:
  title       60–80 char declarative title (not a question, not all-caps)
  body        the quote body in plain prose (1–4 sentences)
  source_name "Author · Work" with chapter/section if applicable
  source_url  optional canonical link

VOICE
  Match ESUI's house register — calm, intellectual, warm. The title and
  body together should make her stop scrolling. Never overhype."""


async def hourly_curate() -> None:
    """One cycle = one new quote per category. Runs hourly via APScheduler."""
    cycle_id = uuid4()
    cycle_started = datetime.now(tz=UTC)

    log.info("signals.hourly.start", cycle_id=str(cycle_id))

    # Look up Esui's user_id once (for ai_calls owner). Falls back to first user.
    async with SessionLocal() as session:
        owner_id = await _system_owner_id(session)

    inserted = 0
    for category in CATEGORIES:
        try:
            recent_titles = await _recent_titles(category, limit=24)
            quote = await _curate_one(category, recent_titles)
        except Exception as e:
            log.warn("signals.hourly.error", category=category, error=str(e))
            continue

        try:
            vec = await embed_one(quote["body"], input_type="document")
        except Exception:
            vec = None

        async with SessionLocal() as session:
            session.add(Signal(
                category=category,
                title=quote["title"][:200],
                body=quote["body"],
                source_url=quote.get("source_url") or None,
                source_name=quote.get("source_name") or None,
                fetched_at=cycle_started,
                expires_at=None,        # persistent — no expiry on AI curated
                cycle_id=cycle_id,
                embedding=vec,
                provider="ai_curate",
            ))
            session.add(AICall(
                user_id=owner_id,
                task=f"signals.curate.{category}",
                provider="anthropic",
                model_id="claude-sonnet",
                tokens_in=quote.get("tokens_in"),
                tokens_out=quote.get("tokens_out"),
            ))
            await session.commit()
        inserted += 1

    log.info("signals.hourly.done", cycle_id=str(cycle_id), inserted=inserted)

    # Notify connected clients.
    try:
        from app.main import sio
        await sio.emit("cycle:refreshed", {
            "cycle_id": str(cycle_id),
            "refreshed_at": cycle_started.isoformat(),
            "expires_at": None,
        })
    except Exception:
        pass


# ---------- helpers ----------


async def _curate_one(category: str, recent_titles: list[str]) -> dict[str, Any]:
    instr = {
        "chinese_philosophy": "Pick one quote from Chinese philosophy. Vary the work.",
        "arabic_philosophy":  "Pick one quote from Arabic philosophy. Vary the thinker.",
        "francis_su":         "Pick one quote from Francis Su · Mathematics for Human Flourishing.",
        "inspiration":        "Pick one inspiration-text quote. NOT CRINGE.",
    }[category]

    prompt = instr
    if recent_titles:
        prompt += "\n\nDo not repeat any of these recent titles:\n"
        for t in recent_titles[:24]:
            prompt += f"- {t}\n"

    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS["sonnet"],
        max_tokens=400,
        temperature=0.7,
        system=CURATE_SYSTEM,
        tools=[CURATE_TOOL],
        tool_choice={"type": "tool", "name": "emit_quote"},
        messages=[{"role": "user", "content": prompt}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_quote":
            return {
                **b.input,
                "tokens_in": resp.usage.input_tokens,
                "tokens_out": resp.usage.output_tokens,
            }
    raise RuntimeError("curator returned no quote")


async def _recent_titles(category: str, limit: int = 24) -> list[str]:
    async with SessionLocal() as session:
        rows = (await session.execute(_t("""
            SELECT title FROM signals
            WHERE category = :c
            ORDER BY fetched_at DESC
            LIMIT :n
        """), {"c": category, "n": limit})).all()
    return [r.title for r in rows]


async def _system_owner_id(session) -> UUID:
    """ai_calls.user_id is NOT NULL. Use Esui's id when she exists, else any user."""
    row = (await session.execute(_t("""
        SELECT id FROM users
        ORDER BY CASE WHEN role = 'esui' THEN 0 ELSE 1 END
        LIMIT 1
    """))).first()
    if row is None:
        return UUID(int=0)
    return row.id
