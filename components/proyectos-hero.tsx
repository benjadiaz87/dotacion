"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/motion-primitives";
import { CoverageRing } from "@/components/brand-mark";
import { FolderKanban, Plus, Users } from "lucide-react";

export function ProyectosHero({
  total,
  activos,
  dotacionRequerida,
  dotacionCubierta,
  canWrite = true,
}: {
  total: number;
  activos: number;
  dotacionRequerida: number;
  dotacionCubierta: number;
  canWrite?: boolean;
}) {
  const covPct = dotacionRequerida > 0 ? Math.round((dotacionCubierta / dotacionRequerida) * 100) : 100;
  const covText = covPct >= 90 ? "text-emerald-700" : covPct >= 70 ? "text-amber-700" : "text-red-700";

  return (
    <div className="hero-aurora bg-dotgrid border-b bg-background/60">
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-8 relative">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1 mb-4 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-live" />
              <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                {activos} faena{activos !== 1 ? "s" : ""} en curso
              </span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="text-4xl font-black tracking-tight text-gradient"
            >
              Proyectos
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-sm text-muted-foreground mt-1"
            >
              {total} proyecto{total !== 1 ? "s" : ""} en total
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="flex items-center gap-4 flex-wrap"
          >
            {/* Cobertura global */}
            <div className="flex items-center gap-3 rounded-2xl border bg-background/80 backdrop-blur px-4 py-3 shadow-sm">
              <div className="relative flex-shrink-0">
                <CoverageRing pct={covPct} size={52} stroke={5} />
                <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-black ${covText}`}>
                  <CountUp value={covPct} suffix="%" />
                </span>
              </div>
              <div>
                <p className="text-lg font-black text-foreground leading-none">
                  <CountUp value={dotacionCubierta} /><span className="text-muted-foreground font-bold text-sm">/{dotacionRequerida}</span>
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Cobertura dotación</p>
              </div>
            </div>

            {canWrite && (
              <Link href="/dashboard/proyectos/nuevo">
                <Button className="gap-2 h-10 font-semibold shadow-lg shadow-primary/25">
                  <Plus className="w-4 h-4" /> Nuevo proyecto
                </Button>
              </Link>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
