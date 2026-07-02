"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOrCreateWorker, assignWorkerToWeeks, searchWorkersWithStatus, type WorkerSearchResult } from "@/lib/actions/workers";
import { toast } from "sonner";
import { Loader2, Plus, Search, UserCheck } from "lucide-react";

const semaphoreDot: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};
const semaphoreLabel: Record<string, string> = {
  green: "Habilitado",
  yellow: "Doc. parcial",
  red: "Sin documentos",
};

type Role = { id: string; name: string; color: string };
type WeekPlan = { id: string; weekNumber: number };

interface Props {
  roles: Role[];
  weekPlans: WeekPlan[];
  defaultRoleId?: string;
  trigger?: React.ReactNode;
}

export function AssignWorkerDialog({ roles, weekPlans, defaultRoleId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [rut, setRut] = useState("");
  const [fullName, setFullName] = useState("");
  const [existingWorkerId, setExistingWorkerId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState(defaultRoleId ?? "");
  const [selectedWeeks, setSelectedWeeks] = useState<Set<string>>(new Set());

  // Worker search dropdown
  const [workerQuery, setWorkerQuery] = useState("");
  const [workerResults, setWorkerResults] = useState<WorkerSearchResult[]>([]);
  const [searchingWorkers, setSearchingWorkers] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleWorkerQueryChange(q: string) {
    setWorkerQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setWorkerResults([]); setShowDropdown(false); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchingWorkers(true);
      const results = await searchWorkersWithStatus(q);
      setWorkerResults(results);
      setShowDropdown(true);
      setSearchingWorkers(false);
    }, 300);
  }

  function selectWorker(w: WorkerSearchResult) {
    setRut(w.rut);
    setFullName(w.fullName);
    setExistingWorkerId(w.id);
    setWorkerQuery(w.fullName);
    setShowDropdown(false);
  }

  function resetForm() {
    setRut("");
    setFullName("");
    setExistingWorkerId(null);
    setRoleId(defaultRoleId ?? "");
    setSelectedWeeks(new Set());
    setWorkerQuery("");
    setWorkerResults([]);
    setShowDropdown(false);
  }

  function toggleWeek(id: string) {
    setSelectedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllWeeks() {
    setSelectedWeeks((prev) =>
      prev.size === weekPlans.length ? new Set() : new Set(weekPlans.map((w) => w.id))
    );
  }

  function handleSubmit() {
    if (!rut || !fullName || !roleId || selectedWeeks.size === 0) {
      toast.error("Completa RUT, nombre, cargo y al menos una semana");
      return;
    }

    startTransition(async () => {
      try {
        const worker = await getOrCreateWorker({ rut, fullName });
        await assignWorkerToWeeks(worker.id, Array.from(selectedWeeks), roleId);
        toast.success(`${fullName} asignado correctamente`);
        setOpen(false);
        resetForm();
      } catch {
        toast.error("Error al asignar trabajador");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Asignar trabajador
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar trabajador al proyecto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Búsqueda de trabajador existente */}
          <div className="space-y-1.5" ref={searchRef}>
            <Label>Buscar trabajador existente</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nombre o RUT..."
                value={workerQuery}
                onChange={(e) => handleWorkerQueryChange(e.target.value)}
                onFocus={() => workerResults.length > 0 && setShowDropdown(true)}
                className="pl-8"
              />
              {searchingWorkers && (
                <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              )}
              {showDropdown && workerResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border bg-background shadow-lg overflow-hidden">
                  {workerResults.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onMouseDown={() => selectWorker(w)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                    >
                      <div className="text-left min-w-0">
                        <p className="font-medium truncate">{w.fullName}</p>
                        <p className="text-xs text-muted-foreground">{w.rut}</p>
                      </div>
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`w-2 h-2 rounded-full ${semaphoreDot[w.semaphore]}`} />
                        <span className="text-xs text-muted-foreground">{semaphoreLabel[w.semaphore]}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {existingWorkerId ? (
            <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                <UserCheck className="w-3.5 h-3.5" />
                <span><strong>{fullName}</strong> · {rut} — se reutilizará su ficha</span>
              </div>
              <button
                type="button"
                onClick={() => { setExistingWorkerId(null); setRut(""); setFullName(""); setWorkerQuery(""); }}
                className="text-xs text-emerald-600 hover:underline"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>RUT *</Label>
                <Input
                  placeholder="12.345.678-9"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre completo *</Label>
                <Input
                  placeholder="Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Cargo *</Label>
            <Select value={roleId} onValueChange={(value) => setRoleId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un cargo">
                  {(value: string) => {
                    if (!value) return "Selecciona un cargo";
                    const role = roles.find((r) => r.id === value);
                    if (!role) return "Selecciona un cargo";
                    return (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: role.color }} />
                        {role.name}
                      </span>
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                      {r.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Semanas activas *</Label>
              <button
                type="button"
                onClick={toggleAllWeeks}
                className="text-xs text-primary hover:underline"
              >
                {selectedWeeks.size === weekPlans.length ? "Deseleccionar todas" : "Seleccionar todas"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {weekPlans.map((wp) => {
                const isSelected = selectedWeeks.has(wp.id);
                return (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => toggleWeek(wp.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-input"
                    }`}
                  >
                    S{wp.weekNumber}
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={isPending} className="w-full gap-2">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Asignando...
              </>
            ) : (
              "Asignar trabajador"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
