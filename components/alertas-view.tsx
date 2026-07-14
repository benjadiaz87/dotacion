"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CountUp, Stagger, StaggerItem } from "@/components/motion-primitives";
import { updateAlertConfig, type AlertasData, type AlertItem, type AlertConfig } from "@/lib/actions/alertas";
import {
  AlertTriangle, ArrowRight, Bell, CalendarClock, FileWarning, Loader2,
  LogOut, Mail, MessageCircle, Monitor, Settings2, TrendingUp, X,
} from "lucide-react";

// ─── Config visual por tipo de alerta ─────────────────────────────────────────
const TIPO_CFG: Record<AlertItem["tipo"], { icon: React.ElementType; label: string }> = {
  gap: { icon: AlertTriangle, label: "Gap de dotación" },
  salida: { icon: LogOut, label: "Salida sin relevo" },
  vencimiento: { icon: FileWarning, label: "Vencimiento" },
  curva: { icon: TrendingUp, label: "Cambio de curva" },
};

const SEV_CFG = {
  critica: { dot: "bg-red-500", border: "border-red-200", soft: "bg-red-50", text: "text-red-700", tile: "from-red-500 to-rose-600", label: "Críticas" },
  advertencia: { dot: "bg-amber-500", border: "border-amber-200", soft: "bg-amber-50", text: "text-amber-700", tile: "from-amber-500 to-orange-500", label: "Advertencias" },
  info: { dot: "bg-blue-500", border: "border-blue-200", soft: "bg-blue-50", text: "text-blue-700", tile: "from-blue-500 to-blue-600", label: "Informativas" },
} as const;

