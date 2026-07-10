"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountUp, Stagger, StaggerItem } from "@/components/motion-primitives";
import { createFeatureRequest, updateFeatureStatus, type FeatureRequestItem } from "@/lib/actions/features";
import {
  Bug, CheckCircle2, ChevronDown, Hammer, Lightbulb, Loader2,
  MapPin, Plus, Sparkles, Target, X, Zap,
} from "lucide-react";

const TIPOS = [
  { value: "FEATURE", label: "Nueva feature", icon: Sparkles, color: "text-violet-600", soft: "bg-violet-50 border-violet-200" },
  { value: "MEJORA", label: "Mejora", icon: Zap, color: "text-blue-600", soft: "bg-blue-50 border-blue-200" },
  { value: "BUG", label: "Bug", icon: Bug, color: "text-red-600", soft: "bg-red-50 border-red-200" },
] as const;

const AREAS = ["Dashboard", "Proyectos / Torre de Control", "Pipeline del trabajador", "Documentos / Verificación", "Alertas", "Cargos", "Portal del trabajador", "Otra"];

const PRIORIDADES = [
  { value: "ALTA", label: "Alta", cls: "bg-red-50 border-red-200 text-red-700" },
  { value: "MEDIA", label: "Media", cls: "bg-amber-50 border-amber-200 text-amber-700" },
  { value: "BAJA", label: "Baja", cls: "bg-slate-50 border-slate-200 text-slate-600" },
] as const;

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  NUEVA: { label: "Nueva", cls: "bg-blue-50 border-blue-200 text-blue-700" },
  EN_DESARROLLO: { label: "En desarrollo", cls: "bg-violet-50 border-violet-200 text-violet-700" },
  HECHA: { label: "Hecha", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  DESCARTADA: { label: "Descartada", cls: "bg-slate-50 border-slate-200 text-slate-500" },
};

