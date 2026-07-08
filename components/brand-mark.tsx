"use client";

// Marca de DotaciónFaenas: tres chevrons ascendentes (el pipeline de
// habilitación) sobre un tile con gradiente. Reemplaza el ícono genérico.
export function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DotaciónFaenas"
    >
      <defs>
        <linearGradient id="bm-tile" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.5 0.24 275)" />
          <stop offset="55%" stopColor="oklch(0.46 0.22 264)" />
          <stop offset="100%" stopColor="oklch(0.55 0.22 240)" />
        </linearGradient>
        <linearGradient id="bm-chev" x1="10" y1="38" x2="38" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#bm-tile)" />
      <rect x="1" y="1" width="46" height="46" rx="13" stroke="white" strokeOpacity="0.14" />

      {/* Chevrons ascendentes — etapas del pipeline */}
      <path d="M11 30 L17 24 L11 18" stroke="url(#bm-chev)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M20 32 L27 24 L20 16" stroke="url(#bm-chev)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.78" />
      <path d="M29 34 L38 24 L29 14" stroke="url(#bm-chev)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Anillo radial de cobertura de dotación (contratados vs requeridos)
export function CoverageRing({
  pct,
  size = 88,
  stroke = 8,
  className = "",
}: {
  pct: number; // 0-100
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color =
    clamped >= 90 ? "oklch(0.65 0.18 155)" :  // verde
    clamped >= 70 ? "oklch(0.72 0.16 75)"  :  // ámbar
    "oklch(0.6 0.2 25)";                       // rojo

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="oklch(0.92 0.01 247)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          animation: "ring-fill 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards",
          ["--ring-target" as string]: circ * (1 - clamped / 100),
        }}
      />
      <style>{`
        @keyframes ring-fill {
          to { stroke-dashoffset: var(--ring-target); }
        }
      `}</style>
    </svg>
  );
}
