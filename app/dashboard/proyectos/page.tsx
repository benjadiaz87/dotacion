import { getProjects } from "@/lib/actions/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, FolderKanban, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { formatDate, getProjectProgress, getTotalHeadcount, getSparklineData, statusConfig } from "@/lib/project-utils";
import { DotacionSparkline } from "@/components/dotacion-sparkline";

export default async function ProyectosPage() {
  const projects = await getProjects();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Proyectos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {projects.length} proyecto{projects.length !== 1 ? "s" : ""} en total
          </p>
        </div>
        <Link href="/dashboard/proyectos/nuevo">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Proyecto
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <FolderKanban className="w-14 h-14 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg mb-1">Sin proyectos aún</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm">
              Crea tu primer proyecto para comenzar a planificar la dotación de personal
            </p>
            <Link href="/dashboard/proyectos/nuevo">
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Crear primer proyecto
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => {
            const progress = getProjectProgress(project.startDate, project.weeks);
            const headcount = getTotalHeadcount(project.weekPlans);
            const sparkData = getSparklineData(project.weekPlans);
            const sc = statusConfig[project.status as keyof typeof statusConfig];

            return (
              <Link key={project.id} href={`/dashboard/proyectos/${project.id}`}>
                <Card className="border shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer h-full">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{project.name}</h3>
                        {project.client && (
                          <p className="text-xs text-muted-foreground mt-0.5">{project.client}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${sc.color}`}>
                        {sc.label}
                      </Badge>
                    </div>

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
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Avance</span>
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
