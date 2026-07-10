"use client";

import { useState, useTransition } from "react";
import type { WorkerPipelineData, StageWithDocs } from "@/lib/actions/pipeline";
import { advanceWorkerStage, updateDocumentStatus } from "@/lib/actions/pipeline";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { DocumentVerifyPanel } from "@/components/document-verify-panel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Check, ChevronRight, FileText, Trophy, Loader2, AlertTriangle,
  ShieldCheck, Clipboard, Hammer, Clock,
  X, MessageSquare, Phone, Mail, Hash, Briefcase, Flag,
  Link2, Copy, CheckCheck,
} from "lucide-react";
import { generateUploadToken } from "@/lib/actions/upload-token";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARNET_KEYWORDS = ["cédula", "cedula", "carnet", "identidad"];
const isCarnetType = (name: string) => CARNET_KEYWORDS.some((k) => name.toLowerCase().includes(k));

const ANTECEDENTES_KEYWORDS = ["antecedente", "antecedentes"];
const isAntecedentesType = (name: string) => ANTECEDENTES_KEYWORDS.some((k) => name.toLowerCase().includes(k));

const LICENCIA_KEYWORDS = ["licencia", "conducir", "conducción"];
const isLicenciaType = (name: string) => LICENCIA_KEYWORDS.some((k) => name.toLowerCase().includes(k));

const STAGE_ICONS = [Clipboard, FileText, Hammer, ShieldCheck];

const STAGE_COLORS: Record<number, { active: string; done: string }> = {
  1: { active: "bg-blue-600",    done: "bg-blue-500"    },
  2: { active: "bg-indigo-600",  done: "bg-indigo-500"  },
  3: { active: "bg-orange-500",  done: "bg-orange-400"  },
  4: { active: "bg-teal-600",    done: "bg-teal-500"    },
};

