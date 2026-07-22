"use client";

import { useState } from "react";
import type { StageWithDocs } from "@/lib/actions/pipeline";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { Check, Clock, FileText, ChevronRight } from "lucide-react";

const CARNET_KEYWORDS = ["cédula", "cedula", "carnet", "identidad"];
const isCarnetType = (name: string) => CARNET_KEYWORDS.some((k) => name.toLowerCase().includes(k));
const isHojaVidaType = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("hoja de vida") && n.includes("conductor");
};
const isAntecedentesType = (name: string) => name.toLowerCase().includes("antecedente");
const SNS_KEYWORDS = ["sns", "servicio nacional de salud", "superintendencia de salud", "prestador"];
const isSnsType = (name: string) => SNS_KEYWORDS.some((k) => name.toLowerCase().includes(k));
const isLicenciaType = (name: string) => {
  const n = name.toLowerCase();
  return (n.includes("licencia") || n.includes("conducir")) && !isHojaVidaType(name);
};

const STATUS_CFG: Record<string, { label: string; icon: React.ReactNode; border: string; bg: string }> = {
  APPROVED: {
    label: "Aprobado",
    icon: <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-emerald-600" /></div>,
    border: "border-emerald-200",
    bg: "bg-emerald-50/40",
  },
  PENDING: {
    label: "En revisión",
    icon: <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-amber-500" /></div>,
    border: "border-amber-200",
    bg: "bg-amber-50/20",
  },
  REJECTED: {
    label: "Rechazado — vuelve a subir",
    icon: <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-red-500" /></div>,
    border: "border-red-200",
    bg: "bg-red-50/20",
  },
};

type UploadedDoc = { id: string; status: string; fileUrl: string; fileName: string };

export function WorkerUploadView({
  workerId,
  stage,
  uploadedDocs,
}: {
  workerId: string;
  stage: StageWithDocs;
  uploadedDocs: Record<string, UploadedDoc>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const approved = stage.requirements.filter((r) => uploadedDocs[r.documentTypeId]?.status === "APPROVED").length;
  const total = stage.requirements.filter((r) => r.documentType.required).length;
  const pct = total === 0 ? 100 : Math.round((approved / total) * 100);

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-background rounded-2xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-foreground">Etapa 1 — Evaluación Documental</p>
          <span className="text-sm font-black text-foreground">{approved}/{total}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{pct}% completado</p>
      </div>

      {/* Doc list */}
      <div className="space-y-2">
        {stage.requirements.map((req) => {
          const uploaded = uploadedDocs[req.documentTypeId];
          const status = uploaded?.status;
          const cfg = status ? STATUS_CFG[status] : null;
          const needsUpload = !uploaded || status === "REJECTED";
          const isOpen = expanded === req.documentTypeId;

          return (
            <div
              key={req.documentTypeId}
              className={`bg-background rounded-xl border shadow-sm overflow-hidden transition-all ${cfg?.border ?? "border-border"} ${cfg?.bg ?? ""}`}
            >
              <button
                onClick={() => {
                  if (needsUpload) setExpanded(isOpen ? null : req.documentTypeId);
                }}
                className="w-full flex items-center gap-3 px-5 py-4 text-left"
              >
                {cfg?.icon ?? (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{req.documentType.name}</p>
                  {status ? (
                    <p className={`text-xs mt-0.5 font-medium ${
                      status === "APPROVED" ? "text-emerald-600" :
                      status === "PENDING"  ? "text-amber-600" :
                      "text-red-600"
                    }`}>{cfg?.label}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {req.documentType.required ? "Obligatorio — toca para subir" : "Opcional — toca para subir"}
                    </p>
                  )}
                </div>
                {needsUpload && (
                  <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                )}
              </button>

              {isOpen && needsUpload && (
                <div className="px-5 pb-5 border-t border-dashed pt-4">
                  {/* El trabajador solo sube; la verificación la ejecuta el admin */}
                  <DocumentUploadForm
                    workerId={workerId}
                    documentTypeId={req.documentTypeId}
                    uploadOnly
                    isCarnet={isCarnetType(req.documentType.name)}
                    isAntecedentes={isAntecedentesType(req.documentType.name)}
                    isLicencia={isLicenciaType(req.documentType.name)}
                    isHojaVida={isHojaVidaType(req.documentType.name)}
                    isSns={isSnsType(req.documentType.name)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {approved === total && total > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-1">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <Check className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="font-bold text-emerald-800">¡Documentos completos!</p>
          <p className="text-xs text-emerald-700">El equipo de RRHH revisará tus documentos y te notificará cuando avances a la siguiente etapa.</p>
        </div>
      )}
    </div>
  );
}
