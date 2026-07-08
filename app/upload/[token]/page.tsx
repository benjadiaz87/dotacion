import { resolveUploadToken } from "@/lib/actions/upload-token";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { WorkerUploadView } from "@/components/worker-upload-view";
import { FileText, ShieldAlert } from "lucide-react";

export default async function WorkerUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await resolveUploadToken(token);

  if (!record) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <div className="bg-background rounded-2xl border shadow-sm p-10 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Enlace inválido o expirado</h1>
          <p className="text-sm text-muted-foreground">
            Este enlace ya no es válido. Solicita un nuevo enlace a tu empleador.
          </p>
        </div>
      </div>
    );
  }

  // Requisitos de Etapa 1 según el cargo del trabajador
  const stage1 = await db.stage.findUnique({
    where: { order: 1 },
    include: {
      requirements: {
        where: record.worker.roleId
          ? { OR: [{ roleId: null }, { roleId: record.worker.roleId }] }
          : { roleId: null },
        include: { documentType: true },
      },
    },
  });

  if (!stage1) notFound();

  const uploadedDocs = Object.fromEntries(
    record.worker.documents.map((d) => [d.documentTypeId, d])
  );

  const daysLeft = Math.ceil(
    (record.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Portal de documentos</p>
            <p className="text-xs text-muted-foreground">Dotia</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Worker card */}
        <div className="bg-background rounded-2xl border shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-base">
                {record.worker.fullName.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{record.worker.fullName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{record.worker.rut}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-muted-foreground">Enlace válido por</p>
              <p className="text-sm font-bold text-foreground">{daysLeft} día{daysLeft !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
          <p className="text-sm font-semibold text-blue-800 mb-1">¿Qué debes hacer?</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Sube los documentos que se solicitan a continuación. Puedes hacerlo desde tu teléfono.
            Una vez revisados y aprobados por el equipo de RRHH, avanzarás a la siguiente etapa del proceso.
          </p>
        </div>

        {/* Documents */}
        <WorkerUploadView
          workerId={record.worker.id}
          stage={stage1 as any}
          uploadedDocs={uploadedDocs}
        />
      </div>
    </div>
  );
}
