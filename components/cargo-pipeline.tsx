"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addRoleRequirement, addManyRoleRequirements, createDocTypeForRole, removeRoleRequirement,
  type RoleDetail,
} from "@/lib/actions/roles";
import {
  ArrowLeft, BadgeCheck, Check, ChevronRight, Clipboard, FilePlus2, FileText,
  Hammer, Loader2, Plus, ShieldCheck, Sparkles, Trash2, Users, X,
} from "lucide-react";

const STAGE_ICONS = [Clipboard, FileText, Hammer, ShieldCheck];

const STAGE_COLORS: Record<number, string> = {
  1: "bg-blue-600",
  2: "bg-indigo-600",
  3: "bg-orange-500",
  4: "bg-teal-600",
};

// ─── Chevron stage bar (mismo estilo que el pipeline del trabajador) ──────────
function StageBar({ stages, requirements, selectedOrder, onSelect }: {
  stages: RoleDetail["stages"];
  requirements: RoleDetail["requirements"];
  selectedOrder: number;
  onSelect: (o: number) => void;
}) {
  return (
    <div className="flex w-full overflow-hidden rounded-xl border border-border shadow-sm">
      {stages.map((stage, i) => {
        const selected = stage.order === selectedOrder;
        const count = requirements[stage.id]?.length ?? 0;
        const Icon = STAGE_ICONS[i] ?? FileText;

        return (
          <button
            key={stage.id}
            onClick={() => onSelect(stage.order)}
            className={`
              relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-3 px-2
              transition-all duration-200 cursor-pointer
              ${selected ? `${STAGE_COLORS[stage.order]} text-white shadow-inner` : "bg-muted/60 text-muted-foreground hover:bg-muted"}
            `}
            style={{ clipPath: i < stages.length - 1 ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)" : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)" }}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
              <span className="text-[10px] font-bold uppercase tracking-wide leading-tight text-center truncate max-w-[90px]">
                {stage.name}
              </span>
            </div>
            <span className={`text-[9px] font-semibold ${selected ? "text-white/70" : "text-muted-foreground/70"}`}>
              {count} doc{count !== 1 ? "s" : ""}
            </span>
            {selected && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-white rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Recomendación Etapa 1 (prellenado con los 7 docs) ────────────────────────
function Stage1Recommendation({ detail, stageId, onDone }: {
  detail: RoleDetail;
  stageId: string;
  onDone: () => void;
}) {
  const existing = new Set((detail.requirements[stageId] ?? []).map((r) => r.documentTypeId));
  const candidates = detail.stage1Recommended.filter((d) => !existing.has(d.id));
  const [checked, setChecked] = useState<Set<string>>(new Set(candidates.map((c) => c.id)));
  const [pending, start] = useTransition();

  if (candidates.length === 0) return null;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addAll() {
    start(async () => {
      try {
        const r = await addManyRoleRequirements(detail.role.id, stageId, Array.from(checked));
        toast.success(`${r.added} documento${r.added !== 1 ? "s" : ""} añadido${r.added !== 1 ? "s" : ""} — pipelines recalculados`);
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/50 p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/25">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-violet-900">Documentos recomendados de precontratación</p>
          <p className="text-xs text-violet-700">Los 7 documentos estándar de la Evaluación Documental, prellenados para este cargo</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-1.5">
        {candidates.map((d) => (
          <label
            key={d.id}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
              checked.has(d.id) ? "bg-white border-violet-300 shadow-sm" : "bg-white/40 border-transparent opacity-60"
            }`}
          >
            <input
              type="checkbox"
              checked={checked.has(d.id)}
              onChange={() => toggle(d.id)}
              className="rounded accent-violet-600"
            />
            <span className="text-xs font-medium text-foreground flex-1 truncate">{d.name}</span>
            {!d.required && <span className="text-[9px] text-muted-foreground flex-shrink-0">opcional</span>}
          </label>
        ))}
      </div>

      <Button
        onClick={addAll}
        disabled={pending || checked.size === 0}
        className="w-full h-9 font-semibold gap-2 bg-violet-600 hover:bg-violet-700"
      >
        {pending
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Añadiendo…</>
          : <><Check className="w-4 h-4" /> Prellenar {checked.size} documento{checked.size !== 1 ? "s" : ""}</>}
      </Button>
    </motion.div>
  );
}

// ─── Añadir requisito: dropdown existentes + crear nuevo ──────────────────────
function AddDocControls({ detail, stageId, onDone }: {
  detail: RoleDetail;
  stageId: string;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"closed" | "select" | "create">("closed");
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [newRequired, setNewRequired] = useState(true);
  const [pending, start] = useTransition();

  const existing = new Set((detail.requirements[stageId] ?? []).map((r) => r.documentTypeId));
  const available = detail.documentTypes.filter(
    (dt) => !existing.has(dt.id) && dt.name.toLowerCase().includes(filter.toLowerCase())
  );

  function selectExisting(documentTypeId: string) {
    start(async () => {
      try {
        await addRoleRequirement(detail.role.id, stageId, documentTypeId);
        toast.success("Requisito añadido — pipelines recalculados");
        setMode("closed"); setFilter(""); onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  function createNew() {
    start(async () => {
      try {
        await createDocTypeForRole(detail.role.id, stageId, newName, newRequired);
        toast.success(`Documento "${newName.trim()}" creado y añadido`);
        setNewName(""); setMode("closed"); onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  if (mode === "closed") {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setMode("select")}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed text-xs font-semibold text-primary hover:bg-primary/5 hover:border-primary/40 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Requisito existente
        </button>
        <button
          onClick={() => setMode("create")}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed text-xs font-semibold text-violet-600 hover:bg-violet-50 hover:border-violet-300 transition-all"
        >
          <FilePlus2 className="w-3.5 h-3.5" /> Crear nuevo documento
        </button>
      </div>
    );
  }

  if (mode === "select") {
    return (
      <div className="rounded-xl border bg-background shadow-sm p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Requisitos existentes</p>
          <button onClick={() => { setMode("closed"); setFilter(""); }} aria-label="Cerrar">
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        <Input
          placeholder="Filtrar documentos…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
          className="h-8 text-xs"
        />
        <div className="max-h-52 overflow-y-auto space-y-0.5">
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Sin documentos disponibles</p>
          ) : (
            available.map((dt) => (
              <button
                key={dt.id}
                onClick={() => selectExisting(dt.id)}
                disabled={pending}
                className="w-full flex items-center gap-2 text-left text-xs px-2.5 py-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate font-medium">{dt.name}</span>
                {!dt.required && <span className="text-[9px] text-muted-foreground">opcional</span>}
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700">Crear nuevo documento</p>
        <button onClick={() => setMode("closed")} aria-label="Cerrar">
          <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
      <Input
        placeholder="Ej: Licencia interna clase D"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        autoFocus
        className="h-9 text-xs bg-white"
      />
      <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
        <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} className="rounded accent-violet-600" />
        Obligatorio para avanzar de etapa
      </label>
      <Button
        size="sm"
        className="w-full h-8 text-xs font-semibold bg-violet-600 hover:bg-violet-700"
        onClick={createNew}
        disabled={pending || !newName.trim()}
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Crear y añadir a esta etapa"}
      </Button>
    </div>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export function CargoPipeline({ detail }: { detail: RoleDetail }) {
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState(1);
  const [pending, start] = useTransition();
  const refresh = () => router.refresh();

  const selectedStage = detail.stages.find((s) => s.order === selectedOrder)!;
  const stageReqs = detail.requirements[selectedStage.id] ?? [];
  const totalReqs = Object.values(detail.requirements).reduce((s, list) => s + list.length, 0);
  const isStage1 = selectedOrder === 1;

  function handleRemove(id: string, name: string) {
    start(async () => {
      try {
        await removeRoleRequirement(id);
        toast.success(`"${name}" eliminado — pipelines recalculados`);
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <div className="space-y-0">
      {/* Back */}
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
        <Link
          href="/dashboard/cargos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a cargos
        </Link>
      </motion.div>

      {/* ── Record header ─────────────────────────────────────────────────── */}
      <div className="bg-background rounded-t-2xl border border-b-0 px-8 py-6">
        <div className="flex items-center gap-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ background: detail.role.color, boxShadow: `0 8px 24px ${detail.role.color}50` }}
          >
            <BadgeCheck className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-foreground tracking-tight">{detail.role.name}</h1>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {detail.role.category}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-1.5">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="w-3.5 h-3.5" /> {detail.role.workersCount} trabajador{detail.role.workersCount !== 1 ? "es" : ""}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileText className="w-3.5 h-3.5" /> {totalReqs} requisito{totalReqs !== 1 ? "s" : ""} documental{totalReqs !== 1 ? "es" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stage bar ────────────────────────────────────────────────────── */}
      <div className="border border-t-0 border-b-0 overflow-hidden">
        <StageBar
          stages={detail.stages}
          requirements={detail.requirements}
          selectedOrder={selectedOrder}
          onSelect={setSelectedOrder}
        />
      </div>

      {/* ── Panel de la etapa ─────────────────────────────────────────────── */}
      <div className="bg-background rounded-b-2xl border border-t-0 p-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedOrder}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            {/* Stage label */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${STAGE_COLORS[selectedOrder]}`}>
                {(() => { const Icon = STAGE_ICONS[selectedOrder - 1] ?? FileText; return <Icon className="w-4 h-4" />; })()}
              </div>
              <div>
                <h2 className="font-bold text-foreground">Etapa {selectedStage.order} — {selectedStage.name}</h2>
                <p className="text-xs text-muted-foreground">{selectedStage.description}</p>
              </div>
            </div>

            {/* Recomendación de prellenado — solo Etapa 1 */}
            {isStage1 && (
              <Stage1Recommendation detail={detail} stageId={selectedStage.id} onDone={refresh} />
            )}

            {/* Requisitos actuales */}
            {stageReqs.length > 0 ? (
              <div className="space-y-2">
                {stageReqs.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 group hover:border-border transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${detail.role.color}20` }}>
                      <FileText className="w-3 h-3" style={{ color: detail.role.color }} />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground truncate">{r.name}</span>
                    {!r.required && (
                      <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">opcional</span>
                    )}
                    <button
                      onClick={() => handleRemove(r.id, r.name)}
                      disabled={pending}
                      aria-label={`Quitar ${r.name}`}
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 flex items-center justify-center transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : !isStage1 ? (
              <div className="rounded-xl border border-dashed px-5 py-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Esta etapa no tiene requisitos para este cargo aún.</p>
              </div>
            ) : null}

            {/* Añadir: dropdown existentes / crear nuevo */}
            <AddDocControls detail={detail} stageId={selectedStage.id} onDone={refresh} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
