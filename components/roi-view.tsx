"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Clock, TrendingUp, Users, Calculator, Zap, RotateCcw } from "lucide-react";
import type { RoiBaseline } from "@/lib/actions/ejecutivo";

function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}
function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("es-CL");
}

// Campo numérico editable (para ajustar supuestos en vivo durante la demo)
function Assumption({ label, value, onChange, suffix, step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number; min?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          className="w-24 h-9 text-right text-sm font-bold tabular-nums rounded-lg border bg-background px-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {suffix && <span className="text-xs text-muted-foreground w-14">{suffix}</span>}
      </div>
    </div>
  );
}

export function RoiView({ baseline }: { baseline: RoiBaseline }) {
  // Supuestos editables (arrancan con la línea base real / por defecto)
  const [trabajadores, setTrabajadores] = useState(Math.max(baseline.trabajadores, 100));
  const [docsPorTrabajador, setDocsPorTrabajador] = useState(6);
  const [renovacionesAnio, setRenovacionesAnio] = useState(2); // docs que vencen y se revalidan al año
  const [minManual, setMinManual] = useState(baseline.minutosPorValidacionManual);
  const [costoHora, setCostoHora] = useState(baseline.costoHoraCLP);

  const calc = useMemo(() => {
    // Validaciones anuales = onboarding (1 set por trabajador) + renovaciones
    const validacionesAnio = trabajadores * docsPorTrabajador + trabajadores * renovacionesAnio;
    const minutosManualAnio = validacionesAnio * minManual;
    const minutosDotiaAnio = (validacionesAnio * baseline.segundosPorValidacionDotia) / 60;
    const horasManual = minutosManualAnio / 60;
    const horasDotia = minutosDotiaAnio / 60;
    const horasAhorradas = horasManual - horasDotia;
    const costoManual = horasManual * costoHora;
    const costoDotia = horasDotia * costoHora;
    const ahorroCLP = costoManual - costoDotia;
    const reduccionPct = horasManual > 0 ? (horasAhorradas / horasManual) * 100 : 0;
    return { validacionesAnio, horasManual, horasDotia, horasAhorradas, costoManual, costoDotia, ahorroCLP, reduccionPct };
  }, [trabajadores, docsPorTrabajador, renovacionesAnio, minManual, costoHora, baseline.segundosPorValidacionDotia]);

  // Ahorro real ya generado (datos verdaderos del sistema)
  const ahorroRealHoras = (baseline.validacionesRealizadas * baseline.minutosPorValidacionManual) / 60;
  const ahorroRealCLP = ahorroRealHoras * baseline.costoHoraCLP;

  function reset() {
    setTrabajadores(Math.max(baseline.trabajadores, 100));
    setDocsPorTrabajador(6);
    setRenovacionesAnio(2);
    setMinManual(baseline.minutosPorValidacionManual);
    setCostoHora(baseline.costoHoraCLP);
  }

  return (
    <>
      {/* Hero */}
      <div className="hero-aurora bg-dotgrid border-b bg-background/60">
        <div className="max-w-5xl mx-auto px-6 pt-10 pb-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1 mb-4 shadow-sm"
          >
            <Calculator className="w-3 h-3 text-violet-500" />
            <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">Retorno de inversión</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}
            className="text-4xl font-black tracking-tight text-gradient"
          >
            Cuánto ahorras con Dotia
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }}
            className="text-sm text-muted-foreground mt-1"
          >
            Ajusta los supuestos con tus números reales — el cálculo se actualiza al instante
          </motion.p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Resultado destacado */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-violet-100/40 to-indigo-50 p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-400/10 rounded-full blur-3xl" />
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-1">Ahorro anual estimado</p>
              <p className="text-5xl font-black text-violet-800 tabular-nums leading-none">{fmtCLP(calc.ahorroCLP)}</p>
              <p className="text-sm text-violet-700 mt-2 font-semibold">
                {fmtNum(calc.horasAhorradas)} horas-hombre al año
              </p>
            </div>
            <div className="md:border-l md:border-violet-200 md:pl-6">
              <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-1">Reducción de tiempo</p>
              <p className="text-5xl font-black text-violet-800 tabular-nums leading-none">{Math.round(calc.reduccionPct)}%</p>
              <p className="text-sm text-violet-700 mt-2 font-semibold">
                {fmtNum(calc.validacionesAnio)} validaciones al año
              </p>
            </div>
            <div className="md:border-l md:border-violet-200 md:pl-6">
              <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-1">Ya ahorrado (real)</p>
              <p className="text-5xl font-black text-violet-800 tabular-nums leading-none">{fmtNum(ahorroRealHoras)}<span className="text-2xl">h</span></p>
              <p className="text-sm text-violet-700 mt-2 font-semibold">
                {baseline.validacionesRealizadas} validaciones · ≈ {fmtCLP(ahorroRealCLP)}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Supuestos editables */}
          <div className="card-premium rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-500" /> Tus números
              </p>
              <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <RotateCcw className="w-3 h-3" /> Reiniciar
              </button>
            </div>
            <Assumption label="Trabajadores en dotación" value={trabajadores} onChange={setTrabajadores} step={50} min={1} />
            <Assumption label="Documentos por trabajador" value={docsPorTrabajador} onChange={setDocsPorTrabajador} suffix="docs" min={1} />
            <Assumption label="Renovaciones al año" value={renovacionesAnio} onChange={setRenovacionesAnio} suffix="/ año" min={0} />
            <Assumption label="Minutos por validación manual" value={minManual} onChange={setMinManual} suffix="min" min={1} />
            <Assumption label="Costo hora del analista" value={costoHora} onChange={setCostoHora} suffix="CLP" step={500} min={0} />
          </div>

          {/* Comparación manual vs Dotia */}
          <div className="card-premium rounded-2xl p-6">
            <p className="font-bold text-foreground flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-violet-500" /> Manual vs Dotia (al año)
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm flex items-center gap-1.5 text-muted-foreground"><Clock className="w-3.5 h-3.5" /> Proceso manual</span>
                  <span className="text-sm font-bold tabular-nums">{fmtNum(calc.horasManual)} h · {fmtCLP(calc.costoManual)}</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: "100%" }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm flex items-center gap-1.5 text-violet-700 font-semibold"><Zap className="w-3.5 h-3.5" /> Con Dotia</span>
                  <span className="text-sm font-bold tabular-nums text-violet-700">{fmtNum(calc.horasDotia)} h · {fmtCLP(calc.costoDotia)}</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                    animate={{ width: `${Math.max(100 - calc.reduccionPct, 1)}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
              </div>

              <div className="pt-3 mt-3 border-t flex items-center justify-between">
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-500" /> Ahorro
                </span>
                <span className="text-lg font-black text-violet-800 tabular-nums">{fmtCLP(calc.ahorroCLP)}/año</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Cálculo referencial basado en los supuestos ingresados. La validación automática de Dotia
          (extracción con IA + verificación en Registro Civil) toma ≈{baseline.segundosPorValidacionDotia} segundos por documento.
        </p>
      </div>
    </>
  );
}
