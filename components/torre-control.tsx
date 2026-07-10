"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { CountUp, Stagger, StaggerItem } from "@/components/motion-primitives";
import { assignWorkerToWeeks } from "@/lib/actions/workers";
import type { WeekDotacion } from "@/lib/actions/workers";
import type { DisponibleWorker } from "@/lib/actions/seguimiento";
import {
  AlertTriangle, ArrowRight, Check, Loader2, LogOut, Radar, Trophy, UserPlus, X,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function coverageColor(pct: number) {
  if (pct >= 100) return { bg: "bg-emerald-500", soft: "bg-emerald-50 border-emerald-200 text-emerald-800" };
  if (pct >= 85) return { bg: "bg-amber-400", soft: "bg-amber-50 border-amber-200 text-amber-800" };
  return { bg: "bg-red-500", soft: "bg-red-50 border-red-200 text-red-800" };
}

type CellSel = { weekIdx: number; roleId: string; roleName: string; deficit: number } | null;

export function TorreControl({
  weeksData,
  disponiblesHabilitados,
  canWrite,
}: {
  weeksData: WeekDotacion[];
  disponiblesHabilitados: DisponibleWorker[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<CellSel>(null);
  const [weekFilter, setWeekFilter] = useState<number | null>(null); // índice de semana filtrada desde el gráfico
  const [assigning, startAssign] = useTransition();
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  const now = Date.now();
  const currentIdx = Math.max(
    weeksData.findIndex((w) => now >= new Date(w.startDate).getTime() && now <= new Date(w.endDate).getTime()),
    0
  );

  // Datos del gráfico: curva requerida vs asignación (pasada y futura)
  const chartData = useMemo(
    () =>
      weeksData.map((w, i) => ({
        idx: i,
        semana: `S${w.weekNumber}`,
        Requeridos: w.cargosTotales,
        Asignados: w.totalWorkers,
        Habilitados: w.totalHabilitados,
      })),
    [weeksData]
  );

  // Semanas visibles en la matriz (filtradas por el gráfico si corresponde)
  const visibleWeeks = useMemo(
    () => (weekFilter === null ? weeksData.map((w, i) => ({ w, i })) : [{ w: weeksData[weekFilter], i: weekFilter }]),
    [weeksData, weekFilter]
  );

  // Cargos únicos presentes en cualquier semana (filas)
  const cargos = useMemo(() => {
    const map = new Map<string, { roleId: string; roleName: string; roleColor: string }>();
    for (const w of weeksData) {
      for (const r of w.roles) {
        if (!map.has(r.roleId)) map.set(r.roleId, { roleId: r.roleId, roleName: r.roleName, roleColor: r.roleColor });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.roleName.localeCompare(b.roleName));
  }, [weeksData]);

  // Celda por cargo × semana
  const cellData = (roleId: string, w: WeekDotacion) => {
    const r = w.roles.find((x) => x.roleId === roleId);
    if (!r || r.neededThisWeek === 0) return null;
    return { needed: r.neededThisWeek, hab: Math.min(r.filledHabilitado, r.neededThisWeek), total: r.workers.length };
  };

  // % cobertura habilitada por semana (semáforo)
  const weekPct = (w: WeekDotacion) => {
    const needed = w.roles.reduce((s, r) => s + r.neededThisWeek, 0);
    if (needed === 0) return 100;
    const hab = w.roles.reduce((s, r) => s + Math.min(r.filledHabilitado, r.neededThisWeek), 0);
    return Math.round((hab / needed) * 100);
  };

  // Próximas salidas: en semana w pero no en w+1 (ventana: actual + 2)
  const salidas = useMemo(() => {
    const out: { id: string; fullName: string; roleName: string; roleColor: string; lastWeek: number }[] = [];
    for (let i = currentIdx; i < Math.min(currentIdx + 3, weeksData.length - 1); i++) {
      const nextIds = new Set(weeksData[i + 1].roles.flatMap((r) => r.workers.map((wk) => wk.id)));
      for (const r of weeksData[i].roles) {
        for (const wk of r.workers) {
          if (!nextIds.has(wk.id) && !out.some((o) => o.id === wk.id)) {
            out.push({ id: wk.id, fullName: wk.fullName, roleName: r.roleName, roleColor: r.roleColor, lastWeek: weeksData[i].weekNumber });
          }
        }
      }
    }
    return out.sort((a, b) => a.lastWeek - b.lastWeek);
  }, [weeksData, currentIdx]);

  // Banco de habilitados por cargo
  const banco = useMemo(() => {
    const map = new Map<string, { roleName: string; roleColor: string; count: number }>();
    for (const d of disponiblesHabilitados) {
      const key = d.roleId ?? "sin-cargo";
      const entry = map.get(key);
      if (entry) entry.count++;
      else map.set(key, { roleName: d.roleName ?? "Sin cargo", roleColor: d.roleColor ?? "#94a3b8", count: 1 });
    }
    return Array.from(map.entries()).map(([roleId, v]) => ({ roleId, ...v })).sort((a, b) => b.count - a.count);
  }, [disponiblesHabilitados]);

  // Candidatos para la celda seleccionada
  const candidatos = useMemo(() => {
    if (!sel) return [];
    const sameRole = disponiblesHabilitados.filter((d) => d.roleId === sel.roleId && !assignedIds.has(d.id));
    const otherRole = disponiblesHabilitados.filter((d) => d.roleId !== sel.roleId && !assignedIds.has(d.id));
    return [...sameRole.map((d) => ({ ...d, match: true })), ...otherRole.map((d) => ({ ...d, match: false }))].slice(0, 12);
  }, [sel, disponiblesHabilitados, assignedIds]);

  function handleAssign(workerId: string, workerName: string) {
    if (!sel) return;
    const week = weeksData[sel.weekIdx];
    startAssign(async () => {
      try {
        await assignWorkerToWeeks(workerId, [week.weekPlanId], sel.roleId);
        setAssignedIds((prev) => new Set(prev).add(workerId));
        toast.success(`${workerName} asignado como ${sel.roleName} en S${week.weekNumber}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al asignar");
      }
    });
  }

  const kpiSemanas = weeksData.slice(currentIdx, currentIdx + 3);
  const gapsProximos = kpiSemanas.reduce((s, w) => {
    return s + w.roles.reduce((x, r) => x + Math.max(r.neededThisWeek - r.filledHabilitado, 0), 0);
  }, 0);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Cobertura semana actual", value: weekPct(weeksData[currentIdx] ?? weeksData[0]), suffix: "%", icon: Radar, grad: "from-blue-500 to-blue-600", shadow: "shadow-blue-500/25" },
          { label: "Gaps próximas 3 semanas", value: gapsProximos, icon: AlertTriangle, grad: gapsProximos > 0 ? "from-red-500 to-rose-600" : "from-emerald-500 to-emerald-600", shadow: gapsProximos > 0 ? "shadow-red-500/25" : "shadow-emerald-500/25" },
          { label: "Banco de habilitados", value: disponiblesHabilitados.length, icon: Trophy, grad: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/25" },
          { label: "Salidas próximas", value: salidas.length, icon: LogOut, grad: salidas.length > 0 ? "from-amber-500 to-orange-500" : "from-slate-400 to-slate-500", shadow: "shadow-amber-500/25" },
        ].map((k) => (
          <StaggerItem key={k.label}>
            <div className="card-premium card-lift rounded-2xl p-4 flex items-center gap-3 h-full">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.grad} flex items-center justify-center flex-shrink-0 shadow-md ${k.shadow}`}>
                <k.icon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black text-foreground leading-none">
                  <CountUp value={k.value} suffix={k.suffix ?? ""} duration={1.1} />
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{k.label}</p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {/* Curva de dotación vs asignación */}
      <div className="bg-background rounded-2xl border shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-foreground">Curva de dotación vs asignación</p>
          <div className="flex items-center gap-3">
            {weekFilter !== null && (
              <button
                onClick={() => setWeekFilter(null)}
                className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1 hover:bg-primary/15 transition-colors"
              >
                Filtrando S{weeksData[weekFilter].weekNumber} <X className="w-3 h-3" />
              </button>
            )}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-violet-500 inline-block" /> Requeridos</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-amber-500 inline-block" /> Asignados</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-emerald-500 inline-block" /> Habilitados</span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">clic en un punto para filtrar la matriz por esa semana</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
              onClick={(e) => {
                const idx = e?.activeTooltipIndex;
                if (typeof idx === "number") setWeekFilter((f) => (f === idx ? null : idx));
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="semana"
                tick={({ x, y, payload, index }) => (
                  <text
                    x={x} y={Number(y) + 12} textAnchor="middle"
                    className="cursor-pointer"
                    fontSize={10}
                    fontWeight={index === weekFilter || index === currentIdx ? 800 : 500}
                    fill={index === weekFilter ? "var(--primary)" : index === currentIdx ? "var(--primary)" : "var(--muted-foreground)"}
                    onClick={() => setWeekFilter((f) => (f === index ? null : index))}
                  >
                    {payload.value}
                  </text>
                )}
                axisLine={false} tickLine={false}
              />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <ChartTooltip
                contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, background: "var(--background)" }}
                labelFormatter={(l) => `Semana ${String(l).replace("S", "")}`}
              />
              <ReferenceLine
                x={chartData[currentIdx]?.semana}
                stroke="var(--primary)" strokeDasharray="4 4"
                label={{ value: "hoy", position: "top", fontSize: 9, fill: "var(--primary)" }}
              />
              {weekFilter !== null && (
                <ReferenceLine x={chartData[weekFilter]?.semana} stroke="var(--primary)" strokeOpacity={0.35} strokeWidth={24} />
              )}
              <Line type="monotone" dataKey="Requeridos" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 0, fill: "#8b5cf6" }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Asignados" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "#f59e0b" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Habilitados" stroke="#10b981" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "#10b981" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Semáforo de semanas */}
      <div className="bg-background rounded-2xl border shadow-sm p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Cobertura habilitada por semana
        </p>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {weeksData.map((w, i) => {
            const pct = weekPct(w);
            const col = coverageColor(pct);
            const isCurrent = i === currentIdx;
            const isPast = i < currentIdx;
            return (
              <button
                key={w.weekNumber}
                onClick={() => setWeekFilter((f) => (f === i ? null : i))}
                className={`flex flex-col items-center gap-1 min-w-11 ${isPast ? "opacity-35" : ""}`}
              >
                <span className={`text-[9px] font-bold ${isCurrent || weekFilter === i ? "text-primary" : "text-muted-foreground"}`}>
                  S{w.weekNumber}
                </span>
                <div
                  className={`w-full h-8 rounded-md ${col.bg} flex items-center justify-center relative transition-all hover:brightness-110 ${
                    isCurrent ? "ring-2 ring-primary ring-offset-1" : ""
                  } ${weekFilter === i ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  title={`Semana ${w.weekNumber}: ${pct}% cubierta con habilitados`}
                >
                  <span className="text-[9px] font-black text-white">{pct}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Matriz cargo × semana */}
        <div className="xl:col-span-2 bg-background rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">
              Déficit por cargo y semana
              {weekFilter !== null && (
                <span className="text-primary font-black"> — S{weeksData[weekFilter].weekNumber}</span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">habilitados / requeridos — clic en celda roja para cubrir</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-separate" style={{ borderSpacing: "2px" }}>
              <thead>
                <tr>
                  <th className="text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-2 sticky left-0 bg-background z-10 min-w-36">Cargo</th>
                  {visibleWeeks.map(({ w, i }) => (
                    <th key={w.weekNumber} className={`text-[9px] font-bold px-1 min-w-11 ${i === currentIdx ? "text-primary" : i < currentIdx ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                      S{w.weekNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cargos.map((c) => (
                  <tr key={c.roleId}>
                    <td className="px-2 py-1 sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.roleColor }} />
                        <span className="text-xs font-semibold text-foreground truncate max-w-32">{c.roleName}</span>
                      </div>
                    </td>
                    {visibleWeeks.map(({ w, i }) => {
                      const cell = cellData(c.roleId, w);
                      const isPast = i < currentIdx;
                      if (!cell) {
                        return <td key={w.weekNumber} className="text-center"><span className="text-[10px] text-muted-foreground/20">·</span></td>;
                      }
                      const deficit = cell.needed - cell.hab;
                      const full = deficit <= 0;
                      const zero = cell.hab === 0;
                      const isSel = sel?.weekIdx === i && sel?.roleId === c.roleId;
                      const clickable = canWrite && !isPast && deficit > 0;
                      return (
                        <td key={w.weekNumber} className="text-center p-0">
                          <button
                            disabled={!clickable}
                            onClick={() => clickable && setSel(isSel ? null : { weekIdx: i, roleId: c.roleId, roleName: c.roleName, deficit })}
                            className={`w-full h-8 rounded-md text-[10px] font-bold transition-all ${isPast ? "opacity-35" : ""} ${
                              full ? "bg-emerald-100 text-emerald-800" :
                              zero ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                            } ${clickable ? "hover:ring-2 hover:ring-primary/40 cursor-pointer" : "cursor-default"} ${isSel ? "ring-2 ring-primary" : ""}`}
                            title={`${c.roleName} · S${w.weekNumber}: ${cell.hab}/${cell.needed} habilitados${deficit > 0 ? ` — faltan ${deficit}` : ""}`}
                          >
                            {cell.hab}/{cell.needed}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Panel de candidatos */}
          <AnimatePresence>
            {sel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-foreground">
                      Cubrir <span className="text-primary">{sel.roleName}</span> en S{weeksData[sel.weekIdx].weekNumber}
                      <span className="text-muted-foreground font-normal"> — faltan {sel.deficit} habilitado{sel.deficit !== 1 ? "s" : ""}</span>
                    </p>
                    <button onClick={() => setSel(null)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {candidatos.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No hay habilitados disponibles en el banco. Revisa el pipeline de Empleados para acelerar habilitaciones.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {candidatos.map((cand) => (
                        <div
                          key={cand.id}
                          className={`flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2 ${cand.match ? "border-emerald-200" : ""}`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link href={`/dashboard/trabajadores/${cand.id}`} className="text-xs font-semibold text-foreground truncate hover:text-primary transition-colors block">
                              {cand.fullName}
                            </Link>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {cand.roleName ?? "Sin cargo"}{cand.match ? " · cargo exacto" : " · otro cargo"}
                            </p>
                          </div>
                          {cand.match && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                          <button
                            onClick={() => handleAssign(cand.id, cand.fullName)}
                            disabled={assigning}
                            className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                            Asignar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Columna derecha: banco + salidas */}
        <div className="space-y-5">
          {/* Banco de habilitados */}
          <div className="bg-background rounded-2xl border shadow-sm p-4">
            <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-500" /> Banco de habilitados
            </p>
            {banco.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin habilitados disponibles fuera del proyecto.</p>
            ) : (
              <div className="space-y-1.5">
                {banco.map((b) => (
                  <div key={b.roleId} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.roleColor }} />
                    <span className="text-xs text-foreground flex-1 truncate">{b.roleName}</span>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 rounded-md px-2 py-0.5">{b.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Próximas salidas */}
          <div className="bg-background rounded-2xl border shadow-sm p-4">
            <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-amber-500" /> Próximas salidas
              <span className="text-[10px] text-muted-foreground font-normal">(ventana 3 semanas)</span>
            </p>
            {salidas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin salidas programadas en la ventana.</p>
            ) : (
              <div className="space-y-1.5">
                {salidas.slice(0, 8).map((sal) => (
                  <Link
                    key={sal.id}
                    href={`/dashboard/trabajadores/${sal.id}`}
                    className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2 hover:border-primary/40 transition-all group"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sal.roleColor }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{sal.fullName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{sal.roleName}</p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">
                      sale S{sal.lastWeek}
                    </span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </Link>
                ))}
                {salidas.length > 8 && (
                  <p className="text-[10px] text-muted-foreground text-center pt-1">+{salidas.length - 8} más</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
