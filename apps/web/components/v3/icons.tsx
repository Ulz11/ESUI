"use client";

/* V3 icon set — Lucide-style stroke icons, hand-tuned to feel quiet. */

import type { CSSProperties, ReactNode } from "react";

type IcoProps = {
  d?: string | ReactNode;
  size?: number;
  sw?: number;
  fill?: string;
  style?: CSSProperties;
};

function Ico({ d, size = 16, sw = 1.5, fill = "none", style }: IcoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {typeof d === "string" ? <path d={d} /> : d}
    </svg>
  );
}

export type IconProps = Omit<IcoProps, "d">;

export const I = {
  home: (p: IconProps) => (
    <Ico {...p} d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
  ),
  chat: (p: IconProps) => <Ico {...p} d="M4 5h16v11H8l-4 4z" />,
  cal: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </g>
      }
    />
  ),
  vault: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <path d="M4 6h16v14H4z" />
          <path d="M4 10h16M9 14h6" />
        </g>
      }
    />
  ),
  beauty: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="m3 18 5-5 4 4 3-3 6 6" />
        </g>
      }
    />
  ),
  signal: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <path d="M6 5h12v14l-6-3-6 3z" />
        </g>
      }
    />
  ),
  exam: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <path d="M4 5h13l3 3v11H4z" />
          <path d="M8 10h8M8 14h6" />
        </g>
      }
    />
  ),
  settings: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 13.6 21 14l-1 3-1.6-.4a7 7 0 0 1-1.4.8L16.5 19h-3l-.5-1.6a7 7 0 0 1-1.4-.8L10 17l-1-3 1.6-.4a7 7 0 0 1 0-1.6L9 11.6 10 8.6l1.6.4a7 7 0 0 1 1.4-.8L13.5 6.6h3l.5 1.6a7 7 0 0 1 1.4.8L20 8.6l1 3-1.6.4a7 7 0 0 1 0 1.6z" />
        </g>
      }
    />
  ),
  send: (p: IconProps) => <Ico {...p} d="M5 12h14M13 6l6 6-6 6" />,
  plus: (p: IconProps) => <Ico {...p} d="M12 5v14M5 12h14" />,
  search: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-3.5-3.5" />
        </g>
      }
    />
  ),
  close: (p: IconProps) => <Ico {...p} d="M6 6l12 12M18 6 6 18" />,
  pencil: (p: IconProps) => <Ico {...p} d="M4 20h4l11-11-4-4L4 16zM13 6l4 4" />,
  pin: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <path d="M12 17v5" />
          <path d="M9 4h6l-1 6 3 3H7l3-3z" />
        </g>
      }
    />
  ),
  arc: (p: IconProps) => <Ico {...p} d="M5 12a7 7 0 0 1 14 0" />,
  arrow: (p: IconProps) => <Ico {...p} d="M5 12h14M13 6l6 6-6 6" />,
  back: (p: IconProps) => <Ico {...p} d="M19 12H5M11 6l-6 6 6 6" />,
  dots: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <circle cx="6" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="18" cy="12" r="1" />
        </g>
      }
    />
  ),
  link: (p: IconProps) => (
    <Ico
      {...p}
      d="M10 14a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1 1M14 10a4 4 0 0 1 0 6l-3 3a4 4 0 0 1-6-6l1-1"
    />
  ),
  check: (p: IconProps) => <Ico {...p} d="m5 12 5 5L20 7" />,
  filter: (p: IconProps) => <Ico {...p} d="M4 5h16M7 12h10M10 19h4" />,
  drag: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <circle cx="9" cy="6" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="6" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="18" r="1" />
        </g>
      }
    />
  ),
  sun: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </g>
      }
    />
  ),
  moon: (p: IconProps) => (
    <Ico {...p} d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10z" />
  ),
  sparkle: (p: IconProps) => (
    <Ico
      {...p}
      d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6zM19 4l.7 1.8L21.5 6.5 19.7 7.2 19 9l-.7-1.8L16.5 6.5 18.3 5.8z"
    />
  ),
  graph: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
          <path d="M8 7l3 9M16 7l-3 9M14 18h2" />
        </g>
      }
    />
  ),
  archive: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <rect x="3" y="4" width="18" height="4" />
          <path d="M5 8v12h14V8M9 12h6" />
        </g>
      }
    />
  ),
  copy: (p: IconProps) => (
    <Ico
      {...p}
      d={
        <g>
          <rect x="8" y="8" width="12" height="12" rx="1.5" />
          <path d="M16 8V4H4v12h4" />
        </g>
      }
    />
  ),
};

export type IconKey = keyof typeof I;
