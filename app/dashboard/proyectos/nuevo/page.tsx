import { getRoles } from "@/lib/actions/projects";
import { NewProjectForm } from "@/components/new-project-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NuevoProyectoPage() {
  const roles = await getRoles();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/proyectos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a proyectos
        </Link>
        <h1 className="text-2xl font-bold">Nuevo Proyecto</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Configura el proyecto y la dotación requerida por semana
        </p>
      </div>

      <NewProjectForm roles={roles} />
    </div>
  );
}
