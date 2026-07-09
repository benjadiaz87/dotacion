import { getProject, getRoles } from "@/lib/actions/projects";
import { getProjectDotacionByWeek, getProjectCriticalForecast } from "@/lib/actions/workers";
import { getProjectSeguimiento } from "@/lib/actions/seguimiento";
import { notFound } from "next/navigation";
import { formatDate, getProjectProgress, getTotalHeadcount, statusConfig } from "@/lib/project-utils";
import { ProjectViewTabs } from "@/components/project-view-tabs";
import { ProjectActions } from "@/components/project-actions";
import { ProjectHero } from "@/components/project-hero";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const canWrite = (session?.user as { role?: string } | undefined)?.role !== "AUDITOR";
  const [project, weeksData, criticalForecast, roles, seguimiento] = await Promise.all([
    getProject(id),
    getProjectDotacionByWeek(id),
    getProjectCriticalForecast(id),
    getRoles(),
    getProjectSeguimiento(id),
  ]);

  if (!project) notFound();

  const sc = statusConfig[project.status as keyof typeof statusConfig];
  const totalHeadcount = getTotalHeadcount(project.weekPlans);
  const projectProgress = getProjectProgress(project.startDate, project.weeks);

  // Cobertura de la semana en curso (o la última si el proyecto ya terminó)
  const now = Date.now();
  const currentWeek =
    weeksData.find((w) => now >= w.startDate.getTime() && now <= w.endDate.getTime()) ??
    weeksData[weeksData.length - 1];
  const coverage = currentWeek
    ? { requeridos: currentWeek.cargosTotales, cubiertos: currentWeek.cargosCubiertos }
    : null;

  return (
    <div className="min-h-screen bg-muted/30">
      <ProjectHero
        name={project.name}
        description={project.description}
        statusLabel={sc.label}
        statusColor={sc.color}
        isActive={project.status === "ACTIVE"}
        meta={{
          client: project.client,
          location: project.location,
          startLabel: formatDate(project.startDate),
          weeks: project.weeks,
          headcountLabel: totalHeadcount.toLocaleString("es-CL") + " personas",
        }}
        coverage={coverage}
        progress={projectProgress}
        actions={canWrite ? <ProjectActions project={{ id: project.id, status: project.status }} /> : null}
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <ProjectViewTabs
          canWrite={canWrite}
          seguimiento={seguimiento}
          weeksData={weeksData}
          criticalForecast={criticalForecast}
          projectProgress={projectProgress}
          weekPlans={project.weekPlans}
          startDate={project.startDate}
          roles={roles}
        />
      </div>
    </div>
  );
}
