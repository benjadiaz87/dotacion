"use client";

interface WeekPoint {
  weekNumber: number;
  total: number;
}

interface Props {
  data: WeekPoint[];
  height?: number;
  color?: string;
}

export function DotacionSparkline({ data, height = 48, color = "#3b82f6" }: Props) {
  if (!data || data.length === 0) return null;

  const width = 220;
  const padX = 4;
  const padY = 6;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const minVal = 0;

  function x(i: number) {
    if (data.length === 1) return padX + chartW / 2;
    return padX + (i / (data.length - 1)) * chartW;
  }

  function y(val: number) {
    return padY + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
  }

  const points = data.map((d, i) => ({ px: x(i), py: y(d.total), ...d }));

  // SVG smooth path using cubic bezier
  function buildPath() {
    if (points.length === 1) {
      return `M ${points[0].px} ${points[0].py}`;
    }
    let d = `M ${points[0].px} ${points[0].py}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.px + curr.px) / 2;
      d += ` C ${cpX} ${prev.py}, ${cpX} ${curr.py}, ${curr.px} ${curr.py}`;
    }
    return d;
  }

  function buildArea() {
    const base = padY + chartH;
    if (points.length === 1) {
      return `M ${points[0].px} ${base} L ${points[0].px} ${points[0].py} Z`;
    }
    let d = `M ${points[0].px} ${base} L ${points[0].px} ${points[0].py}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.px + curr.px) / 2;
      d += ` C ${cpX} ${prev.py}, ${cpX} ${curr.py}, ${curr.px} ${curr.py}`;
    }
    d += ` L ${points[points.length - 1].px} ${base} Z`;
    return d;
  }

  const gradientId = `grad-${color.replace("#", "")}`;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={buildArea()} fill={`url(#${gradientId})`} />

      {/* Line */}
      <path
        d={buildPath()}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots en cada semana */}
      {points.map((p) => (
        <circle
          key={p.weekNumber}
          cx={p.px}
          cy={p.py}
          r="2.5"
          fill="white"
          stroke={color}
          strokeWidth="1.5"
        />
      ))}

      {/* Dot destacado en el pico */}
      {(() => {
        const peak = points.reduce((a, b) => (b.total > a.total ? b : a));
        return (
          <circle
            cx={peak.px}
            cy={peak.py}
            r="3.5"
            fill={color}
            stroke="white"
            strokeWidth="1.5"
          />
        );
      })()}
    </svg>
  );
}