// ─── Formulario ───────────────────────────────────────────────────────────────
function FeatureForm({ onDone }: { onDone: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<"FEATURE" | "MEJORA" | "BUG">("FEATURE");
  const [area, setArea] = useState(AREAS[0]);
  const [prioridad, setPrioridad] = useState<"ALTA" | "MEDIA" | "BAJA">("MEDIA");
  const [problema, setProblema] = useState("");
  const [comportamiento, setComportamiento] = useState("");
  const [criterios, setCriterios] = useState("");
  const [pantalla, setPantalla] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      try {
        await createFeatureRequest({ titulo, tipo, area, prioridad, problema, comportamiento, criterios, pantalla });
        toast.success("Feature request creada — lista para desarrollo");
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Revisa los campos del formulario");
      }
    });
  }

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <label className="text-xs font-bold text-foreground">{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );

  const areaCls = "w-full text-sm rounded-lg border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50";

  return (
    <div className="card-premium rounded-2xl p-6 space-y-4 mb-6">
      <p className="font-bold text-foreground flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-amber-500" /> Nueva feature request
      </p>

      <Field label="Título" hint="Imperativo y específico. Ej: 'Permitir reordenar las etapas del pipeline arrastrando'">
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Qué hay que construir, en una frase" autoFocus />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Tipo">
          <div className="flex gap-1.5">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={`flex-1 flex items-center justify-center gap-1 h-9 rounded-lg border text-xs font-semibold transition-all ${
                  tipo === t.value ? `${t.soft} ${t.color} ring-1 ring-current` : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Área de la plataforma">
          <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full h-9 text-sm rounded-lg border bg-background px-3 focus:outline-none focus:ring-1 focus:ring-primary">
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Prioridad">
          <div className="flex gap-1.5">
            {PRIORIDADES.map((pr) => (
              <button
                key={pr.value}
                onClick={() => setPrioridad(pr.value)}
                className={`flex-1 h-9 rounded-lg border text-xs font-semibold transition-all ${
                  prioridad === pr.value ? `${pr.cls} ring-1 ring-current` : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {pr.label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="¿Qué problema resuelve?" hint="El porqué. Quién sufre hoy, qué hace a mano, qué se pierde. Sin esto no se puede priorizar.">
        <textarea rows={2} value={problema} onChange={(e) => setProblema(e.target.value)} className={areaCls}
          placeholder="Ej: El admin no puede saber qué trabajadores tienen exámenes por vencer sin revisar uno por uno…" />
      </Field>

      <Field label="Comportamiento esperado" hint="Paso a paso, como si se lo explicaras a alguien que nunca vio la app: dónde hace clic el usuario, qué ve, qué pasa después.">
        <textarea rows={4} value={comportamiento} onChange={(e) => setComportamiento(e.target.value)} className={areaCls}
          placeholder={"Ej:\n1. En la tabla de empleados aparece una columna 'Vencimientos'\n2. Al hacer clic se abre un panel con los documentos por vencer\n3. Cada fila tiene botón 'Notificar' que…"} />
      </Field>

      <Field label="Criterios de aceptación" hint="'Está listo cuando…' — condiciones verificables, una por línea. Esto define cuándo la feature se considera terminada.">
        <textarea rows={3} value={criterios} onChange={(e) => setCriterios(e.target.value)} className={areaCls}
          placeholder={"Ej:\n- El auditor puede ver la columna pero no notificar\n- El Excel exportado incluye la nueva columna\n- Funciona con 1.000+ trabajadores sin lag"} />
      </Field>

      <Field label="¿Dónde vive? (opcional)" hint="Pantalla o URL exacta donde aplica. Ej: /dashboard/empleados, o 'pipeline del trabajador, etapa 2'">
        <Input value={pantalla} onChange={(e) => setPantalla(e.target.value)} placeholder="/dashboard/…" />
      </Field>

      <Button onClick={submit} disabled={pending} className="w-full h-10 font-semibold gap-2">
        {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Plus className="w-4 h-4" /> Crear feature request</>}
      </Button>
    </div>
  );
}

// ─── Card de feature ──────────────────────────────────────────────────────────
function FeatureCard({ f, canWrite }: { f: FeatureRequestItem; canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const tipo = TIPOS.find((t) => t.value === f.tipo) ?? TIPOS[0];
  const pr = PRIORIDADES.find((p) => p.value === f.prioridad) ?? PRIORIDADES[1];
  const st = STATUS_CFG[f.status] ?? STATUS_CFG.NUEVA;

  function setStatus(status: "NUEVA" | "EN_DESARROLLO" | "HECHA" | "DESCARTADA") {
    start(async () => {
      await updateFeatureStatus(f.id, status);
      toast.success(`Marcada como ${STATUS_CFG[status].label.toLowerCase()}`);
      router.refresh();
    });
  }

  return (
    <div className={`card-premium rounded-2xl overflow-hidden ${f.status === "HECHA" || f.status === "DESCARTADA" ? "opacity-70" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 text-left">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${tipo.soft}`}>
          <tipo.icon className={`w-4 h-4 ${tipo.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{f.titulo}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {f.area} · por {f.createdBy} · {new Date(f.createdAt).toLocaleDateString("es-CL")}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${pr.cls}`}>{pr.label}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${st.cls}`}>{st.label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t pt-3 space-y-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Problema que resuelve</p>
                <p className="text-xs text-foreground whitespace-pre-wrap">{f.problema}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Comportamiento esperado</p>
                <p className="text-xs text-foreground whitespace-pre-wrap">{f.comportamiento}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Criterios de aceptación
                </p>
                <p className="text-xs text-foreground whitespace-pre-wrap">{f.criterios}</p>
              </div>
              {f.pantalla && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Dónde vive
                  </p>
                  <p className="text-xs font-mono text-foreground">{f.pantalla}</p>
                </div>
              )}

              {canWrite && f.status !== "HECHA" && f.status !== "DESCARTADA" && (
                <div className="flex gap-1.5 pt-2 border-t">
                  {f.status === "NUEVA" && (
                    <button onClick={() => setStatus("EN_DESARROLLO")} disabled={pending}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 h-8 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50">
                      <Hammer className="w-3.5 h-3.5" /> Tomar para desarrollo
                    </button>
                  )}
                  {f.status === "EN_DESARROLLO" && (
                    <button onClick={() => setStatus("HECHA")} disabled={pending}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 h-8 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Marcar hecha
                    </button>
                  )}
                  <button onClick={() => setStatus("DESCARTADA")} disabled={pending}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 h-8 rounded-lg border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
                    <X className="w-3.5 h-3.5" /> Descartar
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export function FeaturesView({ features, canWrite }: { features: FeatureRequestItem[]; canWrite: boolean }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const activas = features.filter((f) => f.status === "NUEVA" || f.status === "EN_DESARROLLO");

  return (
    <>
      {/* Hero */}
      <div className="hero-aurora bg-dotgrid border-b bg-background/60">
        <div className="max-w-4xl mx-auto px-6 pt-10 pb-8 relative">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1 mb-4 shadow-sm"
              >
                <Lightbulb className="w-3 h-3 text-amber-500" />
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                  Backlog del equipo de desarrollo
                </span>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08 }}
                className="text-4xl font-black tracking-tight text-gradient"
              >
                Features
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.14 }}
                className="text-sm text-muted-foreground mt-1"
              >
                <CountUp value={activas.length} /> activa{activas.length !== 1 ? "s" : ""} de {features.length} — mientras más claro el request, más rápido se desarrolla
              </motion.p>
            </div>
            {canWrite && (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: 0.2 }}>
                <Button onClick={() => setShowForm(!showForm)} className="gap-2 h-10 font-semibold shadow-lg shadow-primary/25">
                  <Plus className="w-4 h-4" /> Nueva feature
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <FeatureForm onDone={() => { setShowForm(false); router.refresh(); }} />
            </motion.div>
          )}
        </AnimatePresence>

        {features.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <Lightbulb className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Sin feature requests aún</p>
            <p className="text-xs text-muted-foreground mt-1">Crea la primera con el botón de arriba.</p>
          </div>
        ) : (
          <Stagger className="space-y-2">
            {features.map((f) => (
              <StaggerItem key={f.id}>
                <FeatureCard f={f} canWrite={canWrite} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </>
  );
}
