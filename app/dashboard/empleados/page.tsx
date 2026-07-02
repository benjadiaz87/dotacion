import { getAllWorkers } from "@/lib/actions/workers";
import { EmpleadosTable } from "@/components/empleados-table";
import { AddWorkerDialog } from "@/components/add-worker-dialog";

export default async function EmpleadosPage() {
  const workers = await getAllWorkers();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Empleados</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {workers.length} trabajador{workers.length !== 1 ? "es" : ""} en total
          </p>
        </div>
        <AddWorkerDialog />
      </div>

      <EmpleadosTable workers={workers} />
    </div>
  );
}
