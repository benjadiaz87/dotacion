"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateDocumentStatus } from "@/lib/actions/workers";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";

const RC_URL = "https://www.registrocivil.cl/principal/servicios-en-linea/consulta-vigencia-documento-1";

interface Props {
  documentId: string;
  fileUrl: string;
  fileName: string;
  documentNumber: string | null;
  workerRut: string;
  workerName: string;
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
  status,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setStatus(s: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      await updateDocumentStatus(documentId, s);
      toast.success(s === "APPROVED" ? "Documento aprobado" : "Documento rechazado");
      setExpanded(false);
    });
  }

  const canVerify = !!documentNumber;

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

            {/* Datos para verificar en RC */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Datos para verificar en Registro Civil
              </p>

              <div className="space-y-2">
                {[
                  { label: "Trabajador", value: workerName },
                  { label: "RUT", value: workerRut },
                  ...(documentNumber ? [{ label: "N° de serie", value: documentNumber }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-background border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-sm font-mono font-semibold">{value}</p>
                    </div>
                    <CopyButton value={value} label="Copiar" />
                  </div>
                ))}
              </div>

              {!canVerify && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                  Sube el documento con el número de serie para habilitar la verificación directa.
                </p>
              )}

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
                Copia el RUT y N° de serie, pégalos en el sitio del RC y vuelve a aprobar o rechazar.
              </p>
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
