import { getProjects } from "@/lib/actions/projects";
import { auth } from "@/lib/auth";
import { getCompanyStats } from "@/lib/actions/workers";
import { ProjectsFilteredGrid } from "@/components/projects-filtered-grid";
import { ProyectosHero } from "@/components/proyectos-hero";

export default async function ProyectosPage() {
  const [projects, companyStats, session] = await Promise.all([getProjects(), getCompanyStats(), auth()]);
  const canWrite = (session?.user as { role?: string } | undefined)?.role !== "AUDITOR";

  const coverage = new Map(
    companyStats.projectsBreakdown.map((b) => [b.projectId, { requeridos: b.requeridos, cubiertos: b.cubiertos }])
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <ProyectosHero
        canWrite={canWrite}
        total={projects.length}
        activos={projects.filter((p) => p.status === "ACTIVE").length}
        dotacionRequerida={companyStats.dotacionRequerida}
        dotacionCubierta={companyStats.dotacionCubierta}
      />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <ProjectsFilteredGrid
          projects={projects}
          coverage={Object.fromEntries(coverage)}
        />
      </div>
    </div>
  );
}
