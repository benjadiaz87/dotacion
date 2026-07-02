import { getProjects } from "@/lib/actions/projects";
import { getCompanyStats } from "@/lib/actions/workers";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, FolderKanban, Plus, TrendingUp, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { getTotalHeadcount } from "@/lib/project-utils";
import { ProjectsFilteredGrid } from "@/components/projects-filtered-grid";

export default async function DashboardPage() {
  const session = await auth();
  const [projects, companyStats] = await Promise.all([getProjects(), getCompanyStats()]);

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

      {/* KPIs de llenado de cargos (hoy, cross-proyecto) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card className={`border shadow-sm ${companyStats.vacantesTotal > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${companyStats.vacantesTotal > 0 ? "bg-red-100" : "bg-emerald-100"}`}>
              <AlertTriangle className={`w-5 h-5 ${companyStats.vacantesTotal > 0 ? "text-red-600" : "text-emerald-600"}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${companyStats.vacantesTotal > 0 ? "text-red-800" : "text-emerald-800"}`}>
                {companyStats.vacantesTotal}
              </p>
              <p className={`text-sm ${companyStats.vacantesTotal > 0 ? "text-red-700" : "text-emerald-700"}`}>
                Vacantes hoy (todos los proyectos)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-blue-50 border-blue-200">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100">
              <UserCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-800">{companyStats.poolDisponible}</p>
              <p className="text-sm text-blue-700">Habilitados sin asignar</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-50">
              <Clock className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {companyStats.tiempoPromedioPrimeraAsignacionDias !== null
                  ? `${companyStats.tiempoPromedioPrimeraAsignacionDias}d`
                  : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Tiempo prom. 1ª asignación</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {companyStats.vacantesTotal > 0 && companyStats.projectsBreakdown.some((p) => p.vacantes > 0) && (
        <div className="flex flex-wrap gap-2 mb-8">
          {companyStats.projectsBreakdown
            .filter((p) => p.vacantes > 0)
            .map((p) => (
              <Link
                key={p.projectId}
                href={`/dashboard/proyectos/${p.projectId}`}
                className="text-xs px-3 py-1.5 rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              >
                {p.projectName}: {p.vacantes} vacante{p.vacantes !== 1 ? "s" : ""}
              </Link>
            ))}
        </div>
      )}

      {/* KPIs generales */}
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

      {/* Proyectos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Proyectos</h2>
          <Link href="/dashboard/proyectos">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
              Ver todos
            </Button>
          </Link>
        </div>

        <ProjectsFilteredGrid projects={projects} />
      </div>
    </div>
  );
}
