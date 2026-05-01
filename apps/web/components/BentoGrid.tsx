"use client";

/**
 * BentoGrid — the draggable / resizable home surface.
 *
 * Wraps `react-grid-layout` with:
 *   - localStorage persistence keyed per user
 *   - sensible defaults (12-col grid, generous row height)
 *   - edit-mode toggle (when off, grid is locked — no accidental drag/resize)
 *   - reset-to-default
 *
 * Each child must have a `key` matching its layout `i`, e.g.:
 *
 *   <BentoGrid storageKey="esui:home" defaultLayout={DEFAULT_LAYOUT}>
 *     <div key="time">...</div>
 *     <div key="today">...</div>
 *     <div key="recent-chats">...</div>
 *   </BentoGrid>
 */

import { useEffect, useMemo, useState } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import type { WidgetLayout } from "@/lib/types";

type BentoGridProps = {
  /** Items in the default arrangement. Used on first mount and on reset. */
  defaultLayout: WidgetLayout[];
  /** localStorage key (e.g. `esui:home:<user_id>`). Layout persists per key. */
  storageKey: string;
  /** Tile height in pixels for one row unit. */
  rowHeight?: number;
  /** Total columns at the widest breakpoint. */
  cols?: number;
  /** Gap between tiles in px. */
  gap?: number;
  /** When true, drag/resize handles are active. */
  editing?: boolean;
  /** Optional change callback (also fires on resize end). */
  onLayoutChange?: (layout: WidgetLayout[]) => void;
  /** Optional drag-handle CSS selector. Defaults to whole tile. */
  draggableHandle?: string;
  children: React.ReactNode;
};

export function BentoGrid({
  defaultLayout,
  storageKey,
  rowHeight = 56,
  cols = 12,
  gap = 14,
  editing = false,
  onLayoutChange,
  draggableHandle,
  children,
}: BentoGridProps) {
  const [layout, setLayout] = useState<WidgetLayout[]>(() =>
    loadLayout(storageKey, defaultLayout),
  );
  const [width, setWidth] = useState<number>(() =>
    typeof window === "undefined" ? 1200 : window.innerWidth - 48,
  );

  useEffect(() => {
    const onResize = () => setWidth(Math.max(360, window.innerWidth - 48));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Re-load when the key changes (e.g. user switches accounts).
  useEffect(() => {
    setLayout(loadLayout(storageKey, defaultLayout));
  }, [storageKey, defaultLayout]);

  const handleChange = (next: Layout[]) => {
    const cleaned: WidgetLayout[] = next.map((l) => ({
      i: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
      minW: l.minW,
      minH: l.minH,
      maxW: l.maxW,
      maxH: l.maxH,
    }));
    setLayout(cleaned);
    saveLayout(storageKey, cleaned);
    onLayoutChange?.(cleaned);
  };

  // Keep static off when editing, even if defaults set it.
  const liveLayout = useMemo<Layout[]>(
    () => layout.map((l) => ({ ...l, static: !editing && !!l.static })),
    [layout, editing],
  );

  return (
    <GridLayout
      className="bento-grid"
      layout={liveLayout}
      cols={cols}
      rowHeight={rowHeight}
      width={width}
      margin={[gap, gap]}
      containerPadding={[0, 0]}
      isDraggable={editing}
      isResizable={editing}
      compactType={null}     // no auto-stacking; she places where she wants
      preventCollision={true}
      onLayoutChange={handleChange}
      draggableHandle={draggableHandle}
      useCSSTransforms
      transformScale={1}
    >
      {children}
    </GridLayout>
  );
}

// ---------- persistence ----------

function loadLayout(key: string, fallback: WidgetLayout[]): WidgetLayout[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as WidgetLayout[];
    if (!Array.isArray(parsed) || !parsed.every(isWidgetLayout)) return fallback;
    // Merge: keep saved layouts but ensure every default key is present.
    const byKey = new Map(parsed.map((l) => [l.i, l]));
    const merged = fallback.map((d) => byKey.get(d.i) ?? d);
    // Drop any saved layouts whose key is no longer in defaults.
    return merged;
  } catch {
    return fallback;
  }
}

function saveLayout(key: string, layout: WidgetLayout[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    // localStorage full or disabled — silently no-op.
  }
}

function isWidgetLayout(v: unknown): v is WidgetLayout {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as WidgetLayout).i === "string" &&
    typeof (v as WidgetLayout).x === "number" &&
    typeof (v as WidgetLayout).y === "number" &&
    typeof (v as WidgetLayout).w === "number" &&
    typeof (v as WidgetLayout).h === "number"
  );
}

/** Reset the grid for a key back to its defaults. */
export function resetBentoLayout(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}
