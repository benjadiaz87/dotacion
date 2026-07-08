"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import type { CriticalForecast, RoleDotacion, WeekDotacion } from "@/lib/actions/workers";
import { removeAssignment } from "@/lib/actions/workers";
import { computeRoleFillSplit, formatDate, formatWeekRange, type DotacionWorker } from "@/lib/project-utils";
import { AssignWorkerDialog } from "@/components/assign-worker-dialog";
import { toast } from "sonner";

type Role = { id: string; name: string; color: string };
type WeekPlan = { id: string; weekNumber: number };

interface Props {
  weeksData: WeekDotacion[];
  projectProgress: number;
  criticalForecast: CriticalForecast;
  roles: Role[];
  weekPlans: WeekPlan[];
}

const ALL = "__all__";

type AggregateView = {
  weekNumber: null;
  startDate: Date;
  endDate: Date;
  totalWorkers: number;
  totalHabilitados: number;
  criticos: number;
  cargosCubiertos: number;
  cargosTotales: number;
  vacantesTotal: number;
  cargoMasCritico: { roleId: string; roleName: string; roleColor: string; deficit: number } | null;
  roles: RoleDotacion[];
};

function buildAggregateView(weeksData: WeekDotacion[]): AggregateView | null {
  if (weeksData.length === 0) return null;

  const roleAgg = new Map<
    string,
    { roleId: string; roleName: string; roleColor: string; workers: Map<string, DotacionWorker>; neededPeak: number }
  >();

  for (const wp of weeksData) {
    for (const role of wp.roles) {
      if (!roleAgg.has(role.roleId)) {
        roleAgg.set(role.roleId, {
          roleId: role.roleId,
          roleName: role.roleName,
          roleColor: role.roleColor,
          workers: new Map(),
          neededPeak: 0,
        });
      }
      const entry = roleAgg.get(role.roleId)!;
      entry.neededPeak = Math.max(entry.neededPeak, role.neededThisWeek);
      for (const w of role.workers) entry.workers.set(w.id, w);
    }
  }

  const roles: RoleDotacion[] = Array.from(roleAgg.values())
    .map((entry) => {
      const workers = Array.from(entry.workers.values());
      const split = computeRoleFillSplit(workers, entry.neededPeak);
      return {
        roleId: entry.roleId,
        roleName: entry.roleName,
        roleColor: entry.roleColor,
        workers,
        habilitadosCount: split.habilitadosCount,
        neededThisWeek: entry.neededPeak,
        filledHabilitado: split.filledHabilitado,
        filledSinHabilitar: split.filledSinHabilitar,
        vacantes: split.vacantes,
      };
    })
    .sort((a, b) => a.roleName.localeCompare(b.roleName));

  const allWorkers = new Map<string, DotacionWorker>();
  for (const r of roles) for (const w of r.workers) allWorkers.set(w.id, w);

  const totalWorkers = allWorkers.size;
  const totalHabilitados = Array.from(allWorkers.values()).filter((w) => w.habilitado).length;
  const criticos = roles.filter((r) => r.workers.length < r.neededThisWeek || r.habilitadosCount === 0).length;
  const cargosTotales = roles.reduce((s, r) => s + r.neededThisWeek, 0);
  const cargosCubiertos = roles.reduce((s, r) => s + r.filledHabilitado + r.filledSinHabilitar, 0);
  const vacantesTotal = roles.reduce((s, r) => s + r.vacantes, 0);
  const cargoMasCritico = roles.filter((r) => r.vacantes > 0).sort((a, b) => b.vacantes - a.vacantes)[0];

  return {
    weekNumber: null,
    startDate: weeksData[0].startDate,
    endDate: weeksData[weeksData.length - 1].endDate,
    totalWorkers,
    totalHabilitados,
    criticos,
    cargosCubiertos,
    cargosTotales,
    vacantesTotal,
    cargoMasCritico: cargoMasCritico
      ? {
          roleId: cargoMasCritico.roleId,
          roleName: cargoMasCritico.roleName,
          roleColor: cargoMasCritico.roleColor,
          deficit: cargoMasCritico.vacantes,
        }
      : null,
    roles,
  };
}

