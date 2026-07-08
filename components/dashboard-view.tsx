"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CountUp, Stagger, StaggerItem, FadeUp, GrowBar } from "@/components/motion-primitives";
import { CoverageRing } from "@/components/brand-mark";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock,
  FolderKanban, Plus, Trophy, Users, TrendingUp, UserCheck, Sparkles,
} from "lucide-react";

const STAGE_COLORS: Record<number, { grad: string; bg: string; text: string }> = {
  1: { grad: "linear-gradient(90deg, #3b82f6, #60a5fa)", bg: "bg-blue-50",   text: "text-blue-700" },
  2: { grad: "linear-gradient(90deg, #6366f1, #818cf8)", bg: "bg-indigo-50", text: "text-indigo-700" },
  3: { grad: "linear-gradient(90deg, #f97316, #fbbf24)", bg: "bg-orange-50", text: "text-orange-700" },
  4: { grad: "linear-gradient(90deg, #14b8a6, #2dd4bf)", bg: "bg-teal-50",   text: "text-teal-700" },
};

type Props = {
  userName: string;
  greeting: string;
  projects: { id: string; name: string; client: string | null; location: string | null; weeks: number; status: string }[];
  pipelineStats: {
    total: number;
    habilitados: number;
    byStage: { order: number; name: string; type: string; count: number }[];
    pendingReview: { docsCount: number; workersCount: number };
  };
  companyStats: {
    vacantesTotal: number;
    dotacionRequerida: number;
    dotacionCubierta: number;
    poolDisponible: number;
    tiempoPromedioPrimeraAsignacionDias: number | null;
    projectsBreakdown: {
      projectId: string; projectName: string; vacantes: number;
      requeridos: number; cubiertos: number;
    }[];
  };
};

