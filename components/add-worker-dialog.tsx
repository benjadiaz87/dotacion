"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOrCreateWorker, searchWorkers } from "@/lib/actions/workers";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Plus, UserX } from "lucide-react";

export function AddWorkerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [rut, setRut] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [alreadyExists, setAlreadyExists] = useState(false);

  function resetForm() {
    setRut("");
    setFullName("");
    setPhone("");
    setEmail("");
    setAlreadyExists(false);
  }

  async function handleRutBlur() {
    if (rut.length < 3) return;
    const results = await searchWorkers(rut);
    const match = results.find((w) => w.rut === rut);
    setAlreadyExists(!!match);
    if (match) {
      setFullName(match.fullName);
      toast.error("Ya existe un trabajador con ese RUT");
    }
  }

  function handleSubmit() {
    if (!rut || !fullName) {
      toast.error("Completa al menos el RUT y el nombre completo");
      return;
    }
    if (alreadyExists) {
      toast.error("Ese RUT ya está registrado");
      return;
    }

    startTransition(async () => {
      try {
        await getOrCreateWorker({
          rut,
          fullName,
          phone: phone || undefined,
          email: email || undefined,
        });
        toast.success(`${fullName} agregado correctamente`);
        setOpen(false);
        resetForm();
        router.refresh();
      } catch {
        toast.error("Error al agregar el trabajador");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger className={buttonVariants({ className: "gap-2" })}>
        <Plus className="w-4 h-4" />
        Agregar empleado
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar nuevo empleado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>RUT *</Label>
            <Input
              placeholder="12.345.678-9"
              value={rut}
              onChange={(e) => { setRut(e.target.value); setAlreadyExists(false); }}
              onBlur={handleRutBlur}
            />
            {alreadyExists && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                <UserX className="w-3.5 h-3.5" />
                Ya existe un trabajador con este RUT
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Nombre completo *</Label>
            <Input placeholder="Juan Pérez" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input placeholder="+56 9 1234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input placeholder="correo@ejemplo.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Podrás asignarlo a un proyecto y subir su documentación después de crearlo.
          </p>

          <Button onClick={handleSubmit} disabled={isPending} className="w-full gap-2">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Agregando...
              </>
            ) : (
              "Agregar empleado"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