function WorkerRow({ worker, weekPlanId }: { worker: DotacionWorker; weekPlanId: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function handleRemove() {
    if (!weekPlanId) return;
    startTransition(async () => {
      await removeAssignment(worker.id, weekPlanId);
      toast.success(`${worker.fullName} removido de esta semana`);
      setConfirm(false);
    });
  }

  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border hover:border-primary/40 transition-colors group">
      <Link href={`/dashboard/trabajadores/${worker.id}`} className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{worker.fullName}</p>
          <p className="text-xs text-muted-foreground">{worker.rut}</p>
        </div>
        {worker.habilitado ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 flex-shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" /> Habilitado
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-700 flex-shrink-0">
            <ShieldAlert className="w-3.5 h-3.5" /> Pendiente
          </span>
        )}
      </Link>

      {weekPlanId && (
        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {confirm ? (
            <>
              <button
                onClick={handleRemove}
                disabled={isPending}
                className="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium transition-colors"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmar"}
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Remover de esta semana"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DotacionView({ weeksData, projectProgress, criticalForecast, roles, weekPlans }: Props) {
  const [weekIndex, setWeekIndex] = useState<number | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [onlyVacantes, setOnlyVacantes] = useState(false);

  const aggregate = useMemo(() => buildAggregateView(weeksData), [weeksData]);
  const isAggregate = weekIndex === null;
  const current = isAggregate ? aggregate : weeksData[weekIndex];
  const previous = !isAggregate && weekIndex > 0 ? weeksData[weekIndex - 1] : null;

  const roleOptions = useMemo(
    () => (current ? current.roles.map((r) => ({ id: r.roleId, name: r.roleName, color: r.roleColor })) : []),
    [current]
  );

  const hasActiveFilters = query !== "" || roleFilter !== ALL || statusFilter !== ALL || onlyVacantes;

  function clearFilters() {
    setQuery("");
    setRoleFilter(ALL);
    setStatusFilter(ALL);
    setOnlyVacantes(false);
  }

  const filteredRoles = useMemo(() => {
    if (!current) return [];
    const q = query.trim().toLowerCase();

    return current.roles
      .filter((role) => roleFilter === ALL || role.roleId === roleFilter)
      .filter((role) => !onlyVacantes || role.vacantes > 0)
      .filter((role) => statusFilter !== "true" || role.habilitadosCount > 0)
      .filter((role) => statusFilter !== "false" || role.filledSinHabilitar > 0)
      .map((role) => {
        const displayWorkers = role.workers.filter((w) => {
          if (q && !w.fullName.toLowerCase().includes(q) && !w.rut.toLowerCase().includes(q)) return false;
          if (statusFilter !== ALL && String(w.habilitado) !== statusFilter) return false;
          return true;
        });
        return { ...role, displayWorkers };
      })
      .filter((role) => !q || role.displayWorkers.length > 0);
  }, [current, query, roleFilter, statusFilter, onlyVacantes]);

  if (!current) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Este proyecto no tiene semanas configuradas.</p>
        </CardContent>
      </Card>
    );
  }

  const trend = previous ? current.cargosCubiertos - previous.cargosCubiertos : null;
  const pctCubierto = current.cargosTotales > 0 ? Math.round((current.cargosCubiertos / current.cargosTotales) * 100) : 100;

  return (
    <div className="space-y-4">
      {/* Selector de semana */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-xs text-muted-foreground flex-shrink-0">Semana</span>
        <div className="flex-1">
          <Slider
            value={[weekIndex ?? 0]}
            min={0}
            max={weeksData.length - 1}
            step={1}
            onValueChange={(v) => setWeekIndex(Array.isArray(v) ? v[0] : v)}
          />
        </div>
        {isAggregate ? (
          <span className="text-xs text-muted-foreground flex-shrink-0">{weeksData.length} semanas</span>
        ) : (
          <button
            type="button"
            onClick={() => setWeekIndex(null)}
            className="inline-flex items-center gap-1 flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            S{current.weekNumber} · {formatWeekRange(current.startDate, current.endDate)}
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Headline + KPIs unificados */}
      <Card className="border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Fill stat */}
            <div className="flex-1 min-w-[160px]">
              <p className="text-xs text-muted-foreground mb-1">
                {isAggregate ? "Cargos cubiertos en todo el proyecto" : "Cargos cubiertos esta semana"}
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">
                  {current.cargosCubiertos}
                  <span className="text-lg text-muted-foreground font-medium ml-1.5">de {current.cargosTotales}</span>
                </p>
                <span className="text-sm font-semibold text-muted-foreground">{pctCubierto}%</span>
                {trend !== null && trend !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {Math.abs(trend)} vs. S{previous?.weekNumber}
                  </span>
                )}
                {trend === 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Minus className="w-3.5 h-3.5" /> sin cambios
                  </span>
                )}
              </div>
              <Progress value={pctCubierto} className="h-1.5 mt-2 w-48" />
              {current.cargoMasCritico && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: current.cargoMasCritico.roleColor }} />
                  Más crítico: <strong className="text-foreground">{current.cargoMasCritico.roleName}</strong>
                  <span>(faltan {current.cargoMasCritico.deficit})</span>
                </p>
              )}
            </div>

            {/* KPI chips clickeables */}
            <div className="flex gap-2 flex-wrap items-start">
              <button
                type="button"
                onClick={() => setOnlyVacantes((v) => !v)}
                className={`rounded-lg border px-4 py-2.5 text-left transition-all min-w-[90px] ${
                  onlyVacantes
                    ? "bg-red-100 border-red-400 ring-2 ring-red-400"
                    : "bg-red-50 border-red-200 hover:bg-red-100"
                }`}
              >
                <p className="text-[11px] text-red-600 font-medium">Vacantes</p>
                <p className="text-2xl font-bold text-red-800 leading-none mt-0.5">{current.vacantesTotal}</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter((s) => (s === "true" ? ALL : "true"))}
                className={`rounded-lg border px-4 py-2.5 text-left transition-all min-w-[90px] ${
                  statusFilter === "true"
                    ? "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400"
                    : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                <p className="text-[11px] text-emerald-600 font-medium">Habilitados</p>
                <p className="text-2xl font-bold text-emerald-800 leading-none mt-0.5">{current.totalHabilitados}</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter((s) => (s === "false" ? ALL : "false"))}
                className={`rounded-lg border px-4 py-2.5 text-left transition-all min-w-[90px] ${
                  statusFilter === "false"
                    ? "bg-amber-100 border-amber-400 ring-2 ring-amber-400"
                    : "bg-amber-50 border-amber-200 hover:bg-amber-100"
                }`}
              >
                <p className="text-[11px] text-amber-600 font-medium">Sin habilitar</p>
                <p className="text-2xl font-bold text-amber-800 leading-none mt-0.5">
                  {current.totalWorkers - current.totalHabilitados}
                </p>
              </button>
            </div>
          </div>

          {criticalForecast && criticalForecast.weeksFromNow > 0 && (
            <div className="mt-4 pt-3 border-t flex items-center gap-2 text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Próxima vacante crítica en {criticalForecast.weeksFromNow} semana{criticalForecast.weeksFromNow !== 1 ? "s" : ""}:{" "}
              <strong>{criticalForecast.roleName}</strong> (S{criticalForecast.weekNumber}, faltan {criticalForecast.deficit})
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o RUT..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? ALL)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Cargo">
              {(value: string) =>
                value === ALL || !value
                  ? "Todos los cargos"
                  : roleOptions.find((r) => r.id === value)?.name ?? "Cargo"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los cargos</SelectItem>
            {roleOptions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  {r.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Estado">
              {(value: string) => {
                if (value === ALL || !value) return "Todos los estados";
                return value === "true" ? "Habilitado" : "Pendiente";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            <SelectItem value="true">Habilitado</SelectItem>
            <SelectItem value="false">Pendiente</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Role cards */}
      {current.roles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Sin trabajadores asignados. Usa &quot;Asignar trabajador&quot; para comenzar.
            </p>
          </CardContent>
        </Card>
      ) : filteredRoles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Ningún trabajador coincide con los filtros seleccionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredRoles.map((role) => {
            const workersForList = hasActiveFilters ? role.displayWorkers : role.workers;
            const needed = role.neededThisWeek;
            const totalForBar = Math.max(needed, role.filledHabilitado + role.filledSinHabilitar);
            const pctHabilitado = totalForBar > 0 ? (role.filledHabilitado / totalForBar) * 100 : 0;
            const pctSinHabilitar = totalForBar > 0 ? (role.filledSinHabilitar / totalForBar) * 100 : 0;
            const isExpanded = expandedRole === role.roleId;
            const sinNadie = needed > 0 && role.workers.length === 0;

            return (
              <Card key={role.roleId} className="border shadow-sm overflow-hidden">
                <button
                  className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedRole(isExpanded ? null : role.roleId)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: role.roleColor }} />
                      <span className="font-semibold text-sm truncate">{role.roleName}</span>
                      {role.vacantes > 0 && <ShieldAlert className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          role.vacantes === 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {role.filledHabilitado + role.filledSinHabilitar} / {needed} cargos
                      </span>
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                  </div>

                  {sinNadie ? (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-red-600 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {isAggregate ? "Sin nadie asignado en todo el proyecto" : "Sin nadie asignado esta semana"}
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const pctVacante = totalForBar > 0 ? (role.vacantes / totalForBar) * 100 : 0;
                        const dimGreen = statusFilter === "false" || onlyVacantes;
                        const dimAmber = statusFilter === "true" || onlyVacantes;
                        const dimRed   = statusFilter !== ALL;
                        return (
                          <div className="flex h-2.5 rounded-full overflow-hidden bg-muted mt-3">
                            <div className="h-full transition-all" style={{ width: `${pctHabilitado}%`, background: "#22c55e", opacity: dimGreen ? 0.25 : 1 }} />
                            <div className="h-full transition-all" style={{ width: `${pctSinHabilitar}%`, background: "#fbbf24", opacity: dimAmber ? 0.25 : 1 }} />
                            <div className="h-full transition-all" style={{ width: `${pctVacante}%`, background: "#f87171", opacity: dimRed ? 0.25 : 1 }} />
                          </div>
                        );
                      })()}
                      <div className="flex gap-4 mt-2 text-[11px]">
                        <span className={`flex items-center gap-1 transition-opacity ${statusFilter === "false" || onlyVacantes ? "opacity-30" : "text-muted-foreground"}`}>
                          <span className="w-2 h-2 rounded-sm bg-emerald-500" /> {role.filledHabilitado} habilitados
                        </span>
                        {role.filledSinHabilitar > 0 && (
                          <span className={`flex items-center gap-1 transition-opacity ${statusFilter === "true" || onlyVacantes ? "opacity-30" : "text-muted-foreground"}`}>
                            <span className="w-2 h-2 rounded-sm bg-amber-400" /> {role.filledSinHabilitar} por habilitar
                          </span>
                        )}
                        {role.vacantes > 0 && (
                          <span className={`flex items-center gap-1 transition-opacity ${statusFilter !== ALL ? "opacity-30" : "text-red-600"} ${onlyVacantes ? "opacity-100 text-red-600 font-semibold" : ""}`}>
                            <span className="w-2 h-2 rounded-sm bg-red-200" /> {role.vacantes} vacante{role.vacantes !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t bg-muted/20 p-3 space-y-1.5">
                    <div className="pb-2 border-b border-border/60">
                      <AssignWorkerDialog
                        roles={roles}
                        weekPlans={weekPlans}
                        defaultRoleId={role.roleId}
                        trigger={
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer">
                            <Plus className="w-3.5 h-3.5" />
                            Asignar trabajador como {role.roleName}
                          </span>
                        }
                      />
                    </div>
                    {workersForList.map((w) => (
                      <WorkerRow
                        key={w.id}
                        worker={w}
                        weekPlanId={isAggregate ? null : (current as WeekDotacion).weekPlanId}
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
