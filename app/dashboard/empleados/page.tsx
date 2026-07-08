import { getAllWorkers } from "@/lib/actions/workers";
import { getRoles } from "@/lib/actions/projects";
import { auth } from "@/lib/auth";
import { EmpleadosTable } from "@/components/empleados-table";
import { AddWorkerDialog } from "@/components/add-worker-dialog";

export default async function EmpleadosPage() {
  const [workers, roles, session] = await Promise.all([getAllWorkers(), getRoles(), auth()]);
  const canWrite = (session?.user as { role?: string } | undefined)?.role !== "AUDITOR";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Empleados</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {workers.length} trabajador{workers.length !== 1 ? "es" : ""} en total
          </p>
        </div>
        {canWrite && <AddWorkerDialog roles={roles.map((r) => ({ id: r.id, name: r.name, color: r.color }))} />}
      </div>

      <EmpleadosTable workers={workers} canWrite={canWrite} />
    </div>
  );
}
