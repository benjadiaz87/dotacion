import { getProject, getRoles } from "@/lib/actions/projects";
import { getProjectDotacionByWeek, getProjectCriticalForecast } from "@/lib/actions/workers";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Building2, CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { formatDate, getProjectProgress, getTotalHeadcount, statusConfig } from "@/lib/project-utils";
import { ProjectViewTabs } from "@/components/project-view-tabs";
import { ProjectActions } from "@/components/project-actions";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, weeksData, criticalForecast, roles] = await Promise.all([
    getProject(id),
    getProjectDotacionByWeek(id),
    getProjectCriticalForecast(id),
    getRoles(),
  ]);

  if (!project) notFound();

  const sc = statusConfig[project.status as keyof typeof statusConfig];
  const totalHeadcount = getTotalHeadcount(project.weekPlans);
  const projectProgress = getProjectProgress(project.startDate, project.weeks);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back */}
      <Link
        href="/dashboard/proyectos"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a proyectos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <Badge variant="outline" className={`text-xs ${sc.color}`}>
              {sc.label}
            </Badge>
          </div>
          {project.description && (
            <p className="text-muted-foreground text-sm">{project.description}</p>
          )}
        </div>
        <ProjectActions project={{ id: project.id, status: project.status }} />
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          {
            icon: Building2,
            label: "Cliente",
            value: project.client || "—",
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            icon: MapPin,
            label: "Ubicación",
            value: project.location || "—",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            icon: CalendarDays,
            label: "Inicio",
            value: `${formatDate(project.startDate)} · ${project.weeks} sem.`,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            icon: Users,
            label: "Dotación total",
            value: totalHeadcount.toLocaleString("es-CL") + " personas",
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
        ].map((m) => (
          <Card key={m.label} className="border shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${m.bg}`}>
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-sm font-semibold truncate">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dotación / Gantt toggle */}
      <ProjectViewTabs
        weeksData={weeksData}
        criticalForecast={criticalForecast}
        projectProgress={projectProgress}
        weekPlans={project.weekPlans}
        startDate={project.startDate}
        roles={roles}
      />
    </div>
  );
}
