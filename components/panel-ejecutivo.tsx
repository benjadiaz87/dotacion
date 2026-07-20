"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CountUp } from "@/components/motion-primitives";
import { AlertOctagon, ShieldAlert, Sparkles, ArrowRight, TrendingUp } from "lucide-react";
import type { EjecutivoStats } from "@/lib/actions/ejecutivo";

function fmtCLP(n: number): string {
  return "$" + n.toLocaleString("es-CL");
}

// Panel ejecutivo: los 3 números que le importan a quien decide la compra —
// riesgo de parar la faena, exposición a multas, y ahorro generado por la IA.
export function PanelEjecutivo({ stats }: { stats: EjecutivoStats }) {
  const { riesgo, cumplimiento, ahorro } = stats;

  const cards = [
    {
      key: "riesgo",
      href: "/dashboard/alertas",
      icon: AlertOctagon,
      value: riesgo.cargosSinRelevo,
      label: "Riesgo de paro de faena",
      sub:
        riesgo.cargosSinRelevo > 0
          ? `${riesgo.cargosSinRelevo} cupo${riesgo.cargosSinRelevo !== 1 ? "s" : ""} sin habilitado en las próximas ${riesgo.semanasHorizonte} semanas · ${riesgo.proyectosAfectados} proyecto${riesgo.proyectosAfectados !== 1 ? "s" : ""}`
          : "Todos los cupos cubiertos en el horizonte cercano",
      tone:
        riesgo.cargosSinRelevo > 0
          ? { ring: "border-red-200", bg: "from-red-50 to-red-100/40", chip: "bg-red-500", text: "text-red-700", num: "text-red-800" }
          : { ring: "border-emerald-200", bg: "from-emerald-50 to-emerald-100/40", chip: "bg-emerald-500", text: "text-emerald-700", num: "text-emerald-800" },
    },
    {
      key: "cumplimiento",
      href: "/dashboard/alertas",
      icon: ShieldAlert,
      value: cumplimiento.vencidos + cumplimiento.porVencer,
      label: "Exposición a multas",
      sub:
        cumplimiento.vencidos + cumplimiento.porVencer > 0
          ? `${cumplimiento.vencidos} vencido${cumplimiento.vencidos !== 1 ? "s" : ""} · ${cumplimiento.porVencer} por vencer (30 días) · ${cumplimiento.trabajadoresAfectados} trabajador${cumplimiento.trabajadoresAfectados !== 1 ? "es" : ""}`
          : "Sin documentos vencidos ni por vencer",
      tone:
        cumplimiento.vencidos > 0
          ? { ring: "border-red-200", bg: "from-red-50 to-red-100/40", chip: "bg-red-500", text: "text-red-700", num: "text-red-800" }
          : cumplimiento.porVencer > 0
          ? { ring: "border-amber-200", bg: "from-amber-50 to-amber-100/40", chip: "bg-amber-500", text: "text-amber-700", num: "text-amber-800" }
          : { ring: "border-emerald-200", bg: "from-emerald-50 to-emerald-100/40", chip: "bg-emerald-500", text: "text-emerald-700", num: "text-emerald-800" },
    },
    {
      key: "ahorro",
      href: "/dashboard/empleados",
      icon: Sparkles,
      value: ahorro.horasAhorradas,
      label: "Ahorro con Validación Inteligente Dotia",
      isHours: true,
      sub: `${ahorro.validaciones} validación${ahorro.validaciones !== 1 ? "es" : ""} automática${ahorro.validaciones !== 1 ? "s" : ""} · ≈ ${fmtCLP(ahorro.montoCLP)} en horas-hombre`,
      tone: { ring: "border-violet-200", bg: "from-violet-50 to-violet-100/40", chip: "bg-violet-500", text: "text-violet-700", num: "text-violet-800" },
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-bold text-foreground">Panel ejecutivo</h2>
        <span className="text-xs text-muted-foreground">— lo que hay que vigilar hoy</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Link href={c.href}>
                <div className={`rounded-2xl border ${c.tone.ring} bg-gradient-to-br ${c.tone.bg} p-5 h-full transition-all hover:shadow-md cursor-pointer group`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${c.tone.chip} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <ArrowRight className={`w-4 h-4 ${c.tone.text} opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all`} />
                  </div>
                  <p className={`text-4xl font-black ${c.tone.num} leading-none tabular-nums`}>
                    <CountUp value={c.value} />
                    {c.isHours && <span className="text-xl font-bold ml-1">h</span>}
                  </p>
                  <p className={`text-sm font-bold ${c.tone.text} mt-2`}>{c.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{c.sub}</p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
