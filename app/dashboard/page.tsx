import { getProjects } from "@/lib/actions/projects";
import { getCompanyStats, getPipelineStats } from "@/lib/actions/workers";
import { auth } from "@/lib/auth";
import { DashboardView } from "@/components/dashboard-view";

export default async function DashboardPage() {
  const session = await auth();
  const [projects, companyStats, pipelineStats] = await Promise.all([
    getProjects(),
    getCompanyStats(),
    getPipelineStats(),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const canWrite = (session?.user as { role?: string } | undefined)?.role !== "AUDITOR";

  return (
    <DashboardView
      canWrite={canWrite}
      userName={session?.user?.name ?? "Administrador"}
      greeting={greeting}
      projects={projects.map((p) => ({
        id: p.id, name: p.name, client: p.client, location: p.location,
        weeks: p.weeks, status: p.status,
      }))}
      pipelineStats={pipelineStats}
      companyStats={companyStats}
    />
  );
}
