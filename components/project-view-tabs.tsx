"use client";

import { useState } from "react";
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
  weeksData: WeekDotacion[];
  criticalForecast: CriticalForecast;
  projectProgress: number;
  weekPlans: WeekPlan[];
  startDate: Date;
  roles: Role[];
}

export function ProjectViewTabs({ weeksData, criticalForecast, projectProgress, weekPlans, startDate, roles }: Props) {
  const [view, setView] = useState<"dotacion" | "gantt">("dotacion");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center rounded-lg border bg-muted/40 p-1">
          <button
            onClick={() => setView("dotacion")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "dotacion" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Dotación
          </button>
          <button
            onClick={() => setView("gantt")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "gantt" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Carta Gantt
          </button>
        </div>

        <AssignWorkerDialog roles={roles} weekPlans={weekPlans.map((w) => ({ id: w.id, weekNumber: w.weekNumber }))} />
      </div>

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
    </div>
  );
}
