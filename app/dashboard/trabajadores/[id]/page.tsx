import { getWorker } from "@/lib/actions/workers";
import { getWorkerPipeline } from "@/lib/actions/pipeline";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { WorkerPipeline } from "@/components/worker-pipeline";

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const readOnly = (session?.user as { role?: string } | undefined)?.role === "AUDITOR";
  const [worker, pipeline] = await Promise.all([getWorker(id), getWorkerPipeline(id)]);

  if (!worker) notFound();

  const projectsSet = new Map<string, { id: string; name: string; weeks: number[] }>();
  for (const a of worker.assignments) {
    const p = a.weekPlan.project;
    if (!projectsSet.has(p.id)) projectsSet.set(p.id, { id: p.id, name: p.name, weeks: [] });
    projectsSet.get(p.id)!.weeks.push(a.weekPlan.weekNumber);
  }
  const projects = Array.from(projectsSet.values());

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top nav bar */}
      <div className="bg-background border-b px-6 py-3 flex items-center gap-3">
        <Link
          href="/dashboard/empleados"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Empleados
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium text-foreground">{worker.fullName}</span>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <WorkerPipeline
          readOnly={readOnly}
          pipeline={pipeline}
          worker={{ fullName: worker.fullName, rut: worker.rut, email: worker.email ?? null, phone: worker.phone ?? null }}
          projects={projects}
        />
      </div>
    </div>
  );
}
