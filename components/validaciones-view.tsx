"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CountUp, Stagger, StaggerItem } from "@/components/motion-primitives";
import { Input } from "@/components/ui/input";
import { Sparkles, Check, X, Clock, Search, ArrowRight } from "lucide-react";
import type { ValidacionHistorial } from "@/lib/actions/ejecutivo";

const STATUS: Record<string, { label: string; icon: typeof Check; cls: string; dot: string }> = {
  APPROVED: { label: "Aprobado", icon: Check, cls: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "Rechazado", icon: X, cls: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500" },
  PENDING: { label: "En revisión", icon: Clock, cls: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
};

const ALL = "__all__";

export function ValidacionesView({ items }: { items: ValidacionHistorial[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);

  const counts = useMemo(() => ({
    total: items.length,
    aprobados: items.filter((i) => i.status === "APPROVED").length,
    revision: items.filter((i) => i.status === "PENDING").length,
    rechazados: items.filter((i) => i.status === "REJECTED").length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (statusFilter !== ALL && i.status !== statusFilter) return false;
      if (q && !i.workerName.toLowerCase().includes(q) && !i.workerRut.toLowerCase().includes(q) && !i.documentType.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, statusFilter]);

  return (
    <>
      {/* Hero */}
      <div className="hero-aurora bg-dotgrid border-b bg-background/60">
        <div className="max-w-5xl mx-auto px-6 pt-10 pb-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1 mb-4 shadow-sm"
          >
            <Sparkles className="w-3 h-3 text-violet-500" />
            <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">Verificación con IA + Registro Civil</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}
            className="text-4xl font-black tracking-tight text-gradient"
          >
            Validaciones Inteligentes Dotia
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }}
            className="text-sm text-muted-foreground mt-1"
          >
            Historial de documentos verificados automáticamente
          </motion.p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* KPIs clickeables */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { key: ALL, label: "Total validaciones", count: counts.total, cls: "bg-violet-50 border-violet-200 text-violet-700", bold: "text-violet-800", ring: "ring-violet-500" },
            { key: "APPROVED", label: "Aprobados", count: counts.aprobados, cls: "bg-emerald-50 border-emerald-200 text-emerald-700", bold: "text-emerald-800", ring: "ring-emerald-500" },
            { key: "PENDING", label: "En revisión", count: counts.revision, cls: "bg-amber-50 border-amber-200 text-amber-700", bold: "text-amber-800", ring: "ring-amber-500" },
            { key: "REJECTED", label: "Rechazados", count: counts.rechazados, cls: "bg-red-50 border-red-200 text-red-700", bold: "text-red-800", ring: "ring-red-500" },
          ].map((k) => (
            <button
              key={k.key}
              onClick={() => setStatusFilter(statusFilter === k.key ? ALL : k.key)}
              className={`rounded-xl border p-4 text-left transition-all ${k.cls} ${statusFilter === k.key ? `ring-2 ${k.ring}` : "hover:brightness-95"}`}
            >
              <p className="text-xs mb-1 font-medium">{k.label}</p>
              <p className={`text-2xl font-black tabular-nums ${k.bold}`}><CountUp value={k.count} /></p>
            </button>
          ))}
        </div>

        {/* Búsqueda */}
        <div className="relative max-w-sm mb-4">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por trabajador, RUT o documento…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-9" />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <Sparkles className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">
              {items.length === 0 ? "Aún no hay validaciones inteligentes" : "Ninguna validación coincide con el filtro"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {items.length === 0 ? "Al validar documentos con IA aparecerán aquí." : "Ajusta la búsqueda o el filtro."}
            </p>
          </div>
        ) : (
          <Stagger className="space-y-2">
            {filtered.map((v) => {
              const st = STATUS[v.status] ?? STATUS.PENDING;
              const Icon = st.icon;
              return (
                <StaggerItem key={v.id}>
                  <Link href={`/dashboard/trabajadores/${v.workerId}`}>
                    <div className="card-premium rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-all group cursor-pointer">
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${st.cls}`}>
                        <Icon className="w-4 h-4" strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{v.workerName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {v.documentType}{v.documentNumber ? ` · ${v.documentNumber}` : ""} · {v.workerRut}
                        </p>
                        {v.status === "REJECTED" && v.verifyNote && (
                          <p className="text-[11px] text-red-600 mt-0.5 truncate">{v.verifyNote}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                          {new Date(v.uploadedAt).toLocaleDateString("es-CL")}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </div>
    </>
  );
}
