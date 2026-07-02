import { getProjects } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ProjectsFilteredGrid } from "@/components/projects-filtered-grid";

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

      <ProjectsFilteredGrid projects={projects} />
    </div>
  );
}
