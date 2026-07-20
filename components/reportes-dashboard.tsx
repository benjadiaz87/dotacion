"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProyeccionChart, CoberturaBarChart, SemaphoreBar, ProyectoDetalleChart } from "@/components/reportes-charts";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  UserCheck,
  RefreshCw,
  Search,
  X,
  SlidersHorizontal,
  Calculator,
} from "lucide-react";
import Link from "next/link";
import { statusConfig } from "@/lib/project-utils";
import type { ReportesData } from "@/lib/actions/reportes";

const ALL = "__all__";

interface Props {
  data: ReportesData;
  generadoEn: string;
}

export function ReportesDashboard({ data, generadoEn }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [soloVacantes, setSoloVacantes] = useState(false);
  const [ordenar, setOrdenar] = useState<"vacantes" | "cobertura_asc" | "cobertura_desc" | "nombre">("vacantes");
  const [proyectosOcultos, setProyectosOcultos] = useState<Set<string>>(new Set());
  const [proyectoDetalleId, setProyectoDetalleId] = useState<string>(
    () => data.proyeccionDetalle[0]?.id ?? ""
  );

  const toggleProyecto = (id: string) =>
    setProyectosOcultos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const proyectosFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = data.coberturaProyectos.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.client ?? "").toLowerCase().includes(q)) return false;
      if (statusFilter !== ALL && p.status !== statusFilter) return false;
      if (soloVacantes && p.vacantes === 0) return false;
      return true;
    });
    if (ordenar === "vacantes") list = [...list].sort((a, b) => b.vacantes - a.vacantes);
    if (ordenar === "cobertura_asc") list = [...list].sort((a, b) => a.pct - b.pct);
    if (ordenar === "cobertura_desc") list = [...list].sort((a, b) => b.pct - a.pct);
    if (ordenar === "nombre") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [data.coberturaProyectos, query, statusFilter, soloVacantes, ordenar]);

  const proyectosActivosVisibles = useMemo(
    () => data.proyectosActivos.filter((p) => !proyectosOcultos.has(p.id)),
    [data.proyectosActivos, proyectosOcultos]
  );

  const proyeccionFiltrada = useMemo(() => {
    if (proyectosOcultos.size === 0) return data.proyeccionVacantes;
    const visibleNames = new Set(proyectosActivosVisibles.map((p) => p.name));
    return data.proyeccionVacantes.map((row) => {
      const next: typeof row = { weekNumber: row.weekNumber };
      for (const [k, v] of Object.entries(row)) {
        if (k === "weekNumber" || visibleNames.has(k)) next[k] = v;
      }
      return next;
    });
  }, [data.proyeccionVacantes, proyectosOcultos, proyectosActivosVisibles]);

  const hasActiveFilters = query !== "" || statusFilter !== ALL || soloVacantes;

  function clearFilters() {
    setQuery("");
    setStatusFilter(ALL);
    setSoloVacantes(false);
  }

  // KPIs over filtered list
  const coberturaFiltrada =
    proyectosFiltrados.length > 0
      ? Math.round(
          proyectosFiltrados.reduce((s, p) => s + p.pct, 0) / proyectosFiltrados.length
        )
      : 0;
  const vacantesFilteradas = proyectosFiltrados.reduce((s, p) => s + p.vacantes, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Generado el {generadoEn}</p>
        </div>
        <Link
          href="/dashboard/roi"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border bg-background text-sm font-semibold text-violet-700 hover:bg-violet-50 hover:border-violet-200 transition-colors flex-shrink-0"
        >
          <Calculator className="w-4 h-4" /> Calculadora de ROI
        </Link>
      </div>

      {/* KPIs ejecutivos — siempre globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Cobertura promedio",
            value: `${data.coberturaPromedio}%`,
            icon: TrendingUp,
            color: data.coberturaPromedio >= 80 ? "text-emerald-600" : data.coberturaPromedio >= 50 ? "text-amber-600" : "text-red-600",
            bg: data.coberturaPromedio >= 80 ? "bg-emerald-50" : data.coberturaPromedio >= 50 ? "bg-amber-50" : "bg-red-50",
          },
          {
            label: "Vacantes totales hoy",
            value: data.totalVacantes,
            icon: AlertTriangle,
            color: data.totalVacantes === 0 ? "text-emerald-600" : "text-red-600",
            bg: data.totalVacantes === 0 ? "bg-emerald-50" : "bg-red-50",
          },
          {
            label: "Pool disponible",
            value: data.poolDisponible,
            icon: UserCheck,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Asignaciones (30d)",
            value: data.rotacion30dias,
            icon: RefreshCw,
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="border shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.bg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fila: Tabla cobertura + Semáforo */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Tabla cobertura */}
        <Card className="border shadow-sm lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">Cobertura por proyecto</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {proyectosFiltrados.length} de {data.coberturaProyectos.length} proyectos
                  {hasActiveFilters && (
                    <span className="ml-2 text-primary">
                      · {coberturaFiltrada}% cobertura · {vacantesFilteradas} vacantes
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar proyecto..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="Estado">
                    {(v: string) =>
                      v === ALL || !v ? "Todos" : statusConfig[v as keyof typeof statusConfig]?.label ?? v
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  <SelectItem value="ACTIVE">Activo</SelectItem>
                  <SelectItem value="PAUSED">Pausado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={ordenar} onValueChange={(v) => setOrdenar(v as typeof ordenar)}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Ordenar">
                    {(v: string) => {
                      const labels: Record<string, string> = {
                        vacantes: "Más vacantes",
                        cobertura_asc: "Menor cobertura",
                        cobertura_desc: "Mayor cobertura",
                        nombre: "Nombre A-Z",
                      };
                      return labels[v] ?? "Ordenar";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacantes">Más vacantes</SelectItem>
                  <SelectItem value="cobertura_asc">Menor cobertura</SelectItem>
                  <SelectItem value="cobertura_desc">Mayor cobertura</SelectItem>
                  <SelectItem value="nombre">Nombre A-Z</SelectItem>
                </SelectContent>
              </Select>

              <button
                type="button"
                onClick={() => setSoloVacantes((v) => !v)}
                className={`h-8 px-3 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  soloVacantes
                    ? "bg-red-50 border-red-300 text-red-700 ring-1 ring-red-400"
                    : "bg-background border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                Solo con vacantes
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" /> Limpiar
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {proyectosFiltrados.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Sin proyectos con los filtros seleccionados.
              </div>
            ) : (
              <div className="divide-y">
                {proyectosFiltrados.map((p) => {
                  const pctHab = p.totales > 0 ? (p.habilitados / p.totales) * 100 : 0;
                  const pctSin = p.totales > 0 ? (p.sinHabilitar / p.totales) * 100 : 0;
                  const pctVac = p.totales > 0 ? (p.vacantes / p.totales) * 100 : 0;
                  const sc = statusConfig[p.status as keyof typeof statusConfig];
                  return (
                    <Link
                      key={p.id}
                      href={`/dashboard/proyectos/${p.id}`}
                      className="flex flex-col px-6 py-4 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                            {p.name}
                          </span>
                          {p.client && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">· {p.client}</span>
                          )}
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${sc.color}`}>
                            {sc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {p.vacantes > 0 ? (
                            <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              {p.vacantes} vacante{p.vacantes !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          )}
                          <span className="text-sm font-bold w-10 text-right">{p.pct}%</span>
                        </div>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                        <div className="h-full bg-emerald-500" style={{ width: `${pctHab}%` }} />
                        <div className="h-full bg-amber-400" style={{ width: `${pctSin}%` }} />
                        <div className="h-full bg-red-400" style={{ width: `${pctVac}%` }} />
                      </div>
                      {p.cargoMasCritico && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.cargoMasCritico.color }} />
                          Más crítico: <strong className="text-foreground">{p.cargoMasCritico.name}</strong>
                          <span>(faltan {p.cargoMasCritico.deficit})</span>
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Semáforo docs */}
        <Card className="border shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documentación de dotación</CardTitle>
            <p className="text-xs text-muted-foreground">{data.semaphoreStats.total} trabajadores registrados</p>
          </CardHeader>
          <CardContent>
            <SemaphoreBar stats={data.semaphoreStats} />
            <div className="mt-6 space-y-3 border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pool disponible</span>
                <span className="font-semibold text-blue-700">{data.poolDisponible} sin asignar</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">% Habilitados en terreno</span>
                <span className="font-semibold">{data.pctHabilitados}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Proyección de vacantes */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base">Proyección de vacantes por semana</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Déficit de dotación semana a semana — proyectos activos
              </p>
            </div>
            {/* Toggle de proyectos */}
            {data.proyectosActivos.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {data.proyectosActivos.map((p) => {
                  const oculto = proyectosOcultos.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProyecto(p.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        oculto
                          ? "border-border text-muted-foreground bg-background opacity-40"
                          : "border-transparent text-white"
                      }`}
                      style={oculto ? {} : { background: p.color }}
                    >
                      {p.name}
                      {oculto ? null : <X className="w-2.5 h-2.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ProyeccionChart data={proyeccionFiltrada} proyectos={proyectosActivosVisibles} />
        </CardContent>
      </Card>

      {/* Detalle semana a semana por proyecto */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base">Cobertura semana a semana</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Proyecto completo · verde = cubiertos, rojo = vacantes
              </p>
            </div>
            {data.proyeccionDetalle.length > 1 && (
              <Select value={proyectoDetalleId} onValueChange={(v) => setProyectoDetalleId(v ?? data.proyeccionDetalle[0]?.id ?? "")}>
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue placeholder="Selecciona proyecto">
                    {(v: string) => data.proyeccionDetalle.find((p) => p.id === v)?.name ?? "Selecciona proyecto"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {data.proyeccionDetalle.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const proyecto = data.proyeccionDetalle.find((p) => p.id === proyectoDetalleId);
            if (!proyecto) return (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                Sin proyectos activos con datos de proyección.
              </div>
            );
            const totalVac = proyecto.semanas.reduce((s, w) => s + w.vacantes, 0);
            const peakSemana = proyecto.semanas.reduce((prev, cur) => cur.totales > prev.totales ? cur : prev, proyecto.semanas[0]);
            return (
              <div>
                <div className="flex gap-6 mb-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Semanas: </span>
                    <strong>{proyecto.semanas.length}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vacantes acumuladas: </span>
                    <strong className={totalVac > 0 ? "text-red-600" : "text-emerald-600"}>{totalVac}</strong>
                  </div>
                  {peakSemana && (
                    <div>
                      <span className="text-muted-foreground">Peak dotación: </span>
                      <strong>S{peakSemana.weekNumber} ({peakSemana.totales} personas)</strong>
                    </div>
                  )}
                </div>
                <ProyectoDetalleChart proyecto={proyecto} />
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
