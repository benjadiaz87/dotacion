"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, Loader2, Search, Sparkles, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import type { WorkerListItem } from "@/lib/actions/workers";
import { deleteWorker } from "@/lib/actions/workers";
import { toast } from "sonner";
import { exportEmpleados } from "@/lib/export-excel";

const semaphoreConfig = {
  green: { dot: "bg-emerald-500", label: "Habilitado", text: "text-emerald-700", bar: "bg-emerald-500" },
  yellow: { dot: "bg-amber-500", label: "En proceso", text: "text-amber-700", bar: "bg-amber-500" },
  red: { dot: "bg-red-500", label: "Sin iniciar", text: "text-red-700", bar: "bg-red-400" },
};

const ALL = "__all__";

// Orden por columna. Por defecto: cargo → RUT → nombre
type SortKey = "fullName" | "rut" | "cargo" | "pipeline" | "proyectos" | "estado";
type SortDir = "asc" | "desc";

/** RUT comparable numéricamente: "24.101.918-3" → 24101918 */
function rutValue(rut: string): number {
  return Number(rut.replace(/\./g, "").split("-")[0]) || 0;
}

function compareBy(key: SortKey, a: WorkerListItem, b: WorkerListItem): number {
  switch (key) {
    case "fullName": return a.fullName.localeCompare(b.fullName, "es");
    case "rut": return rutValue(a.rut) - rutValue(b.rut);
    case "cargo": return (a.primaryRole?.name ?? "￿").localeCompare(b.primaryRole?.name ?? "￿", "es");
    case "pipeline": return a.currentStageOrder - b.currentStageOrder;
    case "proyectos": return a.projects.length - b.projects.length;
    case "estado": return Number(a.asignable) - Number(b.asignable);
  }
}

// Encabezado clickeable: asc → desc → orden por defecto. A nivel de módulo
// para que React no lo remonte en cada render.
function SortableHead({
  sortKey, sort, onSort, align = "left", children,
}: {
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir } | null;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const active = sort?.key === sortKey;
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground font-semibold" : ""}`}
        title={active && sort?.dir === "asc" ? "Ascendente — clic para invertir" : active ? "Descendente — clic para restablecer" : "Clic para ordenar"}
      >
        {children}
        {active
          ? (sort!.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
          : <ArrowUpDown className="w-3 h-3 opacity-30" />}
      </button>
    </TableHead>
  );
}

