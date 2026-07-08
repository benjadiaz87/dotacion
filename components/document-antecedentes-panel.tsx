"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateDocumentStatus } from "@/lib/actions/workers";
import {
  extractAntecedentesFromPdf,
  verifyAntecedentesInRC,
  type AntecedentesExtracted,
  type AntecedentesVerificationResult,
} from "@/lib/actions/verificar-documento";
import { toast } from "sonner";
import {
  Check, ChevronDown, ChevronUp, ClipboardCopy, ExternalLink,
  Loader2, X, ShieldCheck, AlertTriangle, FileText,
} from "lucide-react";

const RC_URL = "https://www.registrocivil.cl/OficinaInternet/verificacion/verificacioncertificado.srcei";

interface Props {
  documentId: string;
  fileUrl: string;
  fileName: string;
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

export function DocumentAntecedentesPanel({ documentId, fileUrl, fileName, status }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [extracted, setExtracted] = useState<AntecedentesExtracted | null>(null);
  const [verification, setVerification] = useState<AntecedentesVerificationResult | null>(null);
  const [step, setStep] = useState<"idle" | "extracting" | "extracted" | "verifying" | "done">("idle");

  function setDocStatus(s: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      await updateDocumentStatus(documentId, s);
      toast.success(s === "APPROVED" ? "Documento aprobado" : "Documento rechazado");
      setExpanded(false);
    });
  }

  async function handleExtract() {
    setStep("extracting");
    try {
      const data = await extractAntecedentesFromPdf(documentId);
      setExtracted(data);
      setStep("extracted");
    } catch (err) {
      toast.error("No se pudo extraer datos del PDF");
      setStep("idle");
    }
  }

  async function handleVerify() {
    if (!extracted?.folio || !extracted?.codigoVerificacion) {
      toast.error("Faltan folio o código de verificación");
      return;
    }
    setStep("verifying");
    try {
      const result = await verifyAntecedentesInRC(documentId, extracted.folio, extracted.codigoVerificacion);
      setVerification(result);
      setStep("done");
      if (result.valid) {
        toast.success("Certificado válido — documento aprobado automáticamente");
      } else {
        toast.error(`Certificado inválido: ${result.message}`);
      }
    } catch (err) {
      toast.error("Error al verificar en Registro Civil");
      setStep("extracted");
    }
  }

  return (
    <div className="space-y-2">
      {/* Fila principal */}
      <div className="flex items-center justify-between gap-3">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline truncate flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
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
                  <Button size="sm" variant="outline" className="h-7 px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => setDocStatus("APPROVED")}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-red-700 border-red-200 hover:bg-red-50" onClick={() => setDocStatus("REJECTED")}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Panel expandido */}
      {expanded && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PDF link */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Certificado subido
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-4 rounded-lg border bg-white hover:bg-muted/40 transition-colors text-sm text-primary"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir {fileName}
              </a>
            </div>

            {/* Datos extraídos + acciones */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Verificación en Registro Civil
              </p>

              {/* Step idle: extract button */}
              {(step === "idle") && (
                <button
                  onClick={handleExtract}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Extraer datos del PDF
                </button>
              )}

              {/* Extracting spinner */}
              {step === "extracting" && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extrayendo datos con IA…
                </div>
              )}

              {/* Extracted data */}
              {extracted && step !== "extracting" && (
                <div className="space-y-2">
                  {[
                    { label: "Nombre", value: extracted.fullName },
                    { label: "RUT", value: extracted.rut },
                    { label: "Folio", value: extracted.folio },
                    { label: "Código verificación", value: extracted.codigoVerificacion },
                    { label: "Fecha emisión", value: extracted.fechaEmision },
                  ].filter((f) => f.value).map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-background border">
                      <div>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="text-sm font-mono font-semibold">{value}</p>
                      </div>
                      <CopyButton value={value!} label="Copiar" />
                    </div>
                  ))}

                  {extracted.sinAntecedentes !== null && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${
                      extracted.sinAntecedentes
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}>
                      {extracted.sinAntecedentes
                        ? <><Check className="w-3.5 h-3.5" /> Sin antecedentes</>
                        : <><AlertTriangle className="w-3.5 h-3.5" /> Con antecedentes</>}
                    </div>
                  )}
                </div>
              )}

              {/* Verify button */}
              {step === "extracted" && extracted?.folio && extracted?.codigoVerificacion && (
                <button
                  onClick={handleVerify}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Verificar en Registro Civil
                </button>
              )}

              {/* Verifying spinner */}
              {step === "verifying" && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Consultando Registro Civil…
                </div>
              )}

              {/* Verification result */}
              {verification && step === "done" && (
                <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
                  verification.valid
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  {verification.valid
                    ? <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className={`text-xs font-bold ${verification.valid ? "text-emerald-700" : "text-red-700"}`}>
                      {verification.valid ? "Certificado válido" : "Certificado inválido"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{verification.message}</p>
                  </div>
                </div>
              )}

              {/* Manual fallback link */}
              {(step === "extracted" || step === "done") && (
                <a
                  href={RC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border text-sm text-primary hover:bg-muted/40 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Verificar manualmente en RC
                </a>
              )}
            </div>
          </div>

          {/* Approve / Reject */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={isPending}
              onClick={() => setDocStatus("APPROVED")}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Aprobar documento
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
              disabled={isPending}
              onClick={() => setDocStatus("REJECTED")}
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
