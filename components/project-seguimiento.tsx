"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CountUp, Stagger, StaggerItem } from "@/components/motion-primitives";
import type { SeguimientoData, SeguimientoRow } from "@/lib/actions/seguimiento";
import {
  AlertTriangle, Check, ChevronDown, Clipboard, FileText, Hammer,
  ShieldCheck, Trophy, Users, UserCheck,
} from "lucide-react";

const STAGE_ICONS = [Clipboard, FileText, Hammer, ShieldCheck];

// Colores por columna: 4 etapas + habilitados (mismos del pipeline)
const COL_COLORS = [
  { chevron: "bg-blue-600", text: "text-blue-700", soft: "bg-blue-50" },
  { chevron: "bg-indigo-600", text: "text-indigo-700", soft: "bg-indigo-50" },
  { chevron: "bg-orange-500", text: "text-orange-700", soft: "bg-orange-50" },
  { chevron: "bg-teal-600", text: "text-teal-700", soft: "bg-teal-50" },
];
const HAB_COLOR = { chevron: "bg-emerald-600", text: "text-emerald-700", soft: "bg-emerald-50" };

const CHEVRON_CLIP =
  "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)";

// ─── Fila expandible por cargo ───────────────────────────────────────────────
function CargoRow({ row, stagesTotal }: { row: SeguimientoRow; stagesTotal: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      row.total === 0 ? "border-red-200 bg-red-50/30" : row.alerta ? "border-amber-200" : "border-border bg-background"
    }`}>
      {/* Fila principal */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full grid items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        style={{ gridTemplateColumns: `minmax(160px, 1.6fr) repeat(${stagesTotal + 1}, minmax(52px, 1fr)) minmax(90px, 1.2fr) minmax(120px, 1.4fr) 24px` }}
      >
        {/* Cargo */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.roleColor }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{row.roleName}</p>
            <p className="text-[10px] text-muted-foreground">
              {row.total} asignado{row.total !== 1 ? "s" : ""}{row.requeridos > 0 ? ` · req. ${row.requeridos}` : ""}
            </p>
          </div>
        </div>

        {/* Conteos por etapa */}
        {row.byStage.map((n, i) => (
          <div key={i} className="text-center">
            {n > 0 ? (
              <span className={`inline-flex items-center justify-center min-w-7 h-7 rounded-lg text-xs font-bold ${COL_COLORS[i].soft} ${COL_COLORS[i].text}`}>
                {n}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/30">—</span>
            )}
          </div>
        ))}

        {/* Habilitados */}
        <div className="text-center">
          {row.habilitados > 0 ? (
            <span className={`inline-flex items-center justify-center gap-1 min-w-7 h-7 px-2 rounded-lg text-xs font-bold ${HAB_COLOR.soft} ${HAB_COLOR.text}`}>
              <Check className="w-3 h-3" />{row.habilitados}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/30">—</span>
          )}
        </div>

        {/* % habilitados + barra */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold ${row.pctHabilitados >= 100 ? "text-emerald-700" : "text-foreground"}`}>
              {row.pctHabilitados}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(row.pctHabilitados, 100)}%`,
                background: row.pctHabilitados >= 100
                  ? "linear-gradient(90deg, #10b981, #34d399)"
                  : "linear-gradient(90deg, #f59e0b, #fbbf24)",
              }}
            />
          </div>
        </div>

        {/* Alerta */}
        <div className="min-w-0">
          {row.alerta ? (
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full border truncate max-w-full ${
              row.total === 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"
            }`}>
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{row.alerta}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
              <Check className="w-3 h-3" /> OK
            </span>
          )}
        </div>

        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Personas del cargo */}
      <AnimatePresence>
        {open && row.workers.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t bg-muted/20 px-4 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {row.workers.map((w) => {
                  const col = w.habilitado ? HAB_COLOR : COL_COLORS[w.stageOrder - 1] ?? COL_COLORS[0];
                  return (
                    <Link
                      key={w.id}
                      href={`/dashboard/trabajadores/${w.id}`}
                      className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2 hover:border-primary/40 hover:shadow-sm transition-all group"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${col.soft}`}>
                        {w.habilitado
                          ? <Trophy className={`w-3.5 h-3.5 ${col.text}`} />
                          : <span className={`text-[10px] font-black ${col.text}`}>{w.stageOrder}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{w.fullName}</p>
                        <p className="text-[10px] text-muted-foreground">{w.rut}</p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${col.text}`}>
                        {w.habilitado ? "Habilitado" : `Etapa ${w.stageOrder}`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
        {open && row.workers.length === 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="border-t px-4 py-3 text-xs text-muted-foreground italic bg-muted/20">
              Ningún trabajador de este cargo asignado al proyecto.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export function ProjectSeguimiento({ data }: { data: SeguimientoData }) {
  const stagesTotal = data.stages.length;

  const kpis = [
    { label: "Dotación requerida", value: data.kpis.dotacionRequerida, icon: Users, grad: "from-blue-500 to-blue-600", shadow: "shadow-blue-500/25" },
    { label: "Asignados a faena", value: data.kpis.asignados, icon: UserCheck, grad: "from-indigo-500 to-violet-600", shadow: "shadow-indigo-500/25" },
    { label: "Habilitados", value: data.kpis.habilitados, suffix: ` (${data.kpis.pctHabilitados}%)`, icon: Trophy, grad: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/25" },
    { label: "Cargos con alerta", value: data.kpis.cargosAlerta, icon: AlertTriangle, grad: data.kpis.cargosAlerta > 0 ? "from-red-500 to-rose-600" : "from-slate-400 to-slate-500", shadow: data.kpis.cargosAlerta > 0 ? "shadow-red-500/25" : "shadow-slate-400/25" },
  ];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <StaggerItem key={k.label}>
            <div className="card-premium card-lift rounded-2xl p-4 flex items-center gap-3 h-full">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.grad} flex items-center justify-center flex-shrink-0 shadow-md ${k.shadow}`}>
                <k.icon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black text-foreground leading-none">
                  <CountUp value={k.value} duration={1.1} />
                  {k.suffix && <span className="text-xs font-bold text-muted-foreground">{k.suffix}</span>}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">{k.label}</p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {/* Chevron de distribución por etapa */}
      <div className="flex w-full overflow-hidden rounded-xl border border-border shadow-sm">
        {data.stages.map((stage, i) => {
          const Icon = STAGE_ICONS[i] ?? FileText;
          return (
            <div
              key={stage.order}
              className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-3 px-2 text-white ${COL_COLORS[i].chevron}`}
              style={{ clipPath: CHEVRON_CLIP }}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                <span className="text-[10px] font-bold uppercase tracking-wide leading-tight truncate max-w-[90px]">
                  {stage.name}
                </span>
              </div>
              <span className="text-lg font-black leading-none">
                <CountUp value={data.stageTotals[i]} duration={1} />
              </span>
            </div>
          );
        })}
        {/* Habilitados */}
        <div
          className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-3 px-2 text-white ${HAB_COLOR.chevron}`}
          style={{ clipPath: CHEVRON_CLIP }}
        >
          <div className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
            <span className="text-[10px] font-bold uppercase tracking-wide leading-tight">Habilitados</span>
          </div>
          <span className="text-lg font-black leading-none">
            <CountUp value={data.habilitadosTotal} duration={1} />
          </span>
        </div>
      </div>

      {/* Matriz cargo × etapa */}
      <div className="bg-background rounded-2xl border shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-sm font-bold text-foreground">Seguimiento por cargo</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">clic en un cargo para ver las personas</p>
        </div>

        {/* Header de columnas */}
        <div
          className="grid items-center gap-2 px-4 pb-2 border-b mb-2"
          style={{ gridTemplateColumns: `minmax(160px, 1.6fr) repeat(${stagesTotal + 1}, minmax(52px, 1fr)) minmax(90px, 1.2fr) minmax(120px, 1.4fr) 24px` }}
        >
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Cargo</span>
          {data.stages.map((s, i) => (
            <span key={s.order} className={`text-[9px] font-bold uppercase tracking-widest text-center ${COL_COLORS[i].text}`} title={s.name}>
              E{s.order}
            </span>
          ))}
          <span className={`text-[9px] font-bold uppercase tracking-widest text-center ${HAB_COLOR.text}`}>Hab.</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">% Habilitados</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Alerta</span>
          <span />
        </div>

        <Stagger className="space-y-2">
          {data.rows.map((row) => (
            <StaggerItem key={row.roleId}>
              <CargoRow row={row} stagesTotal={stagesTotal} />
            </StaggerItem>
          ))}
        </Stagger>

        {data.rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Este proyecto no tiene trabajadores asignados ni requerimientos de dotación.
          </p>
        )}
      </div>
    </div>
  );
}
