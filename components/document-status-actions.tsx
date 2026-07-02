"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateDocumentStatus } from "@/lib/actions/workers";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";

interface Props {
  documentId: string;
}

export function DocumentStatusActions({ documentId }: Props) {
  const [isPending, startTransition] = useTransition();

  function setStatus(status: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      await updateDocumentStatus(documentId, status);
      toast.success(status === "APPROVED" ? "Documento aprobado" : "Documento rechazado");
    });
  }

  if (isPending) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="outline" className="h-7 px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => setStatus("APPROVED")}>
        <Check className="w-3.5 h-3.5" />
      </Button>
      <Button size="sm" variant="outline" className="h-7 px-2 text-red-700 border-red-200 hover:bg-red-50" onClick={() => setStatus("REJECTED")}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