const STATUS_CFG: Record<string, { label: string; dot: string; text: string }> = {
  APPROVED: { label: "Aprobado",  dot: "bg-emerald-500", text: "text-emerald-700" },
  PENDING:  { label: "En revisión", dot: "bg-amber-400",  text: "text-amber-700" },
  REJECTED: { label: "Rechazado", dot: "bg-red-500",     text: "text-red-700" },
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ─── Chevron stage bar (Salesforce style) ─────────────────────────────────────
function StageBar({ stages, currentOrder, selectedOrder, isDone, onSelect }: {
  stages: StageWithDocs[];
  currentOrder: number;
  selectedOrder: number;
  isDone: boolean;
  onSelect: (o: number) => void;
}) {
  return (
    <div className="flex w-full overflow-hidden rounded-xl border border-border shadow-sm">
      {stages.map((stage, i) => {
        const done   = isDone || stage.order < currentOrder;
        const active = !isDone && stage.order === currentOrder;
        const future = !isDone && stage.order > currentOrder;
        const selected = stage.order === selectedOrder;
        const colors = STAGE_COLORS[stage.order];
        const Icon = STAGE_ICONS[i];

        const bgClass = done
          ? colors.done + " text-white"
          : active
          ? colors.active + " text-white"
          : future
          ? "bg-muted/40 text-muted-foreground/60"
          : "bg-muted/60 text-muted-foreground";

        return (
          <button
            key={stage.id}
            onClick={() => onSelect(stage.order)}
            className={`
              relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-3 px-2
              transition-all duration-200 group cursor-pointer
              ${bgClass}
              ${selected && !active ? "ring-2 ring-inset ring-white/40" : ""}
              ${selected && future ? "ring-2 ring-inset ring-muted-foreground/30" : ""}
              ${active ? "shadow-inner" : ""}
            `}
            style={{ clipPath: i < stages.length - 1 ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)" : i === 0 ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)" : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)" }}
          >
            <div className="flex items-center gap-1.5">
              {done
                ? <Check className="w-3.5 h-3.5 flex-shrink-0" />
                : <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />}
              <span className="text-[10px] font-bold uppercase tracking-wide leading-tight text-center truncate max-w-[80px]">
                {stage.name}
              </span>
            </div>
            {active && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-white rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Exception inline form ─────────────────────────────────────────────────────
function ExceptionForm({ docName, onConfirm, onCancel }: {
  docName: string; onConfirm: (j: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" /> Justificación de excepción — {docName}
      </p>
      <textarea
        className="w-full text-xs rounded border border-amber-200 bg-white p-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
        rows={2}
        placeholder="Ej: documento en trámite, se presentará en 5 días hábiles…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="flex gap-1.5">
        <button onClick={onCancel} className="flex-1 text-xs h-7 rounded border border-border bg-white hover:bg-muted transition-colors">Cancelar</button>
        <button
          onClick={() => onConfirm(text.trim())}
          disabled={!text.trim()}
          className="flex-1 text-xs h-7 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50 transition-colors"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

// ─── Datos capturados por la IA (chips) ───────────────────────────────────────
const EXTRACT_LABELS: Record<string, string> = {
  rut: "RUT", fullName: "Nombre", documentNumber: "N° serie", birthDate: "Nacimiento",
  expiryDate: "Vencimiento", nationality: "Nacionalidad",
  folio: "Folio", codigoVerificacion: "Cód. verificación", fechaEmision: "Emisión",
  tipoFines: "Tipo", sinAntecedentes: "Sin antecedentes",
  fechaNacimiento: "Nacimiento", fechaVencimiento: "Vencimiento",
  clases: "Clases", restricciones: "Restricciones", numero: "N° licencia",
  fechaVencimientoReal: "Vence (real)", fechaVencimientoExtendida: "Vence (ext. legal)",
};

function ExtractedChips({ raw }: { raw: string | null }) {
  if (!raw) return null;
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw); } catch { return null; }
  const entries = Object.entries(data).filter(([k, v]) => v !== null && v !== "" && EXTRACT_LABELS[k]);
  if (entries.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500 mb-1.5">
        Datos capturados por la IA
      </p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5 rounded-md border border-violet-100 bg-violet-50/50 px-2 py-1">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-violet-400">{EXTRACT_LABELS[k]}</span>
            <span className="text-[11px] font-bold font-mono text-foreground">
              {typeof v === "boolean" ? (v ? "Sí" : "No") : String(v)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────
function DocRow({ doc, pipeline, stage, worker, isCurrentStage, isFutureStage, onApprove, onReject, onException }: {
  doc: StageWithDocs["requirements"][0] & {
    uploaded?: { id: string; status: string; fileUrl: string; fileName: string; documentNumber: string | null; verifyNote: string | null; extractedData: string | null; expiresAt: Date | string | null; issuedAt: Date | string | null };
    exception?: { justification: string };
    pendingExc?: string;
  };
  pipeline: WorkerPipelineData;
  stage: StageWithDocs;
  worker: { fullName: string; rut: string };
  isCurrentStage: boolean;
  isFutureStage: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onException: (dtId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasException = !!doc.exception || !!doc.pendingExc;
  const isApproved = doc.uploaded?.status === "APPROVED" || hasException;
  const isPending = doc.uploaded?.status === "PENDING";

  const statusIcon = isApproved
    ? <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-emerald-600" /></div>
    : isPending
    ? <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0"><Clock className="w-3 h-3 text-amber-500" /></div>
    : <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><FileText className="w-3 h-3 text-muted-foreground" /></div>;

  if (isFutureStage) {
    return (
      <div className="border border-dashed border-slate-200 rounded-lg bg-slate-50/40 opacity-70">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <FileText className="w-3 h-3 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-slate-500 truncate">{doc.documentType.name}</span>
            {!doc.documentType.required && (
              <span className="ml-2 text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-medium">opcional</span>
            )}
            <p className="text-[10px] text-slate-400 mt-0.5">Pendiente — etapa futura</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg transition-all ${
      isApproved ? "border-emerald-200 bg-emerald-50/30" :
      isPending  ? "border-amber-200 bg-amber-50/20" :
      "border-border bg-background"
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {statusIcon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{doc.documentType.name}</span>
            {!doc.documentType.required && (
              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">opcional</span>
            )}
            {hasException && (
              <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">con excepción</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {doc.uploaded && (
              <span className={`text-[10px] font-medium ${STATUS_CFG[doc.uploaded.status]?.text}`}>
                {STATUS_CFG[doc.uploaded.status]?.label}
              </span>
            )}
            {doc.uploaded?.status === "APPROVED" && doc.uploaded.documentNumber && (
              <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                {isCarnetType(doc.documentType.name) ? `Serie: ${doc.uploaded.documentNumber}` :
                 isAntecedentesType(doc.documentType.name) ? `Folio: ${doc.uploaded.documentNumber}` :
                 isLicenciaType(doc.documentType.name) ? `Clase: ${doc.uploaded.documentNumber}` :
                 doc.uploaded.documentNumber}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Admin approve / reject for pending */}
          {isPending && isCurrentStage && stage.order > 1 && (
            <>
              <button onClick={() => onApprove(doc.uploaded!.id)} className="h-7 px-2.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold transition-colors">Aprobar</button>
              <button onClick={() => onReject(doc.uploaded!.id)} className="h-7 w-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
            </>
          )}
          {/* Exception link — solo en etapa actual */}
          {isCurrentStage && doc.documentType.required && !isApproved && !doc.pendingExc && (
            <button onClick={() => onException(doc.documentTypeId)} className="text-[10px] text-amber-600 hover:underline font-medium">excepción</button>
          )}
          {/* Expand toggle — siempre visible si hay algo que mostrar */}
          {(doc.uploaded || isCurrentStage) && (
            <button onClick={() => setExpanded(!expanded)} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors">
              <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Motivo de verificación fallida (persistente) */}
      {doc.uploaded?.verifyNote && doc.uploaded.status !== "APPROVED" && (
        <div className="mx-4 mb-3 flex gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-700 font-medium">{doc.uploaded.verifyNote}</p>
        </div>
      )}

      {/* Exception justification */}
      {(doc.exception || doc.pendingExc) && (
        <div className="mx-4 mb-3 flex gap-2 rounded-md bg-amber-50 border border-amber-100 px-3 py-2">
          <MessageSquare className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 italic">{doc.exception?.justification ?? doc.pendingExc}</p>
        </div>
      )}

      {/* Detalle del documento */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-dashed mt-1 pt-3">
          {doc.uploaded && <ExtractedChips raw={doc.uploaded.extractedData} />}
          {isCurrentStage ? (
            // Etapa actual: upload o verify interactivo
            (!doc.uploaded || doc.uploaded.status === "REJECTED") ? (
              <DocumentUploadForm workerId={pipeline.workerId} documentTypeId={doc.documentTypeId} isCarnet={isCarnetType(doc.documentType.name)} isAntecedentes={isAntecedentesType(doc.documentType.name)} isLicencia={isLicenciaType(doc.documentType.name)} />
            ) : (
              <DocumentVerifyPanel
                documentId={doc.uploaded.id}
                fileUrl={doc.uploaded.fileUrl}
                fileName={doc.uploaded.fileName}
                documentNumber={doc.uploaded.documentNumber}
                workerRut={worker.rut}
                workerName={worker.fullName}
                docKind={
                  isCarnetType(doc.documentType.name) ? "carnet" :
                  isAntecedentesType(doc.documentType.name) ? "antecedentes" :
                  isLicenciaType(doc.documentType.name) ? "licencia" : "otro"
                }
                status={doc.uploaded.status}
              />
            )
          ) : doc.uploaded ? (
            // Etapa pasada: solo visualización del archivo
            <div className="flex items-center gap-3 py-1">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <a
                href={doc.uploaded.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline font-medium truncate"
              >
                {doc.uploaded.fileName}
              </a>
              <span className={`ml-auto text-[10px] font-semibold ${STATUS_CFG[doc.uploaded.status]?.text}`}>
                {STATUS_CFG[doc.uploaded.status]?.label}
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No se subió documento en esta etapa.</p>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Proceso panel ────────────────────────────────────────────────────────────
function ProcesoPanel({ stage, pipeline, worker, isCurrentStage, isFutureStage, onAdvanced }: {
  stage: StageWithDocs;
  pipeline: WorkerPipelineData;
  worker: { fullName: string; rut: string };
  isCurrentStage: boolean;
  isFutureStage: boolean;
  onAdvanced: (n: number) => void;
}) {
  const [, startTx] = useTransition();
  const [advancing, setAdvancing] = useState(false);
  const [pendingExc, setPendingExc] = useState<Record<string, string>>({});
  const [exceptionForm, setExceptionForm] = useState<string | null>(null);
  const [missingDocs, setMissingDocs] = useState<{ documentTypeId: string; name: string }[] | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const enriched = stage.requirements.map((r) => ({
    ...r,
    uploaded: pipeline.documents[r.documentTypeId],
    exception: pipeline.exceptions[`${stage.id}:${r.documentTypeId}`],
    pendingExc: pendingExc[r.documentTypeId],
  }));

  const requiredDocs = enriched.filter((d) => d.documentType.required);
  const approvedCount = enriched.filter((d) => d.uploaded?.status === "APPROVED" || d.exception || d.pendingExc).length;
  const requiredApproved = requiredDocs.filter((d) => d.uploaded?.status === "APPROVED" || d.exception || d.pendingExc).length;
  const pct = requiredDocs.length === 0 ? 100 : Math.round((requiredApproved / requiredDocs.length) * 100);
  const allOk = requiredApproved === requiredDocs.length;
  const colors = STAGE_COLORS[stage.order];

  function approve(id: string) { startTx(async () => { await updateDocumentStatus(id, "APPROVED"); toast.success("Aprobado"); }); }
  function reject(id: string)  { startTx(async () => { await updateDocumentStatus(id, "REJECTED"); toast.error("Rechazado"); }); }

  function handleAdvance() {
    setMissingDocs(null);
    setAdvancing(true);
    const excs = Object.entries(pendingExc).map(([documentTypeId, justification]) => ({ documentTypeId, justification }));
    startTx(async () => {
      const r = await advanceWorkerStage(pipeline.workerId, stage.order, excs);
      setAdvancing(false);
      if (r.ok) { toast.success("Etapa completada"); onAdvanced(r.newStageOrder); }
      else { setMissingDocs(r.missing); toast.error(`Faltan ${r.missing.length} documento(s)`); }
    });
  }

  async function handleGenerateLink() {
    setGeneratingLink(true);
    const token = await generateUploadToken(pipeline.workerId);
    const url = `${window.location.origin}/upload/${token}`;
    setShareLink(url);
    setGeneratingLink(false);
  }

  async function handleCopy() {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Siguiente acción sugerida (solo etapa actual)
  const pendingReview = enriched.filter((d) => d.uploaded?.status === "PENDING").length;
  const missingUpload = requiredDocs.filter((d) => !d.uploaded && !d.exception && !d.pendingExc).length;

  const nextAction = !isCurrentStage
    ? null
    : allOk
    ? { icon: ChevronRight, text: "Todos los documentos están OK — completa la etapa y avanza.", tone: "emerald" as const }
    : pendingReview > 0
    ? { icon: Clock, text: `Revisar ${pendingReview} documento${pendingReview !== 1 ? "s" : ""} pendiente${pendingReview !== 1 ? "s" : ""} de aprobación.`, tone: "amber" as const }
    : missingUpload > 0
    ? { icon: FileText, text: `Falta${missingUpload !== 1 ? "n" : ""} ${missingUpload} documento${missingUpload !== 1 ? "s" : ""} obligatorio${missingUpload !== 1 ? "s" : ""} por subir.`, tone: "blue" as const }
    : null;

  const NEXT_TONES = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber:   "bg-amber-50 border-amber-200 text-amber-800",
    blue:    "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <div className="space-y-5">
      {/* Siguiente acción */}
      {nextAction && (
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${NEXT_TONES[nextAction.tone]}`}>
          <nextAction.icon className="w-4 h-4 flex-shrink-0" />
          <p className="text-xs font-semibold flex-1">
            <span className="uppercase tracking-widest text-[9px] font-bold opacity-60 mr-2">Siguiente acción</span>
            {nextAction.text}
          </p>
        </div>
      )}

      {/* Stage summary bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {requiredApproved} / {requiredDocs.length} documentos obligatorios
            </span>
            <span className={`text-sm font-bold ${allOk ? "text-emerald-600" : "text-foreground"}`}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${allOk ? "bg-emerald-500" : colors.active}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Future stage notice */}
      {isFutureStage && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 flex items-center gap-3">
          <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <p className="text-xs text-slate-500">
            Esta etapa aún no está activa. Puedes ver los documentos requeridos para prepararte con anticipación.
          </p>
        </div>
      )}

      {/* Share link — only Stage 1 */}
      {isCurrentStage && stage.order === 1 && (
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-xs font-semibold text-foreground">Enlace de carga para el trabajador</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Genera un enlace único (válido 7 días) para que el trabajador suba sus propios documentos desde su teléfono, sin necesidad de cuenta.
          </p>
          {shareLink ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareLink}
                className="flex-1 text-xs rounded-lg border bg-background px-3 py-2 font-mono text-muted-foreground truncate focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${
                  copied ? "bg-emerald-100 text-emerald-700" : "bg-primary text-white hover:bg-primary/90"
                }`}
              >
                {copied ? <><CheckCheck className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateLink}
              disabled={generatingLink}
              className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              {generatingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              {generatingLink ? "Generando…" : "Generar enlace"}
            </button>
          )}
        </div>
      )}

      {/* Doc list */}
      <div className="space-y-2">
        {enriched.map((doc) => (
          <div key={doc.documentTypeId}>
            <DocRow
              doc={doc}
              pipeline={pipeline}
              stage={stage}
              worker={worker}
              isCurrentStage={isCurrentStage}
              isFutureStage={isFutureStage}
              onApprove={approve}
              onReject={reject}
              onException={(dtId) => setExceptionForm(dtId === exceptionForm ? null : dtId)}
            />
            {exceptionForm === doc.documentTypeId && (
              <ExceptionForm
                docName={doc.documentType.name}
                onConfirm={(j) => {
                  setPendingExc((p) => ({ ...p, [doc.documentTypeId]: j }));
                  setExceptionForm(null);
                  toast.success("Excepción añadida");
                }}
                onCancel={() => setExceptionForm(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Advance */}
      {isCurrentStage && !isFutureStage && (
        <div className="pt-4 border-t space-y-3">
          {missingDocs && missingDocs.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 mb-1">Faltan documentos obligatorios:</p>
                {missingDocs.map((m) => (
                  <p key={m.documentTypeId} className="text-xs text-red-600">· {m.name} — usa "excepción" para justificar</p>
                ))}
              </div>
            </div>
          )}
          <Button onClick={handleAdvance} disabled={advancing} className="w-full h-11 font-bold gap-2 text-sm">
            {advancing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Validando…</>
              : <><ChevronRight className="w-4 h-4" /> Completar y avanzar a la siguiente etapa</>}
          </Button>
        </div>
      )}

      {!isCurrentStage && !isFutureStage && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3 border-t">
          <Clock className="w-3.5 h-3.5" /> Vista histórica — etapa ya completada
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
type WorkerInfo = { fullName: string; rut: string; email: string | null; phone: string | null };
type ProjectInfo = { id: string; name: string; weeks: number[] };

export function WorkerPipeline({
  pipeline: initial,
  worker,
  projects,
  readOnly = false,
}: {
  pipeline: WorkerPipelineData;
  worker: WorkerInfo;
  projects: ProjectInfo[];
  readOnly?: boolean;
}) {
  const [currentOrder, setCurrentOrder] = useState(initial.currentStageOrder);
  const [selectedOrder, setSelectedOrder] = useState(
    initial.currentStageOrder > initial.stages.length
      ? initial.stages[initial.stages.length - 1].order
      : initial.currentStageOrder
  );
  const pipeline = { ...initial, currentStageOrder: currentOrder };

  const isDone         = currentOrder > pipeline.stages.length;
  const currentStage   = isDone ? pipeline.stages[pipeline.stages.length - 1] : pipeline.stages.find((s) => s.order === currentOrder)!;
  const selectedStage  = pipeline.stages.find((s) => s.order === selectedOrder) ?? currentStage;
  const isCurrentStage = !isDone && !readOnly && selectedOrder === currentOrder;
  const isFutureStage  = !isDone && selectedOrder > currentOrder;

  function handleAdvanced(n: number) {
    setCurrentOrder(n);
    setSelectedOrder(Math.min(n, pipeline.stages.length));
    if (n > pipeline.stages.length) {
      // Pipeline completado — celebración
      const fire = (particleRatio: number, opts: confetti.Options) =>
        confetti({ particleCount: Math.floor(200 * particleRatio), spread: 70, origin: { y: 0.6 }, ...opts });
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2,  { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1,  { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1,  { spread: 120, startVelocity: 45 });
    } else {
      confetti({ particleCount: 60, spread: 55, origin: { y: 0.55 }, scalar: 0.75 });
    }
  }

  // Stage health: count approved docs across all past stages
  const totalDocs = Object.keys(pipeline.documents).length;
  const approvedDocs = Object.values(pipeline.documents).filter((d) => d.status === "APPROVED").length;

  const stageLabel = isDone ? "Habilitado" : `En ${currentStage.name}`;

  const isAcreditado = currentOrder >= 3;
  const isContratado = currentOrder >= 4;
  const isHabilitado = isDone;

  const statusColor =
    isHabilitado ? "bg-emerald-600" :
    isContratado ? "bg-teal-600" :
    isAcreditado ? "bg-orange-500" :
    "bg-blue-600";

  return (
    <div className="space-y-0">

      {/* ── Record header (Salesforce style) ─────────────────────────────── */}
      <div className="bg-background rounded-t-2xl border border-b-0 px-8 py-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className={`w-14 h-14 rounded-2xl ${statusColor} flex items-center justify-center flex-shrink-0 shadow-lg`}>
            <span className="text-white font-black text-lg tracking-tight">{initials(worker.fullName)}</span>
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-foreground tracking-tight">{worker.fullName}</h1>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full text-white ${statusColor}`}>
                {isHabilitado ? <Trophy className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {stageLabel}
              </span>
            </div>
            {/* Flags */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                isAcreditado ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-muted border-border text-muted-foreground/50"
              }`}>
                <Check className={`w-2.5 h-2.5 ${isAcreditado ? "text-orange-500" : "opacity-30"}`} />
                Acreditado
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                isContratado ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-muted border-border text-muted-foreground/50"
              }`}>
                <Check className={`w-2.5 h-2.5 ${isContratado ? "text-teal-500" : "opacity-30"}`} />
                Contratado
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                isHabilitado ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-muted border-border text-muted-foreground/50"
              }`}>
                {isHabilitado ? <Flag className="w-2.5 h-2.5 text-emerald-500" /> : <Flag className="w-2.5 h-2.5 opacity-30" />}
                Habilitado
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Hash className="w-3.5 h-3.5" /> {worker.rut}
              </span>
              {worker.email && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" /> {worker.email}
                </span>
              )}
              {worker.phone && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" /> {worker.phone}
                </span>
              )}
              {projects.length > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Briefcase className="w-3.5 h-3.5" />
                  {projects.map((p) => p.name).join(", ")}
                </span>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div className="hidden lg:flex items-center gap-6 flex-shrink-0 border-l pl-6">
            <div className="text-center">
              <p className="text-2xl font-black text-foreground">{currentOrder}<span className="text-muted-foreground font-normal text-base">/7</span></p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Etapas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-foreground">{approvedDocs}<span className="text-muted-foreground font-normal text-base">/{totalDocs}</span></p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Docs OK</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stage bar ────────────────────────────────────────────────────── */}
      <div className="border border-t-0 border-b-0 overflow-hidden">
        <StageBar
          stages={pipeline.stages}
          currentOrder={currentOrder}
          selectedOrder={selectedOrder}
          isDone={isDone}
          onSelect={(o) => setSelectedOrder(o)}
        />
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div className="bg-background rounded-b-2xl border border-t-0">
        <div className="flex divide-x">

          {/* Left: Stage breadcrumb + detail */}
          <div className="flex-1 min-w-0 p-6 overflow-hidden">
            <AnimatePresence mode="wait">
            <motion.div
              key={selectedOrder}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
            {/* Selected stage label */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs flex-shrink-0 ${STAGE_COLORS[selectedStage.order]?.active ?? "bg-muted"}`}>
                {(() => { const Icon = STAGE_ICONS[selectedStage.order - 1]; return <Icon className="w-4 h-4" />; })()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-foreground">{selectedStage.name}</h2>
                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">PROCESO</span>
                  {(!isCurrentStage && !isFutureStage) && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-muted text-muted-foreground">histórico</span>
                  )}
                  {isFutureStage && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">próximo</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{selectedStage.description}</p>
              </div>
            </div>

            {isDone && (
              <div className="mb-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-lg flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-white/60">Pipeline completado</p>
                  <p className="font-bold text-lg">Trabajador habilitado para faena</p>
                  <p className="text-white/70 text-xs mt-0.5">Revisa el historial de cada etapa abajo.</p>
                </div>
              </div>
            )}

            <ProcesoPanel
              stage={selectedStage}
              pipeline={pipeline}
              worker={worker}
              isCurrentStage={isCurrentStage}
              isFutureStage={isFutureStage}
              onAdvanced={handleAdvanced}
            />
            </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: sidebar */}
          <div className="w-64 flex-shrink-0 p-5 space-y-5">

            {/* Progress overview */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Progreso general</p>
              <div className="space-y-2">
                {pipeline.stages.map((s) => {
                  const stDone = isDone || s.order < currentOrder;
                  const stActive = !isDone && s.order === currentOrder;
                  const stFuture = !isDone && s.order > currentOrder;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedOrder(s.order)}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all ${
                        s.order === selectedOrder ? "bg-muted ring-1 ring-border" : stFuture ? "opacity-50 hover:opacity-70 hover:bg-muted/40" : "hover:bg-muted/60"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        stDone ? "bg-emerald-500" : stActive ? STAGE_COLORS[s.order]?.active : "bg-muted border border-border"
                      }`}>
                        {stDone
                          ? <Check className="w-2.5 h-2.5 text-white" />
                          : stActive
                          ? <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold truncate ${stActive ? "text-foreground" : stDone ? "text-emerald-700" : "text-muted-foreground"}`}>
                          {s.name}
                        </p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{s.type}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Proyectos */}
            {projects.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Asignaciones</p>
                <div className="space-y-1.5">
                  {projects.map((p) => (
                    <a key={p.id} href={`/dashboard/proyectos/${p.id}`}
                      className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors py-1">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{p.name}</span>
                      <span className="text-muted-foreground flex-shrink-0">{p.weeks.length}s</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
