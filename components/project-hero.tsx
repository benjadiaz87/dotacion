"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { CountUp, Stagger, StaggerItem } from "@/components/motion-primitives";
import { CoverageRing } from "@/components/brand-mark";
import { ArrowLeft, Building2, CalendarDays, MapPin, Users } from "lucide-react";

type Meta = {
  client: string | null;
  location: string | null;
  startLabel: string;
  weeks: number;
  headcountLabel: string;
};

export function ProjectHero({
  name,
  description,
  statusLabel,
  statusColor,
  isActive,
  meta,
  coverage,
  progress,
  actions,
}: {
  name: string;
  description: string | null;
  statusLabel: string;
  statusColor: string;
  isActive: boolean;
  meta: Meta;
  coverage: { requeridos: number; cubiertos: number } | null;
  progress: number;
  actions?: React.ReactNode;
}) {
  const covPct = coverage && coverage.requeridos > 0
    ? Math.round((coverage.cubiertos / coverage.requeridos) * 100)
    : null;
  const covText = covPct === null ? "" : covPct >= 90 ? "text-emerald-700" : covPct >= 70 ? "text-amber-700" : "text-red-700";

  const metaCards = [
    { icon: Building2,    label: "Cliente",   value: meta.client || "—",   grad: "from-blue-500 to-blue-600",     shadow: "shadow-blue-500/25" },
    { icon: MapPin,       label: "Ubicación", value: meta.location || "—", grad: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/25" },
    { icon: CalendarDays, label: "Inicio",    value: `${meta.startLabel} · ${meta.weeks} sem.`, grad: "from-amber-500 to-orange-500", shadow: "shadow-amber-500/25" },
    { icon: Users,        label: "Dotación total", value: meta.headcountLabel, grad: "from-violet-500 to-violet-600", shadow: "shadow-violet-500/25" },
  ];

  return (
    <>
      {/* ── Hero band ─────────────────────────────────────────────────────── */}
      <div className="hero-aurora bg-dotgrid border-b bg-background/60">
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-8 relative">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Link
              href="/dashboard/proyectos"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a proyectos
            </Link>
          </motion.div>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08 }}
                className="flex items-center gap-3 flex-wrap"
              >
                <h1 className="text-3xl font-black tracking-tight text-gradient">{name}</h1>
                <Badge variant="outline" className={`text-xs gap-1.5 ${statusColor}`}>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-live" />}
                  {statusLabel}
                </Badge>
              </motion.div>
              {description && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  className="text-muted-foreground text-sm mt-2 max-w-2xl"
                >
                  {description}
                </motion.p>
              )}
              {/* Avance */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center gap-3 mt-4 max-w-md"
              >
                <div className="h-2 rounded-full bg-muted overflow-hidden flex-1 relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                    className="h-full rounded-full relative overflow-hidden shimmer"
                    style={{ background: "linear-gradient(90deg, oklch(0.46 0.22 264), oklch(0.55 0.22 290))" }}
                  />
                </div>
                <span className="text-sm font-black text-foreground tabular-nums">
                  <CountUp value={progress} suffix="%" duration={1.1} />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">avance</span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="flex items-center gap-4 flex-wrap"
            >
              {covPct !== null && (
                <div className="flex items-center gap-3 rounded-2xl border bg-background/80 backdrop-blur px-4 py-3 shadow-sm">
                  <div className="relative flex-shrink-0">
                    <CoverageRing pct={covPct} size={52} stroke={5} />
                    <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-black ${covText}`}>
                      <CountUp value={covPct} suffix="%" />
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-black text-foreground leading-none">
                      <CountUp value={coverage!.cubiertos} /><span className="text-muted-foreground font-bold text-sm">/{coverage!.requeridos}</span>
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Cobertura semana</p>
                  </div>
                </div>
              )}
              {actions}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Meta cards ────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metaCards.map((m) => (
            <StaggerItem key={m.label}>
              <div className="card-premium card-lift rounded-2xl flex items-center gap-3 p-4 h-full">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${m.grad} flex items-center justify-center flex-shrink-0 shadow-md ${m.shadow}`}>
                  <m.icon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-sm font-semibold truncate">{m.value}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </>
  );
}
