"use client";

import { deleteProject, updateProjectStatus } from "@/lib/actions/projects";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pause, Play, Trash2, XCircle } from "lucide-react";
import { useTransition } from "react";

interface Props {
  project: { id: string; status: string };
}

export function ProjectActions({ project }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changeStatus(status: string) {
    startTransition(async () => {
      await updateProjectStatus(project.id, status);
      toast.success("Estado actualizado");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("¿Eliminar este proyecto? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      await deleteProject(project.id);
      toast.success("Proyecto eliminado");
      router.push("/dashboard/proyectos");
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className={buttonVariants({ variant: "outline", size: "sm", className: "gap-2" })}
      >
        <MoreHorizontal className="w-4 h-4" />
        Acciones
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {project.status !== "ACTIVE" && (
          <DropdownMenuItem onClick={() => changeStatus("ACTIVE")} className="gap-2">
            <Play className="w-4 h-4 text-emerald-600" /> Marcar activo
          </DropdownMenuItem>
        )}
        {project.status !== "PAUSED" && (
          <DropdownMenuItem onClick={() => changeStatus("PAUSED")} className="gap-2">
            <Pause className="w-4 h-4 text-amber-600" /> Pausar
          </DropdownMenuItem>
        )}
        {project.status !== "COMPLETED" && (
          <DropdownMenuItem onClick={() => changeStatus("COMPLETED")} className="gap-2">
            <XCircle className="w-4 h-4 text-blue-600" /> Marcar completado
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDelete}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="w-4 h-4" /> Eliminar proyecto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
