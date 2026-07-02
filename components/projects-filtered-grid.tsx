"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, FolderKanban, MapPin, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import {
  formatDate,
  getProjectProgress,
  getSparklineData,
  getTotalHeadcount,
  statusConfig,
} from "@/lib/project-utils";
import { DotacionSparkline } from "@/components/dotacion-sparkline";

type WeekPlan = {
  weekNumber: number;
  requirements: { quantity: number }[];
};

type ProjectCardData = {
  id: string;
  name: string;
  description: string | null;
  client: string | null;
  location: string | null;
  status: string;
  startDate: Date;
  weeks: number;
  weekPlans: WeekPlan[];
};

interface Props {
  projects: ProjectCardData[];
}

const ALL = "__all__";

export function ProjectsFilteredGrid({ projects }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [clientFilter, setClientFilter] = useState(ALL);
  const [locationFilter, setLocationFilter] = useState(ALL);

  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.client) set.add(p.client);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.location) set.add(p.location);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.client ?? "").toLowerCase().includes(q) &&
        !(p.location ?? "").toLowerCase().includes(q)
      )
        return false;
      if (statusFilter !== ALL && p.status !== statusFilter) return false;
      if (clientFilter !== ALL && p.client !== clientFilter) return false;
      if (locationFilter !== ALL && p.location !== locationFilter) return false;
      return true;
    });
  }, [projects, query, statusFilter, clientFilter, locationFilter]);

  const hasActiveFilters =
    query !== "" || statusFilter !== ALL || clientFilter !== ALL || locationFilter !== ALL;

  function clearFilters() {
    setQuery("");
    setStatusFilter(ALL);
    setClientFilter(ALL);
    setLocationFilter(ALL);
  }

  if (projects.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FolderKanban className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-foreground mb-1">Sin proyectos aún</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crea tu primer proyecto para comenzar a gestionar dotación
          </p>
          <Link href="/dashboard/proyectos/nuevo">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Crear proyecto
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, cliente o ubicación..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Estado">
              {(value: string) =>
                value === ALL || !value
                  ? "Todos los estados"
                  : statusConfig[value as keyof typeof statusConfig]?.label ?? "Estado"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            <SelectItem value="ACTIVE">Activo</SelectItem>
            <SelectItem value="PAUSED">Pausado</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={clientFilter} onValueChange={(v) => setClientFilter(v ?? ALL)}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Cliente">
              {(value: string) => (value === ALL || !value ? "Todos los clientes" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los clientes</SelectItem>
            {clientOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={locationFilter} onValueChange={(v) => setLocationFilter(v ?? ALL)}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Ubicación">
              {(value: string) => (value === ALL || !value ? "Todas las ubicaciones" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las ubicaciones</SelectItem>
            {locationOptions.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
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

      <p className="text-xs text-muted-foreground mb-3">
        Mostrando {filtered.length} de {projects.length} proyecto{projects.length !== 1 ? "s" : ""}
      </p>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <FolderKanban className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Ningún proyecto coincide con los filtros seleccionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const progress = getProjectProgress(project.startDate, project.weeks);
            const headcount = getTotalHeadcount(project.weekPlans);
            const sparkData = getSparklineData(project.weekPlans);
            const sc = statusConfig[project.status as keyof typeof statusConfig];

            return (
              <Link key={project.id} href={`/dashboard/proyectos/${project.id}`}>
                <Card className="border shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                        {project.client && (
                          <p className="text-xs text-muted-foreground mt-0.5">{project.client}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${sc.color}`}>
                        {sc.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    {/* Curva de dotación */}
                    <div className="rounded-lg bg-muted/40 px-2 pt-2 pb-1">
                      <DotacionSparkline data={sparkData} height={52} />
                      <div className="flex justify-between text-[10px] text-muted-foreground px-1 mt-0.5">
                        <span>S1</span>
                        <span className="font-medium text-foreground">
                          {headcount.toLocaleString("es-CL")} personas totales
                        </span>
                        <span>S{project.weeks}</span>
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                    )}

                    <div className="space-y-2 text-xs text-muted-foreground">
                      {project.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {project.location}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {formatDate(project.startDate)} · {project.weeks} semanas
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Avance del proyecto</span>
                        <span className="font-medium text-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
