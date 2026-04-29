"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Quote, QuoteCreate, SignalCategory } from "@/lib/types";

const CATEGORIES: Array<{
  id: SignalCategory;
  label: string;
  source: string;
  accent: string;
}> = [
  {
    id: "mathematics",
    label: "Mathematics",
    source: "Mathematics for Human Flourishing — Francis Su",
    accent: "#8b6fba",
  },
  {
    id: "arabic_philosophy",
    label: "Arabian Philosophy",
    source: "Arabic / Arabian philosophy",
    accent: "#b5893a",
  },
  {
    id: "chinese_philosophy",
    label: "Chinese Philosophy",
    source: "Chinese philosophy",
    accent: "#c0534d",
  },
  {
    id: "elements_of_ai",
    label: "Elements of AI",
    source: "elementsofai.com",
    accent: "#3e6f54",
  },
];

export function SignalsWidget() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<SignalCategory | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await api.get<Quote[]>("/api/v1/signals?limit=200");
      setQuotes(rows);
      setError(null);
    } catch {
      setError("we couldn't load your quotes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const m: Record<SignalCategory, Quote[]> = {
      mathematics: [],
      arabic_philosophy: [],
      chinese_philosophy: [],
      elements_of_ai: [],
    };
    for (const q of quotes) {
      if (q.category in m) m[q.category as SignalCategory].push(q);
    }
    return m;
  }, [quotes]);

  const onAdd = async (payload: QuoteCreate) => {
    const created = await api.post<Quote>("/api/v1/signals", payload);
    setQuotes((p) => [created, ...p]);
    setAdding(null);
  };

  const onDelete = async (id: string) => {
    setQuotes((p) => p.filter((q) => q.id !== id));
    api.delete(`/api/v1/signals/${id}`).catch(() => load());
  };

  return (
    <div style={sS.container}>
      <header style={sS.header}>
        <h2 style={sS.title}>Signals</h2>
        <span style={sS.sub}>quotes you've kept · {quotes.length}</span>
      </header>

      {error && (
        <div style={sS.empty}>
          <p style={sS.quietBig}>{error}</p>
        </div>
      )}

      <div style={sS.grid}>
        {CATEGORIES.map((cat) => (
          <section key={cat.id} style={sS.col}>
            <header style={sS.colHead}>
              <span style={{ ...sS.dot, background: cat.accent }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={sS.colTitle}>{cat.label}</h3>
                <p style={sS.colSrc}>{cat.source}</p>
              </div>
              <button
                style={sS.addBtn}
                onClick={() => setAdding(cat.id)}
                title={`Add to ${cat.label}`}
                aria-label={`Add to ${cat.label}`}
              >
                +
              </button>
            </header>

            {adding === cat.id && (
              <QuoteForm
                category={cat.id}
                defaultSource={cat.source}
                onCancel={() => setAdding(null)}
                onSubmit={onAdd}
              />
            )}

            <div style={sS.colBody}>
              {loading && grouped[cat.id].length === 0 ? (
                <Skeleton />
              ) : grouped[cat.id].length === 0 ? (
                <p style={sS.quiet}>nothing yet — drop a quote</p>
              ) : (
                grouped[cat.id].map((q) => (
                  <QuoteCard
                    key={q.id}
                    quote={q}
                    accent={cat.accent}
                    onDelete={() => onDelete(q.id)}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ---------- card ----------

function QuoteCard({
  quote,
  accent,
  onDelete,
}: {
  quote: Quote;
  accent: string;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <article
      style={sS.card}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ ...sS.cardRule, background: accent + "33" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={sS.cardBody}>{quote.body}</p>
        {quote.source_name && (
          <p style={sS.cardSrc}>
            — {quote.source_name}
            {quote.source_url && (
              <>
                {" · "}
                <a href={quote.source_url} target="_blank" rel="noopener noreferrer" style={sS.link}>
                  open ↗
                </a>
              </>
            )}
          </p>
        )}
      </div>
      <button
        style={{ ...sS.del, opacity: hovered ? 0.65 : 0, transition: "opacity .15s" }}
        onClick={onDelete}
        aria-label="Remove quote"
      >
        ×
      </button>
    </article>
  );
}

// ---------- add form ----------

function QuoteForm({
  category,
  defaultSource,
  onCancel,
  onSubmit,
}: {
  category: SignalCategory;
  defaultSource: string;
  onCancel: () => void;
  onSubmit: (q: QuoteCreate) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [sourceName, setSourceName] = useState(defaultSource);
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        category,
        body: trimmed,
        source_name: sourceName.trim() || undefined,
        source_url: sourceUrl.trim() || undefined,
      });
      setBody("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={sS.form}>
      <textarea
        autoFocus
        rows={4}
        placeholder="Drop a quote…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        style={sS.textarea}
      />
      <input
        type="text"
        placeholder="source"
        value={sourceName}
        onChange={(e) => setSourceName(e.target.value)}
        style={sS.input}
      />
      <input
        type="url"
        placeholder="link (optional)"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        style={sS.input}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={sS.ghostBtn} onClick={onCancel} disabled={submitting}>
          cancel
        </button>
        <button
          style={sS.primaryBtn}
          onClick={submit}
          disabled={submitting || !body.trim()}
        >
          {submitting ? "saving…" : "save"}
        </button>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} style={{ ...sS.card, animation: "pulse 1.4s ease-in-out infinite" }}>
          <span style={{ ...sS.cardRule, background: "var(--navy-10)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 10, background: "var(--navy-10)", borderRadius: 3, marginBottom: 6 }} />
            <div style={{ height: 10, background: "var(--navy-10)", borderRadius: 3, width: "70%" }} />
          </div>
        </div>
      ))}
    </>
  );
}

// ---------- styles ----------

const sS: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    background: "var(--page)",
  },
  header: {
    padding: "20px 24px 14px",
    borderBottom: "1px solid var(--vanilla-border, var(--border))",
    background: "var(--white)",
    flexShrink: 0,
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 300,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
    margin: 0,
    letterSpacing: -0.2,
  },
  sub: { fontSize: 12, color: "var(--navy-45)", letterSpacing: 0.1 },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  quiet: { fontSize: 12.5, color: "var(--navy-45)", padding: "8px 2px" },
  quietBig: { fontSize: 14, color: "var(--navy-60)" },

  grid: {
    flex: 1,
    overflow: "auto",
    padding: "18px 18px 28px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
    alignContent: "start",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "var(--white)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "14px 14px 12px",
  },
  colHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingBottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
    display: "block",
  },
  colTitle: {
    fontSize: 13.5,
    fontWeight: 500,
    color: "var(--navy)",
    margin: 0,
    letterSpacing: 0.05,
  },
  colSrc: {
    fontSize: 11,
    color: "var(--navy-45)",
    margin: "2px 0 0",
    fontStyle: "italic",
  },
  addBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--navy-60)",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  colBody: { display: "flex", flexDirection: "column", gap: 8 },

  card: {
    display: "flex",
    gap: 10,
    background: "var(--surface, var(--white))",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "11px 11px 11px 9px",
    position: "relative",
  },
  cardRule: { width: 2, borderRadius: 1, alignSelf: "stretch", display: "block" },
  cardBody: {
    fontSize: 13.5,
    lineHeight: 1.55,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
    margin: 0,
  },
  cardSrc: {
    fontSize: 11.5,
    color: "var(--navy-45)",
    margin: "8px 0 0",
    fontStyle: "italic",
  },
  link: { color: "var(--navy-60)", textDecoration: "underline" },
  del: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "var(--navy)",
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 10,
    background: "var(--vanilla, var(--surface))",
  },
  textarea: {
    fontFamily: "var(--serif)",
    fontSize: 13.5,
    lineHeight: 1.5,
    color: "var(--navy)",
    background: "var(--white)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "8px 10px",
    resize: "vertical",
    outline: "none",
  },
  input: {
    fontSize: 12,
    color: "var(--navy)",
    background: "var(--white)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "6px 10px",
    outline: "none",
  },
  ghostBtn: {
    fontSize: 12,
    background: "transparent",
    color: "var(--navy-60)",
    border: "1px solid var(--border)",
    padding: "5px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },
  primaryBtn: {
    fontSize: 12,
    background: "var(--navy)",
    color: "var(--white)",
    border: "none",
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 500,
  },
};
