"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadWorkerDocument } from "@/lib/actions/workers";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

interface Props {
  workerId: string;
  documentTypeId: string;
  showDocumentNumber?: boolean;
}

export function DocumentUploadForm({ workerId, documentTypeId, showDocumentNumber }: Props) {
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await uploadWorkerDocument(workerId, documentTypeId, formData);
        toast.success("Documento subido — pendiente de revisión");
        formRef.current?.reset();
        setFileName(null);
      } catch (e) {
        toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-2">
      {showDocumentNumber && (
        <div>
          <Input
            name="documentNumber"
            placeholder="Número de serie del documento (ej: A123456789)"
            className="h-9 text-sm"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Requerido para verificar vigencia en Registro Civil
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
          <Upload className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{fileName ?? "Seleccionar archivo (PDF, JPG, PNG)"}</span>
          <input
            type="file"
            name="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            required
          />
        </label>
        <Button type="submit" size="sm" disabled={isPending || !fileName} className="gap-1.5 flex-shrink-0">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Subir"}
        </Button>
      </div>
    </form>
  );
}
