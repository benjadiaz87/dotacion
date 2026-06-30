import { getProjects } from "@/lib/actions/projects";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CalendarDays,
  FolderKanban,
  MapPin,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { formatDate, getProjectProgress, getTotalHeadcount, getSparklineData, statusConfig } from "@/lib/project-utils";
import { DotacionSparkline } from "@/components/dotacion-sparkline";

export default async function DashboardPage() {
  const session = await auth();
  const projects = await getProjects();

  const active = projects.filter((p) => p.status === "ACTIVE");
  const totalWorkers = projects.reduce((sum, p) => sum + getTotalHeadcount(p.weekPlans), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-muted-foreground text-sm">{greeting},</p>
          <h1 className="text-2xl font-bold text-foreground mt-0.5">{session?.user?.name}</h1>
        </div>
        <Link href="/dashboard/proyectos/nuevo">
          <Button className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            Nuevo Proyecto
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Proyectos vigentes",
            value: active.length,
            icon: FolderKanban,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Total proyectos",
            value: projects.length,
            icon: TrendingUp,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Dotación planificada",
            value: totalWorkers.toLocaleString("es-CL"),
            icon: Users,
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="border shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.bg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Proyectos vigentes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Proyectos vigentes</h2>
          <Link href="/dashboard/proyectos">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
              Ver todos
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => {
              const progress = getProjectProgress(project.startDate, project.weeks);
              const headcount = getTotalHeadcount(project.weekPlans);
              const sc = statusConfig[project.status as keyof typeof statusConfig];
              const sparkData = getSparklineData(project.weekPlans);

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

                      {project.location && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5" />
                          {project.location}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
    </div>
  );
}
