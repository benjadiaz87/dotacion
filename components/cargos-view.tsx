"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stagger, StaggerItem, CountUp } from "@/components/motion-primitives";
import { createRole, deleteRole, type CargosData } from "@/lib/actions/roles";
import {
  ArrowRight, BadgeCheck, FileText, Loader2, Plus, ShieldCheck, Trash2, Users,
} from "lucide-react";

const ROLE_COLORS = ["#3b82f6", "#8b5cf6", "#f97316", "#10b981", "#ef4444", "#eab308", "#06b6d4", "#ec4899"];
const CATEGORIES = ["OPERATIVO", "SUPERVISIÓN", "PROFESIONAL", "ADMINISTRATIVO"];

// ─── Crear cargo ──────────────────────────────────────────────────────────────
function CreateRoleCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [color, setColor] = useState(ROLE_COLORS[0]);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      try {
        const roleId = await createRole(name, category, color);
        toast.success(`Cargo "${name.trim()}" creado — configura sus requisitos`);
        router.push(`/dashboard/cargos/${roleId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al crear el cargo");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full h-full min-h-[140px] rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary group"
      >
        <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
          <Plus className="w-5 h-5" />
        </div>
        <span className="text-sm font-semibold">Crear nuevo cargo</span>
        <span className="text-[11px] text-muted-foreground">Parte con 0 requisitos — los defines en su pipeline</span>
      </button>
    );
  }

  return (
    <div className="card-premium rounded-2xl p-5 space-y-3">
      <p className="text-sm font-bold text-foreground">Nuevo cargo</p>
      <Input
        placeholder="Ej: Operador de Grúa Torre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="h-9"
      />
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
              category === c ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        {ROLE_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
            className={`w-6 h-6 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-foreground/30 scale-110" : "hover:scale-110"}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button size="sm" className="flex-1 h-8 font-semibold" onClick={submit} disabled={pending || !name.trim()}>
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Crear y configurar"}
        </Button>
      </div>
    </div>
  );
}

// ─── Card de cargo (navega a su pipeline) ─────────────────────────────────────
function RoleCard({ role, stagesCount, onDone }: {
  role: CargosData["roles"][0];
  stagesCount: number;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState<{ workers: number; assignments: number; planRequirements: number } | null>(null);

  // Etapas que tienen al menos un requisito
  const stagesWithDocs = new Set(role.requirements.map((r) => r.stageOrder)).size;

  function handleDelete(e: React.MouseEvent, force = false) {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const r = await deleteRole(role.id, force);
      if (r.ok) {
        toast.success(`Cargo "${role.name}" eliminado${force ? " — pipelines recalculados" : ""}`);
        setConfirming(null);
        onDone();
      } else if ("needsConfirm" in r && r.needsConfirm) {
        setConfirming({ workers: r.workers, assignments: r.assignments, planRequirements: r.planRequirements });
      } else {
        toast.error("reason" in r ? r.reason : "No se puede eliminar");
      }
    });
  }

  return (
    <Link href={`/dashboard/cargos/${role.id}`} className="block h-full">
      <div className="card-premium card-lift rounded-2xl p-5 h-full group cursor-pointer">
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
            style={{ background: role.color, boxShadow: `0 4px 12px ${role.color}40` }}
          >
            <BadgeCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{role.name}</p>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded inline-block mt-1">
              {role.category}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => handleDelete(e)}
              disabled={pending}
              aria-label={`Eliminar ${role.name}`}
              className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 flex items-center justify-center transition-all"
            >
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Confirmación de borrado con impacto */}
        {confirming && (
          <div
            className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 space-y-2"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <p className="text-xs font-bold text-red-800">¿Eliminar "{role.name}"? Este cargo está en uso:</p>
            <ul className="text-[11px] text-red-700 space-y-0.5">
              {confirming.workers > 0 && <li>· {confirming.workers} trabajador{confirming.workers !== 1 ? "es" : ""} quedará{confirming.workers !== 1 ? "n" : ""} sin cargo (pipelines recalculados)</li>}
              {confirming.assignments > 0 && <li>· {confirming.assignments} asignación{confirming.assignments !== 1 ? "es" : ""} a proyectos se eliminará{confirming.assignments !== 1 ? "n" : ""}</li>}
              {confirming.planRequirements > 0 && <li>· {confirming.planRequirements} requerimiento{confirming.planRequirements !== 1 ? "s" : ""} de planificación se eliminará{confirming.planRequirements !== 1 ? "n" : ""}</li>}
            </ul>
            <div className="flex gap-1.5">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(null); }}
                className="flex-1 text-xs h-7 rounded border border-border bg-white hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={(e) => handleDelete(e, true)}
                disabled={pending}
                className="flex-1 text-xs h-7 rounded bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50 transition-colors"
              >
                {pending ? "Eliminando…" : "Eliminar de todas formas"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mt-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" /> {role.workersCount}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="w-3.5 h-3.5" /> {role.requirements.length} requisito{role.requirements.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Mini indicador de etapas configuradas */}
        <div className="flex items-center gap-1 mt-3">
          {Array.from({ length: stagesCount }, (_, i) => {
            const hasDocs = role.requirements.some((r) => r.stageOrder === i + 1);
            return (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: hasDocs ? role.color : "var(--muted)" }}
              />
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {stagesWithDocs}/{stagesCount} etapas con requisitos
        </p>
      </div>
    </Link>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export function CargosView({ data }: { data: CargosData }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const totalRequirements = useMemo(
    () => data.roles.reduce((s, r) => s + r.requirements.length, 0),
    [data.roles]
  );

  return (
    <>
      {/* Hero */}
      <div className="hero-aurora bg-dotgrid border-b bg-background/60">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1 mb-4 shadow-sm"
          >
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
              Administración de cargos y requisitos
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="text-4xl font-black tracking-tight text-gradient"
          >
            Cargos
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className="text-sm text-muted-foreground mt-1"
          >
            <CountUp value={data.roles.length} /> cargo{data.roles.length !== 1 ? "s" : ""} · {totalRequirements} requisito{totalRequirements !== 1 ? "s" : ""} documental{totalRequirements !== 1 ? "es" : ""} · cada cargo define su pipeline
          </motion.p>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Stagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.roles.map((role) => (
            <StaggerItem key={role.id} className="h-full">
              <RoleCard role={role} stagesCount={data.stages.length} onDone={refresh} />
            </StaggerItem>
          ))}
          <StaggerItem>
            <CreateRoleCard />
          </StaggerItem>
        </Stagger>
      </div>
    </>
  );
}
