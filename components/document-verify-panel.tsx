"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateDocumentStatus } from "@/lib/actions/workers";
import {
  extractCarnetFromImage, verifyCarnetInRC,
  extractAntecedentesFromPdf, verifyAntecedentesInRC,
  extractHojaVidaFromPdf,
  validateLicenciaDoc,
} from "@/lib/actions/verificar-documento";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

const RC_URL = "https://www.registrocivil.cl/principal/servicios-en-linea/consulta-vigencia-documento-1";

export type DocKind = "carnet" | "antecedentes" | "licencia" | "hoja_vida" | "otro";

// Resultado normalizado — idéntico para las tres verificaciones automáticas
type AutoResult = { valid: boolean; status: string; message: string };

const KIND_CFG: Record<DocKind, { idLabel: string; verifyingText: string; manualRC: boolean }> = {
  carnet:       { idLabel: "N° de serie", verifyingText: "Verificando con IA + Registro Civil…", manualRC: true },
  antecedentes: { idLabel: "Folio",       verifyingText: "Verificando con IA + Registro Civil…", manualRC: true },
  hoja_vida:    { idLabel: "Folio",       verifyingText: "Verificando con IA + Registro Civil…", manualRC: true },
  licencia:     { idLabel: "Clase",       verifyingText: "Verificando con IA + validación de vigencia…", manualRC: false },
  otro:         { idLabel: "Identificador", verifyingText: "", manualRC: false },
};

interface Props {
  documentId: string;
  fileUrl: string;
  fileName: string;
  documentNumber: string | null;
  workerRut: string;
  workerName: string;
  docKind?: DocKind;
  status: string;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <ClipboardCopy className="w-3 h-3" />}
      {copied ? "Copiado" : label}
    </button>
  );
}

const isImage = (url: string) => /\.(jpg|jpeg|png|webp)$/i.test(url);

export function DocumentVerifyPanel({
  documentId,
  fileUrl,
  fileName,
  documentNumber,
  workerRut,
  workerName,
  docKind = "otro",
  status,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [autoVerifying, setAutoVerifying] = useState(false);
  const [autoResult, setAutoResult] = useState<AutoResult | null>(null);

  const cfg = KIND_CFG[docKind];
  const hasAutoVerify = docKind !== "otro";

  // ── Verificación automática — mismo flujo y resultado para los 3 tipos ──
  async function handleAutoVerify() {
    setAutoVerifying(true);
    setAutoResult(null);
    try {
      let result: AutoResult;

      if (docKind === "carnet") {
        const data = await extractCarnetFromImage(documentId);
        if (!data.rut || !data.documentNumber) {
          result = { valid: false, status: "NO_LEGIBLE", message: "No se pudo leer RUT o N° de serie del documento" };
        } else {
          result = await verifyCarnetInRC(documentId, data.rut, data.documentNumber);
        }
      } else if (docKind === "antecedentes") {
        const data = await extractAntecedentesFromPdf(documentId);
        if (!data.folio || !data.codigoVerificacion) {
          result = { valid: false, status: "NO_LEGIBLE", message: "No se pudo leer folio o código de verificación del certificado" };
        } else {
          result = await verifyAntecedentesInRC(documentId, data.folio, data.codigoVerificacion, data.rut);
        }
      } else if (docKind === "hoja_vida") {
        const data = await extractHojaVidaFromPdf(documentId);
        if (!data.folio || !data.codigoVerificacion) {
          result = { valid: false, status: "NO_LEGIBLE", message: "No se pudo leer folio o código de verificación de la hoja de vida" };
        } else {
          result = await verifyAntecedentesInRC(documentId, data.folio, data.codigoVerificacion, data.rut);
        }
      } else {
        result = await validateLicenciaDoc(documentId);
      }

      setAutoResult(result);
      if (result.valid) {
        toast.success("Documento verificado y aprobado automáticamente");
        setTimeout(() => router.refresh(), 2500);
      } else {
        toast.error(result.message);
        router.refresh(); // refresca la nota persistente en la fila
      }
    } catch (e) {
      setAutoResult({ valid: false, status: "ERROR", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setAutoVerifying(false);
    }
  }

  function setStatus(s: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      await updateDocumentStatus(documentId, s);
      toast.success(s === "APPROVED" ? "Documento aprobado" : "Documento rechazado");
      setExpanded(false);
    });
  }

  return (
    <div className="space-y-2">
      {/* Fila principal: archivo + acciones rápidas */}
      <div className="flex items-center justify-between gap-3">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline truncate"
        >
          {fileName}
        </a>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {status === "PENDING" && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
              >
                Verificar
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => setStatus("APPROVED")}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-red-700 border-red-200 hover:bg-red-50" onClick={() => setStatus("REJECTED")}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Panel expandido de verificación */}
      {expanded && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-4">

          {/* Verificación automática — idéntica para carnet, antecedentes y licencia */}
          {hasAutoVerify && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleAutoVerify}
                disabled={autoVerifying || isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold shadow-md shadow-violet-500/20 transition-all disabled:opacity-60"
              >
                {autoVerifying
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {cfg.verifyingText}</>
                  : <><Sparkles className="w-4 h-4" /> Verificación automática</>}
              </button>

              {autoResult && (
                <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                  autoResult.valid
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  {autoResult.valid
                    ? <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    : <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className={`text-xs font-bold ${autoResult.valid ? "text-emerald-800" : "text-red-800"}`}>
                      {autoResult.valid ? "Documento VIGENTE — aprobado" : `Documento ${autoResult.status.replace(/_/g, " ")}`}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${autoResult.valid ? "text-emerald-700" : "text-red-700"}`}>
                      {autoResult.message}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">o verifica manualmente</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Imagen / PDF del documento */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Documento subido
              </p>
              {isImage(fileUrl) ? (
                <img
                  src={fileUrl}
                  alt="Documento"
                  className="w-full rounded-lg border object-contain max-h-64 bg-white"
                />
              ) : (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-4 rounded-lg border bg-white hover:bg-muted/40 transition-colors text-sm text-primary"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir {fileName}
                </a>
              )}
            </div>

            {/* Datos del trabajador y del documento */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {cfg.manualRC ? "Datos para verificar en Registro Civil" : "Datos del documento"}
              </p>

              <div className="space-y-2">
                {[
                  { label: "Trabajador", value: workerName },
                  { label: "RUT", value: workerRut },
                  ...(documentNumber ? [{ label: cfg.idLabel, value: documentNumber }] : []),
                ].filter((f) => f.value).map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-background border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-sm font-mono font-semibold">{value}</p>
                    </div>
                    <CopyButton value={value} label="Copiar" />
                  </div>
                ))}
              </div>

              {cfg.manualRC && (
                <>
                  <a
                    href={RC_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir Registro Civil
                  </a>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Copia los datos, verifícalos en el sitio del RC y vuelve a aprobar o rechazar.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Acciones de aprobación */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={isPending}
              onClick={() => setStatus("APPROVED")}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Aprobar documento
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
              disabled={isPending}
              onClick={() => setStatus("REJECTED")}
            >
              <X className="w-4 h-4" />
              Rechazar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