// ─── Panel de configuración ───────────────────────────────────────────────────
function ConfigPanel({ config, canWrite, onClose }: { config: AlertConfig; canWrite: boolean; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<AlertConfig>(config);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await updateAlertConfig(form);
        toast.success("Configuración de alertas guardada");
        router.refresh();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  const Row = ({ title, desc, enabled, onToggle, children }: {
    title: string; desc: string; enabled: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode;
  }) => (
    <div className={`rounded-xl border p-4 transition-opacity ${enabled ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <button
          onClick={() => canWrite && onToggle(!enabled)}
          disabled={!canWrite}
          aria-label={`${enabled ? "Desactivar" : "Activar"} ${title}`}
          className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-primary" : "bg-muted"} ${!canWrite ? "cursor-not-allowed" : ""}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </button>
      </div>
      {enabled && children && <div className="mt-3 pt-3 border-t border-dashed">{children}</div>}
    </div>
  );

  const NumInput = ({ label, value, onChange, min, max, suffix }: {
    label: string; value: number; onChange: (n: number) => void; min: number; max: number; suffix: string;
  }) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min} max={max}
          disabled={!canWrite}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
          className="w-16 h-8 rounded-lg border bg-background text-center text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-xs text-muted-foreground w-14">{suffix}</span>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="card-premium rounded-2xl p-5 space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <p className="font-bold text-foreground flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" /> Configuración de alertas
          </p>
          <button onClick={onClose} aria-label="Cerrar configuración">
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Row
            title="🔴 Gaps de dotación"
            desc="Semanas donde los requeridos superan a los asignados habilitados"
            enabled={form.gapsEnabled}
            onToggle={(v) => setForm({ ...form, gapsEnabled: v })}
          >
            <NumInput label="Horizonte de detección" value={form.gapsSemanas} onChange={(n) => setForm({ ...form, gapsSemanas: n })} min={1} max={12} suffix="semanas" />
          </Row>

          <Row
            title="🟠 Salidas sin relevo"
            desc="Asignaciones que terminan y dejan el cupo descubierto"
            enabled={form.salidasEnabled}
            onToggle={(v) => setForm({ ...form, salidasEnabled: v })}
          >
            <NumInput label="Ventana de anticipación" value={form.salidasSemanas} onChange={(n) => setForm({ ...form, salidasSemanas: n })} min={1} max={8} suffix="semanas" />
          </Row>

          <Row
            title="🔴 Vencimiento de documentos"
            desc="Exámenes y licencias vencidos o por vencer (deshabilitan al trabajador)"
            enabled={form.vencimientosEnabled}
            onToggle={(v) => setForm({ ...form, vencimientosEnabled: v })}
          >
            <NumInput label="Avisar con anticipación de" value={form.vencimientoDias} onChange={(n) => setForm({ ...form, vencimientoDias: n })} min={7} max={90} suffix="días" />
          </Row>

          <Row
            title="🔵 Cambios de curva"
            desc="Modificaciones a los requeridos por semana de un proyecto"
            enabled={form.curvaEnabled}
            onToggle={(v) => setForm({ ...form, curvaEnabled: v })}
          />
        </div>

        {/* Canales */}
        <div className="rounded-xl border border-dashed p-4">
          <p className="text-xs font-bold text-foreground mb-2">Canales de notificación</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              <Monitor className="w-3.5 h-3.5" /> In-app <span className="text-[11px] uppercase tracking-wider bg-primary text-white rounded px-1">activo</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-muted text-muted-foreground border">
              <Mail className="w-3.5 h-3.5" /> Email digest <span className="text-[11px] uppercase tracking-wider bg-muted-foreground/20 rounded px-1">próximamente</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-muted text-muted-foreground border">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp (críticas) <span className="text-[11px] uppercase tracking-wider bg-muted-foreground/20 rounded px-1">próximamente</span>
            </span>
          </div>
        </div>

        {canWrite && (
          <Button onClick={save} disabled={pending} className="w-full h-10 font-semibold gap-2">
            {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : "Guardar configuración"}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export function AlertasView({ data, canWrite }: { data: AlertasData; canWrite: boolean }) {
  const [showConfig, setShowConfig] = useState(false);
  const [filtro, setFiltro] = useState<AlertItem["tipo"] | null>(null);

  const visibles = filtro ? data.alertas.filter((a) => a.tipo === filtro) : data.alertas;
  const tipos = Object.keys(TIPO_CFG) as AlertItem["tipo"][];

  return (
    <>
      {/* Hero */}
      <div className="hero-aurora bg-dotgrid border-b bg-background/60">
        <div className="max-w-5xl mx-auto px-6 pt-10 pb-8 relative">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1 mb-4 shadow-sm"
              >
                <Bell className="w-3 h-3 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                  Motor de alertas · evaluación en tiempo real
                </span>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08 }}
                className="text-4xl font-black tracking-tight text-gradient"
              >
                Alertas
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.14 }}
                className="text-sm text-muted-foreground mt-1"
              >
                {data.alertas.length} alerta{data.alertas.length !== 1 ? "s" : ""} activa{data.alertas.length !== 1 ? "s" : ""} en tus proyectos
              </motion.p>
            </div>
            <motion.button
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-2 h-10 px-4 rounded-lg border bg-background/80 backdrop-blur text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors shadow-sm"
            >
              <Settings2 className="w-4 h-4" /> Configurar alertas
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <AnimatePresence>
          {showConfig && <ConfigPanel config={data.config} canWrite={canWrite} onClose={() => setShowConfig(false)} />}
        </AnimatePresence>

        {/* Resumen por severidad */}
        <Stagger className="grid grid-cols-3 gap-3 mb-6">
          {(Object.keys(SEV_CFG) as (keyof typeof SEV_CFG)[]).map((sev) => (
            <StaggerItem key={sev}>
              <div className="card-premium rounded-2xl p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${SEV_CFG[sev].tile} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xl font-black text-foreground leading-none">
                    <CountUp value={data.counts[sev]} duration={1} />
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">{SEV_CFG[sev].label}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Filtros por tipo */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFiltro(null)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filtro === null ? "bg-primary text-white border-primary" : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Todas ({data.alertas.length})
          </button>
          {tipos.map((t) => {
            const count = data.alertas.filter((a) => a.tipo === t).length;
            const Icon = TIPO_CFG[t].icon;
            return (
              <button
                key={t}
                onClick={() => setFiltro(filtro === t ? null : t)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  filtro === t ? "bg-primary text-white border-primary" : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-3 h-3" /> {TIPO_CFG[t].label} ({count})
              </button>
            );
          })}
        </div>

        {/* Lista de alertas */}
        {visibles.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Sin alertas activas</p>
            <p className="text-xs text-muted-foreground mt-1">Todos los proyectos están cubiertos y los documentos vigentes.</p>
          </div>
        ) : (
          <Stagger className="space-y-2">
            {visibles.map((a) => {
              const sev = SEV_CFG[a.severidad];
              const Icon = TIPO_CFG[a.tipo].icon;
              return (
                <StaggerItem key={a.id}>
                  <div className={`flex items-center gap-4 rounded-xl border bg-background px-4 py-3 ${sev.border}`}>
                    <div className={`w-9 h-9 rounded-xl ${sev.soft} flex items-center justify-center flex-shrink-0 relative`}>
                      <Icon className={`w-4 h-4 ${sev.text}`} />
                      <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${sev.dot} ${a.severidad === "critica" ? "animate-pulse" : ""}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{a.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.detalle}</p>
                    </div>
                    {a.fecha && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground flex-shrink-0">
                        <CalendarClock className="w-3 h-3" /> {a.fecha}
                      </span>
                    )}
                    <Link
                      href={a.href}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors ${
                        a.severidad === "critica"
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : a.severidad === "advertencia"
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-primary text-white hover:bg-primary/90"
                      }`}
                    >
                      {a.accion} <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </div>
    </>
  );
}
