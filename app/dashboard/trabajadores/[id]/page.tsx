import { getWorker, getDocumentTypes, isWorkerHabilitado } from "@/lib/actions/workers";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { DocumentVerifyPanel } from "@/components/document-verify-panel";

const statusLabel: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente de revisión", color: "text-amber-700 bg-amber-50 border-amber-200" },
  APPROVED: { label: "Aprobado", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  REJECTED: { label: "Rechazado", color: "text-red-700 bg-red-50 border-red-200" },
};

// Tipos de documento que tienen número de serie (cédula de identidad y similares)
const CARNET_KEYWORDS = ["cédula", "cedula", "carnet", "identidad", "id"];
function isCarnetType(name: string) {
  return CARNET_KEYWORDS.some((k) => name.toLowerCase().includes(k));
}

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [worker, documentTypes] = await Promise.all([getWorker(id), getDocumentTypes()]);

  if (!worker) notFound();

  const habilitado = await isWorkerHabilitado(id);
  const projectsSet = new Map<string, { id: string; name: string; weeks: number[] }>();
  for (const a of worker.assignments) {
    const p = a.weekPlan.project;
    if (!projectsSet.has(p.id)) projectsSet.set(p.id, { id: p.id, name: p.name, weeks: [] });
    projectsSet.get(p.id)!.weeks.push(a.weekPlan.weekNumber);
  }
  const projects = Array.from(projectsSet.values());

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/dashboard/empleados"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a empleados
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{worker.fullName}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{worker.rut}</p>
          {worker.email && <p className="text-muted-foreground text-sm">{worker.email}</p>}
          {worker.phone && <p className="text-muted-foreground text-sm">{worker.phone}</p>}
        </div>
        {habilitado ? (
          <Badge variant="outline" className="gap-1.5 text-emerald-700 bg-emerald-50 border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" /> Habilitado
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 text-amber-700 bg-amber-50 border-amber-200">
            <ShieldAlert className="w-3.5 h-3.5" /> No habilitado
          </Badge>
        )}
      </div>

      {/* Proyectos asignados */}
      {projects.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Asignaciones
          </h2>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/proyectos/${p.id}`}
                className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors"
              >
                {p.name} · {p.weeks.length} semana{p.weeks.length !== 1 ? "s" : ""}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Documentos */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Documentos requeridos
        </h2>
        <div className="space-y-3">
          {documentTypes.map((dt) => {
            const doc = worker.documents.find((d) => d.documentTypeId === dt.id);
            const sl = doc ? statusLabel[doc.status] : null;
            const showDocNum = isCarnetType(dt.name);

            return (
              <Card key={dt.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{dt.name}</span>
                      {dt.required && (
                        <span className="text-[10px] text-muted-foreground">obligatorio</span>
                      )}
                    </div>
                    {sl && (
                      <Badge variant="outline" className={`text-xs ${sl.color}`}>
                        {sl.label}
                      </Badge>
                    )}
                  </div>

                  {doc ? (
                    <DocumentVerifyPanel
                      documentId={doc.id}
                      fileUrl={doc.fileUrl}
                      fileName={doc.fileName}
                      documentNumber={doc.documentNumber}
                      workerRut={worker.rut}
                      workerName={worker.fullName}
                      status={doc.status}
                    />
                  ) : (
                    <DocumentUploadForm
                      workerId={worker.id}
                      documentTypeId={dt.id}
                      showDocumentNumber={showDocNum}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