export function DashboardView({ userName, greeting, projects, pipelineStats, companyStats, canWrite = true }: Props & { canWrite?: boolean }) {
  const active = projects.filter((p) => p.status === "ACTIVE");
  const enProceso = pipelineStats.total - pipelineStats.habilitados;
  const maxCount = Math.max(...pipelineStats.byStage.map((s) => s.count), 1);
  const tasaHabilitacion = pipelineStats.total > 0
    ? Math.round((pipelineStats.habilitados / pipelineStats.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ── Hero band ─────────────────────────────────────────────────────── */}
      <div className="hero-aurora bg-dotgrid border-b bg-background/60">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-8 relative">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1 mb-4 shadow-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-live" />
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                  Operación en vivo · {pipelineStats.total} trabajadores en pipeline
                </span>
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08 }}
                className="text-sm text-muted-foreground font-medium"
              >
                {greeting},
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.14 }}
                className="text-4xl font-black tracking-tight mt-0.5 text-gradient"
              >
                {userName}
              </motion.h1>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {canWrite && (
                <Link href="/dashboard/proyectos/nuevo">
                  <Button className="gap-2 h-10 font-semibold shadow-lg shadow-primary/25">
                    <Plus className="w-4 h-4" /> Nuevo proyecto
                  </Button>
                </Link>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Bandeja de revisión (loop del portal de trabajadores) ─────────── */}
        {pipelineStats.pendingReview.docsCount > 0 && (
          <FadeUp>
            <Link href="/dashboard/empleados">
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-5 py-4 flex items-center gap-4 hover:shadow-md hover:shadow-amber-500/10 transition-all group cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/30">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-900 text-sm">
                    {pipelineStats.pendingReview.docsCount} documento{pipelineStats.pendingReview.docsCount !== 1 ? "s" : ""} esperando revisión
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    De {pipelineStats.pendingReview.workersCount} trabajador{pipelineStats.pendingReview.workersCount !== 1 ? "es" : ""} — incluye cargas desde el portal de autoservicio
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-800 flex-shrink-0 group-hover:translate-x-0.5 transition-transform">
                  Revisar ahora <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          </FadeUp>
        )}

        {/* ── Hero KPIs ─────────────────────────────────────────────────────── */}
        <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem className="col-span-2 lg:col-span-1">
            <div className="card-premium card-lift rounded-2xl p-6 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</span>
              </div>
              <p className="text-4xl font-black text-foreground">
                <CountUp value={pipelineStats.total} />
              </p>
              <p className="text-sm text-muted-foreground mt-1">Trabajadores en el sistema</p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="card-lift rounded-2xl p-6 h-full bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Habilitados</span>
              </div>
              <p className="text-4xl font-black text-emerald-700">
                <CountUp value={pipelineStats.habilitados} />
              </p>
              <p className="text-sm text-emerald-600 mt-1">Listos para faena</p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="card-premium card-lift rounded-2xl p-6 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proceso</span>
              </div>
              <p className="text-4xl font-black text-foreground">
                <CountUp value={enProceso} />
              </p>
              <p className="text-sm text-muted-foreground mt-1">En proceso de habilitación</p>
            </div>
          </StaggerItem>

          <StaggerItem>
            {(() => {
              const req = companyStats.dotacionRequerida;
              const cub = companyStats.dotacionCubierta;
              const covPct = req > 0 ? Math.round((cub / req) * 100) : 100;
              const covText = covPct >= 90 ? "text-emerald-700" : covPct >= 70 ? "text-amber-700" : "text-red-700";
              return (
                <div className="card-premium card-lift rounded-2xl p-6 h-full relative overflow-hidden">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cobertura dotación</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <CoverageRing pct={covPct} size={76} stroke={7} />
                      <span className={`absolute inset-0 flex items-center justify-center text-sm font-black ${covText}`}>
                        <CountUp value={covPct} suffix="%" />
                      </span>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-foreground leading-none">
                        <CountUp value={cub} /><span className="text-muted-foreground font-bold text-base">/{req}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5">Contratados vs requeridos</p>
                      {companyStats.vacantesTotal > 0 && (
                        <p className="text-[11px] font-semibold text-red-600 mt-1">
                          {companyStats.vacantesTotal} vacante{companyStats.vacantesTotal !== 1 ? "s" : ""} hoy
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </StaggerItem>
        </Stagger>

        {/* ── Pipeline funnel + proyectos ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Funnel */}
          <FadeUp className="lg:col-span-1" delay={0.1}>
            <div className="card-premium rounded-2xl p-6 h-full">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-foreground flex items-center gap-2">
                    Embudo de habilitación
                    <Sparkles className="w-3.5 h-3.5 text-primary/60" />
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{pipelineStats.total} trabajadores en pipeline</p>
                </div>
                <Link href="/dashboard/empleados" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                  Ver todos <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-3">
                {pipelineStats.byStage.map((s, i) => {
                  const c = STAGE_COLORS[s.order] ?? STAGE_COLORS[1];
                  const pct = s.count === 0 ? 0 : Math.max(Math.round((s.count / maxCount) * 100), 8);
                  return (
                    <div key={s.order}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
                            {s.order}
                          </span>
                          <span className="text-xs text-foreground font-medium truncate max-w-[150px]">{s.name}</span>
                        </div>
                        <span className={`text-sm font-black ${s.count > 0 ? c.text : "text-muted-foreground"}`}>
                          <CountUp value={s.count} duration={1} />
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                        <GrowBar
                          pct={pct}
                          delay={0.15 + i * 0.12}
                          className="h-full rounded-full relative overflow-hidden shimmer"
                          style={{ background: c.grad }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-xl font-black text-foreground">
                    <CountUp value={tasaHabilitacion} suffix="%" />
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Tasa habilitación</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-foreground">
                    <CountUp value={companyStats.poolDisponible} />
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Pool disponible</p>
                </div>
              </div>
            </div>
          </FadeUp>

          {/* Proyectos activos */}
          <FadeUp className="lg:col-span-2" delay={0.18}>
            <div className="card-premium rounded-2xl p-6 h-full">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-foreground">Proyectos activos</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{active.length} faenas en curso</p>
                </div>
                {canWrite && (
                  <Link href="/dashboard/proyectos/nuevo">
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                      <Plus className="w-3.5 h-3.5" /> Nuevo
                    </Button>
                  </Link>
                )}
              </div>

              {active.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderKanban className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Sin proyectos activos</p>
                  <Link href="/dashboard/proyectos/nuevo">
                    <Button variant="ghost" size="sm" className="mt-2 text-primary">Crear primer proyecto</Button>
                  </Link>
                </div>
              ) : (
                <Stagger className="space-y-3">
                  {active.slice(0, 4).map((p) => {
                    const bd = companyStats.projectsBreakdown.find((b) => b.projectId === p.id);
                    const covPct = bd && bd.requeridos > 0 ? Math.round((bd.cubiertos / bd.requeridos) * 100) : null;
                    return (
                    <StaggerItem key={p.id}>
                      <Link href={`/dashboard/proyectos/${p.id}`}>
                        <div className="flex items-center gap-4 p-4 rounded-xl border bg-background hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0 group-hover:from-primary/25 group-hover:to-primary/10 transition-colors">
                            <FolderKanban className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">{p.name}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              {p.client && <span className="text-xs text-muted-foreground truncate">{p.client}</span>}
                              {p.location && <span className="text-xs text-muted-foreground/60 truncate">{p.location}</span>}
                            </div>
                            {covPct !== null && (
                              <div className="flex items-center gap-2 mt-2">
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1 max-w-[160px]">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      covPct >= 90 ? "bg-emerald-500" : covPct >= 70 ? "bg-amber-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${Math.min(covPct, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-bold ${
                                  covPct >= 90 ? "text-emerald-700" : covPct >= 70 ? "text-amber-700" : "text-red-700"
                                }`}>
                                  {bd!.cubiertos}/{bd!.requeridos} dotación
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xs font-semibold text-foreground">{p.weeks} sem.</p>
                              <p className="text-[10px] text-muted-foreground">duración</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      </Link>
                    </StaggerItem>
                    );
                  })}
                  {active.length > 4 && (
                    <Link href="/dashboard/proyectos" className="block text-center text-xs text-primary hover:underline py-2 font-medium">
                      Ver {active.length - 4} proyectos más
                    </Link>
                  )}
                </Stagger>
              )}
            </div>
          </FadeUp>
        </div>

        {/* ── Alertas vacantes ─────────────────────────────────────────────── */}
        {companyStats.vacantesTotal > 0 && (
          <FadeUp>
            <div className="rounded-2xl p-5 bg-gradient-to-r from-red-50 via-rose-50 to-red-50 border border-red-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                </div>
                <p className="font-bold text-red-800 text-sm">
                  {companyStats.vacantesTotal} vacante{companyStats.vacantesTotal !== 1 ? "s" : ""} sin cubrir hoy
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {companyStats.projectsBreakdown.filter((p) => p.vacantes > 0).map((p) => (
                  <Link key={p.projectId} href={`/dashboard/proyectos/${p.projectId}`}>
                    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-red-200 bg-white text-red-700 hover:bg-red-100 hover:scale-105 transition-all font-medium">
                      {p.projectName}
                      <span className="bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{p.vacantes}</span>
                    </span>
                  </Link>
                ))}
                {companyStats.poolDisponible > 0 && (
                  <Link href="/dashboard/empleados">
                    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-105 transition-all font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      {companyStats.poolDisponible} habilitado{companyStats.poolDisponible !== 1 ? "s" : ""} disponible{companyStats.poolDisponible !== 1 ? "s" : ""}
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </FadeUp>
        )}

        {/* ── Stats secundarias ────────────────────────────────────────────── */}
        <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Proyectos vigentes", value: active.length,              icon: FolderKanban, grad: "from-blue-500 to-blue-600",     shadow: "shadow-blue-500/25" },
            { label: "Total proyectos",    value: projects.length,            icon: TrendingUp,   grad: "from-violet-500 to-violet-600", shadow: "shadow-violet-500/25" },
            { label: "Pool sin asignar",   value: companyStats.poolDisponible, icon: UserCheck,   grad: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/25" },
            {
              label: "Tiempo prom. 1ª asig.",
              value: companyStats.tiempoPromedioPrimeraAsignacionDias !== null
                ? companyStats.tiempoPromedioPrimeraAsignacionDias
                : null,
              suffix: "d",
              icon: Clock,
              grad: "from-amber-500 to-orange-500",
              shadow: "shadow-amber-500/25",
            },
          ].map((kpi) => (
            <StaggerItem key={kpi.label}>
              <div className="card-premium card-lift rounded-2xl p-5 flex items-center gap-4 h-full">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.grad} flex items-center justify-center flex-shrink-0 shadow-md ${kpi.shadow}`}>
                  <kpi.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground">
                    {kpi.value === null ? "—" : <CountUp value={kpi.value as number} suffix={kpi.suffix ?? ""} duration={1.1} />}
                  </p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

      </div>
    </div>
  );
}