function DeleteableWorkerRow({ worker, canWrite = true }: { worker: WorkerListItem; canWrite?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const sem = semaphoreConfig[worker.semaphore];

  function handleDelete() {
    startTransition(async () => {
      await deleteWorker(worker.id);
      toast.success(`${worker.fullName} eliminado`);
    });
  }

  return (
    <TableRow className={`group ${worker.asignable ? "bg-emerald-50/50 hover:bg-emerald-50" : "bg-red-50/40 hover:bg-red-50/70"}`}>
      <TableCell>
        <Link href={`/dashboard/trabajadores/${worker.id}`} className="font-medium hover:underline">
          {worker.fullName}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">{worker.rut}</TableCell>
      <TableCell>
        {worker.primaryRole ? (
          <span className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: worker.primaryRole.color }} />
            {worker.primaryRole.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">Sin cargo asignado</span>
        )}
      </TableCell>
      <TableCell>
        <div className="min-w-[150px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-xs font-medium ${sem.text} truncate`}>
              {worker.semaphore === "green" ? "Habilitado" : worker.stageName}
            </span>
            <span className="flex items-center gap-1.5 flex-shrink-0">
              {worker.pendingDotiaCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 bg-violet-100 border border-violet-200 rounded-full px-1.5 py-0.5"
                  title={`${worker.pendingDotiaCount} documento(s) esperando Validación Inteligente Dotia`}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  {worker.pendingDotiaCount}
                </span>
              )}
              {worker.pendingReviewCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-1.5 py-0.5"
                  title={`${worker.pendingReviewCount} documento(s) por revisar`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {worker.pendingReviewCount}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground font-semibold">
                {worker.semaphore === "green"
                  ? "✓"
                  : `${Math.min(worker.currentStageOrder, worker.stagesTotal)}/${worker.stagesTotal}`}
              </span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${sem.bar}`}
              style={{
                width: worker.semaphore === "green"
                  ? "100%"
                  : `${Math.round(((worker.currentStageOrder - 1) / worker.stagesTotal) * 100)}%`,
              }}
            />
          </div>
        </div>
      </TableCell>
      <TableCell>
        {worker.projects.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {worker.projects.map((p) => (
              <Link key={p.id} href={`/dashboard/proyectos/${p.id}`}>
                <Badge variant="outline" className="text-xs hover:bg-muted cursor-pointer">
                  {p.name}
                </Badge>
              </Link>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">Sin asignar</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {worker.asignable ? (
          <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50 border-emerald-200">
            Asignable
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-red-700 bg-red-50 border-red-200">
            No asignable
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        {!canWrite ? null : confirm ? (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium transition-colors"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Eliminar"}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            title="Eliminar trabajador"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}

interface Props {
  workers: WorkerListItem[];
  canWrite?: boolean;
}

export function EmpleadosTable({ workers, canWrite = true }: Props) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [semaphoreFilter, setSemaphoreFilter] = useState(ALL);
  const [asignableFilter, setAsignableFilter] = useState(ALL);
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [dotiaFilter, setDotiaFilter] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev?.key !== key ? { key, dir: "asc" }
      : prev.dir === "asc" ? { key, dir: "desc" }
      : null
    );
  }

  const roleOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const w of workers) {
      if (w.primaryRole) map.set(w.primaryRole.id, w.primaryRole);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [workers]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workers) {
      for (const p of w.projects) map.set(p.id, p.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = workers.filter((w) => {
      if (q && !w.fullName.toLowerCase().includes(q) && !w.rut.toLowerCase().includes(q)) return false;
      if (roleFilter !== ALL && w.primaryRole?.id !== roleFilter) return false;
      if (semaphoreFilter !== ALL && w.semaphore !== semaphoreFilter) return false;
      if (asignableFilter !== ALL && String(w.asignable) !== asignableFilter) return false;
      if (projectFilter !== ALL && !w.projects.some((p) => p.id === projectFilter)) return false;
      if (dotiaFilter && w.pendingDotiaCount === 0) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sort) {
        const cmp = compareBy(sort.key, a, b);
        if (cmp !== 0) return sort.dir === "asc" ? cmp : -cmp;
        return a.fullName.localeCompare(b.fullName, "es"); // desempate estable
      }
      // Por defecto: cargo → RUT → nombre
      return compareBy("cargo", a, b) || compareBy("rut", a, b) || compareBy("fullName", a, b);
    });
  }, [workers, query, roleFilter, semaphoreFilter, asignableFilter, projectFilter, dotiaFilter, sort]);

  const counts = {
    asignables: workers.filter((w) => w.asignable).length,
    parciales: workers.filter((w) => w.semaphore === "yellow").length,
    bloqueados: workers.filter((w) => w.semaphore === "red").length,
    dotia: workers.filter((w) => w.pendingDotiaCount > 0).length,
  };

  const hasActiveFilters =
    query !== "" || roleFilter !== ALL || semaphoreFilter !== ALL || asignableFilter !== ALL || projectFilter !== ALL || dotiaFilter;

  function clearFilters() {
    setQuery("");
    setRoleFilter(ALL);
    setSemaphoreFilter(ALL);
    setAsignableFilter(ALL);
    setProjectFilter(ALL);
    setDotiaFilter(false);
  }

  return (
    <div>
      {/* KPIs — clickeables como filtros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Validación Inteligente Dotia",
            count: counts.dotia,
            activeWhen: dotiaFilter,
            onClick: () => setDotiaFilter((v) => !v),
            colors: "bg-violet-50 border-violet-200 text-violet-700",
            activeBorder: "ring-2 ring-violet-500",
            bold: "text-violet-800",
            icon: true,
          },
          {
            label: "Asignables",
            count: counts.asignables,
            activeWhen: asignableFilter === "true",
            onClick: () => setAsignableFilter(asignableFilter === "true" ? ALL : "true"),
            colors: "bg-emerald-50 border-emerald-200 text-emerald-700",
            activeBorder: "ring-2 ring-emerald-500",
            bold: "text-emerald-800",
          },
          {
            label: "Doc. parcial",
            count: counts.parciales,
            activeWhen: semaphoreFilter === "yellow",
            onClick: () => setSemaphoreFilter(semaphoreFilter === "yellow" ? ALL : "yellow"),
            colors: "bg-amber-50 border-amber-200 text-amber-700",
            activeBorder: "ring-2 ring-amber-500",
            bold: "text-amber-800",
          },
          {
            label: "Sin documentos",
            count: counts.bloqueados,
            activeWhen: semaphoreFilter === "red",
            onClick: () => setSemaphoreFilter(semaphoreFilter === "red" ? ALL : "red"),
            colors: "bg-red-50 border-red-200 text-red-700",
            activeBorder: "ring-2 ring-red-500",
            bold: "text-red-800",
          },
        ].map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={kpi.onClick}
            className={`rounded-xl border p-4 text-left transition-all ${kpi.colors} ${
              kpi.activeWhen ? kpi.activeBorder : "hover:brightness-95"
            }`}
          >
            <p className="text-xs mb-1 font-medium flex items-center gap-1">
              {"icon" in kpi && kpi.icon && <Sparkles className="w-3 h-3" />}
              {kpi.label}
            </p>
            <p className={`text-2xl font-bold ${kpi.bold}`}>{kpi.count}</p>
            <p className="text-[11px] mt-1 opacity-60">
              {"icon" in kpi && kpi.icon
                ? (kpi.activeWhen ? "Clic para ver todos" : "Esperan validación automática")
                : (kpi.activeWhen ? "Clic para quitar filtro" : "Clic para filtrar")}
            </p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
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

        <Select value={semaphoreFilter} onValueChange={(v) => setSemaphoreFilter(v ?? ALL)}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Documentación">
              {(value: string) => {
                if (value === ALL || !value) return "Toda documentación";
                return semaphoreConfig[value as keyof typeof semaphoreConfig]?.label ?? "Documentación";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toda documentación</SelectItem>
            <SelectItem value="green">Completa</SelectItem>
            <SelectItem value="yellow">Parcial</SelectItem>
            <SelectItem value="red">Sin documentos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={asignableFilter} onValueChange={(v) => setAsignableFilter(v ?? ALL)}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Estado">
              {(value: string) => {
                if (value === ALL || !value) return "Todos los estados";
                return value === "true" ? "Asignable" : "No asignable";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            <SelectItem value="true">Asignable</SelectItem>
            <SelectItem value="false">No asignable</SelectItem>
          </SelectContent>
        </Select>

        <Select value={projectFilter} onValueChange={(v) => setProjectFilter(v ?? ALL)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Proyecto">
              {(value: string) =>
                value === ALL || !value
                  ? "Todos los proyectos"
                  : projectOptions.find((p) => p.id === value)?.name ?? "Proyecto"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los proyectos</SelectItem>
            {projectOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
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

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          Mostrando {filtered.length} de {workers.length} trabajador{workers.length !== 1 ? "es" : ""}
        </p>
        <button
          onClick={() => exportEmpleados(filtered)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border bg-background text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
          title="Exporta los trabajadores visibles (respeta los filtros aplicados)"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">
            {workers.length === 0
              ? "Sin trabajadores registrados aún. Asígnalos desde el detalle de un proyecto."
              : "Ningún trabajador coincide con los filtros seleccionados."}
          </p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <SortableHead sortKey="fullName" sort={sort} onSort={toggleSort}>Nombre</SortableHead>
                <SortableHead sortKey="rut" sort={sort} onSort={toggleSort}>RUT</SortableHead>
                <SortableHead sortKey="cargo" sort={sort} onSort={toggleSort}>Cargo</SortableHead>
                <SortableHead sortKey="pipeline" sort={sort} onSort={toggleSort}>Pipeline</SortableHead>
                <SortableHead sortKey="proyectos" sort={sort} onSort={toggleSort}>Proyectos asignados</SortableHead>
                <SortableHead sortKey="estado" sort={sort} onSort={toggleSort} align="right">Estado</SortableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((w) => (
                <DeleteableWorkerRow canWrite={canWrite} key={w.id} worker={w} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
