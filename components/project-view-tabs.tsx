"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DotacionView } from "@/components/dotacion-view";
import { GanttChart } from "@/components/gantt-chart";
import { AssignWorkerDialog } from "@/components/assign-worker-dialog";
import { LayoutGrid, Users } from "lucide-react";
import type { CriticalForecast, WeekDotacion } from "@/lib/actions/workers";

type Role = { id: string; name: string; color: string };
type WeekPlan = {
  id: string;
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  requirements: { id: string; quantity: number; role: { id: string; name: string; color: string; category: string } }[];
};

interface Props {
  canWrite?: boolean;
  weeksData: WeekDotacion[];
  criticalForecast: CriticalForecast;
  projectProgress: number;
  weekPlans: WeekPlan[];
  startDate: Date;
  roles: Role[];
}

const TABS = [
  { key: "dotacion" as const, label: "Dotación", icon: Users },
  { key: "gantt" as const, label: "Carta Gantt", icon: LayoutGrid },
];

export function ProjectViewTabs({ canWrite = true, weeksData, criticalForecast, projectProgress, weekPlans, startDate, roles }: Props) {
  const [view, setView] = useState<"dotacion" | "gantt">("dotacion");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center rounded-xl border bg-muted/40 p-1 shadow-sm">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {view === key && (
                <motion.span
                  layoutId="project-tab-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border/60"
                />
              )}
              <Icon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>

        {canWrite && <AssignWorkerDialog roles={roles} weekPlans={weekPlans.map((w) => ({ id: w.id, weekNumber: w.weekNumber }))} />}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {view === "dotacion" ? (
            <DotacionView
              weeksData={weeksData}
              projectProgress={projectProgress}
              criticalForecast={criticalForecast}
              roles={roles}
              weekPlans={weekPlans.map((w) => ({ id: w.id, weekNumber: w.weekNumber }))}
            />
          ) : (
            <GanttChart weekPlans={weekPlans} startDate={startDate} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
