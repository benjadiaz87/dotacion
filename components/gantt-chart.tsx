"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";
import { formatWeekRange } from "@/lib/project-utils";
import { DotacionSparkline } from "@/components/dotacion-sparkline";

type RoleReq = {
  id: string;
  quantity: number;
  role: { id: string; name: string; color: string; category: string };
};

type WeekPlan = {
  id: string;
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  requirements: RoleReq[];
};

interface Props {
  weekPlans: WeekPlan[];
  startDate: Date;
}

const categoryOrder: Record<string, number> = {
  SUPERVISION: 0,
  TECNICO: 1,
  OPERATIVO: 2,
  ADMINISTRATIVO: 3,
};

const categoryLabel: Record<string, string> = {
  SUPERVISION: "Supervisión",
  TECNICO: "Técnico",
  OPERATIVO: "Operativo",
  ADMINISTRATIVO: "Administrativo",
};

type Selection = { type: "week"; weekNumber: number } | { type: "role"; roleId: string } | null;

export function GanttChart({ weekPlans }: Props) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection>(null);

  // Collect all unique roles across all weeks
  const roleMap = new Map<string, { name: string; color: string; category: string }>();
  for (const wp of weekPlans) {
    for (const req of wp.requirements) {
      roleMap.set(req.role.id, {
        name: req.role.name,
        color: req.role.color,
        category: req.role.category,
      });
    }
  }

  const allRoles = Array.from(roleMap.entries())
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9) || a.name.localeCompare(b.name));

  // Max headcount across weeks (for bar scaling)
  const maxHeadcount = Math.max(
    ...weekPlans.map((wp) => wp.requirements.reduce((s, r) => s + r.quantity, 0)),
    1
  );

  const selectedWeekNumber = selection?.type === "week" ? selection.weekNumber : null;
  const selectedRoleId = selection?.type === "role" ? selection.roleId : null;

  const selectedPlan = selectedWeekNumber !== null ? weekPlans.find((w) => w.weekNumber === selectedWeekNumber) : null;
  const selectedRole = selectedRoleId ? allRoles.find((r) => r.id === selectedRoleId) : null;

  function toggleWeek(weekNumber: number) {
    setSelection((prev) =>
      prev?.type === "week" && prev.weekNumber === weekNumber ? null : { type: "week", weekNumber }
    );
  }

  function toggleRole(roleId: string) {
    setSelection((prev) => (prev?.type === "role" && prev.roleId === roleId ? null : { type: "role", roleId }));
  }

  // Datos del cargo seleccionado a través de todas las semanas
  const roleWeeklyData = selectedRoleId
    ? [...weekPlans]
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map((wp) => ({
          weekNumber: wp.weekNumber,
          total: wp.requirements.find((r) => r.role.id === selectedRoleId)?.quantity ?? 0,
        }))
    : [];
  const roleTotal = roleWeeklyData.reduce((s, w) => s + w.total, 0);
  const roleMaxWeek = roleWeeklyData.length
    ? roleWeeklyData.reduce((a, b) => (b.total > a.total ? b : a))
    : null;
  const roleWeeksActive = roleWeeklyData.filter((w) => w.total > 0).length;

  return (
    <div className="space-y-4">
      {/* Gantt grid */}
      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(weekPlans.length * 96 + 180, 600) }}>
            {/* Header row */}
            <div className="flex border-b bg-muted/30">
              <div className="w-44 flex-shrink-0 px-4 py-3 border-r">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cargo</span>
              </div>
              {weekPlans.map((wp) => {
                const isSelected = selectedWeekNumber === wp.weekNumber;
                const isHovered = hoveredWeek === wp.weekNumber;
                const weekTotal = wp.requirements.reduce((s, r) => s + r.quantity, 0);
                return (
                  <button
                    key={wp.id}
                    className={`flex-1 min-w-[88px] px-2 py-3 text-center border-r last:border-r-0 transition-colors cursor-pointer ${
                      isSelected ? "bg-primary/10" : isHovered ? "bg-muted/60" : ""
                    }`}
                    onMouseEnter={() => setHoveredWeek(wp.weekNumber)}
                    onMouseLeave={() => setHoveredWeek(null)}
                    onClick={() => toggleWeek(wp.weekNumber)}
                  >
                    <p className="text-xs font-bold text-foreground">S{wp.weekNumber}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatWeekRange(wp.startDate, wp.endDate)}
                    </p>
                    <div className="mt-1.5 flex items-center justify-center gap-1">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-foreground">{weekTotal}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Headcount bar row */}
            <div className="flex border-b bg-background">
              <div className="w-44 flex-shrink-0 px-4 py-2 border-r flex items-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dotación total</span>
              </div>
              {weekPlans.map((wp) => {
                const total = wp.requirements.reduce((s, r) => s + r.quantity, 0);
                const pct = (total / maxHeadcount) * 100;
                const isSelected = selectedWeekNumber === wp.weekNumber;
                return (
                  <div
                    key={wp.id}
                    className={`flex-1 min-w-[88px] px-2 py-2 border-r last:border-r-0 flex flex-col gap-1 ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <div className="h-5 bg-muted rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          background: isSelected ? "var(--color-primary)" : "#3b82f6",
                          opacity: isSelected ? 1 : 0.7,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-center font-medium text-foreground">{total}</p>
                  </div>
                );
              })}
            </div>

            {/* Role rows */}
            {allRoles.map((role, idx) => {
              const prevRole = allRoles[idx - 1];
              const showCategoryDivider = !prevRole || prevRole.category !== role.category;
              const isRoleSelected = selectedRoleId === role.id;
              return (
                <div key={role.id}>
                  {showCategoryDivider && (
                    <div className="flex border-b bg-muted/20">
                      <div className="w-44 flex-shrink-0 px-4 py-1 border-r">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          {categoryLabel[role.category]}
                        </span>
                      </div>
                      {weekPlans.map((wp) => (
                        <div
                          key={wp.id}
                          className={`flex-1 min-w-[88px] border-r last:border-r-0 ${selectedWeekNumber === wp.weekNumber ? "bg-primary/5" : ""}`}
                        />
                      ))}
                    </div>
                  )}
                  <div
                    className={`flex border-b last:border-b-0 transition-colors group ${
                      isRoleSelected ? "bg-primary/5" : "hover:bg-muted/20"
                    }`}
                  >
                    <button
                      onClick={() => toggleRole(role.id)}
                      className={`w-44 flex-shrink-0 px-4 py-2.5 border-r flex items-center gap-2 text-left cursor-pointer transition-colors ${
                        isRoleSelected ? "bg-primary/10" : "hover:bg-muted/40"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: role.color }}
                      />
                      <span className={`text-sm truncate ${isRoleSelected ? "font-semibold text-foreground" : "text-foreground"}`}>
                        {role.name}
                      </span>
                    </button>
                    {weekPlans.map((wp) => {
                      const req = wp.requirements.find((r) => r.role.id === role.id);
                      const qty = req?.quantity ?? 0;
                      const isWeekSelected = selectedWeekNumber === wp.weekNumber;
                      return (
                        <div
                          key={wp.id}
                          className={`flex-1 min-w-[88px] px-2 py-2.5 border-r last:border-r-0 flex items-center justify-center ${isWeekSelected ? "bg-primary/5" : ""}`}
                        >
                          {qty > 0 ? (
                            <div
                              className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                              style={{ background: role.color, opacity: isRoleSelected ? 1 : 0.85 }}
                            >
                              {qty}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Week detail panel */}
      {selectedPlan && (
        <Card className="border">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">
                  Semana {selectedPlan.weekNumber} — Detalle
                </h3>
                <p className="text-sm text-muted-foreground">
                  {formatWeekRange(selectedPlan.startDate, selectedPlan.endDate)}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {selectedPlan.requirements.reduce((s, r) => s + r.quantity, 0)} personas
              </Badge>
            </div>

            {selectedPlan.requirements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin dotación asignada para esta semana.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(
                  selectedPlan.requirements.reduce<Record<string, RoleReq[]>>((acc, req) => {
                    (acc[req.role.category] ||= []).push(req);
                    return acc;
                  }, {})
                )
                  .sort(([a], [b]) => (categoryOrder[a] ?? 9) - (categoryOrder[b] ?? 9))
                  .map(([cat, reqs]) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {categoryLabel[cat]}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {reqs.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center gap-2 p-2.5 rounded-lg border bg-background"
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: req.role.color }}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{req.role.name}</p>
                              <p className="text-sm font-bold" style={{ color: req.role.color }}>
                                {req.quantity} pers.
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Role detail panel */}
      {selectedRole && (
        <Card className="border">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: selectedRole.color }}
                />
                <div>
                  <h3 className="font-semibold">{selectedRole.name} — Detalle del cargo</h3>
                  <p className="text-sm text-muted-foreground">
                    {categoryLabel[selectedRole.category]} · activo en {roleWeeksActive} de {weekPlans.length} semanas
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs" style={{ borderColor: selectedRole.color, color: selectedRole.color }}>
                {roleTotal.toLocaleString("es-CL")} personas-semana
              </Badge>
            </div>

            {/* Curva del cargo a lo largo del proyecto */}
            <div className="rounded-lg bg-muted/40 px-3 pt-3 pb-2 mb-4">
              <DotacionSparkline data={roleWeeklyData} height={64} color={selectedRole.color} />
              <div className="flex justify-between text-[10px] text-muted-foreground px-1 mt-1">
                <span>S1</span>
                {roleMaxWeek && roleMaxWeek.total > 0 && (
                  <span className="font-medium text-foreground">
                    Pico: {roleMaxWeek.total} personas en S{roleMaxWeek.weekNumber}
                  </span>
                )}
                <span>S{weekPlans.length}</span>
              </div>
            </div>

            {/* Tabla semana a semana */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {roleWeeklyData.map((w) => (
                <div
                  key={w.weekNumber}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${
                    w.total > 0 ? "bg-background" : "bg-muted/30 border-dashed"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground">S{w.weekNumber}</span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: w.total > 0 ? selectedRole.color : undefined }}
                  >
                    {w.total > 0 ? w.total : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {!selectedPlan && !selectedRole && (
        <p className="text-xs text-muted-foreground text-center">
          Haz clic en una semana o en un cargo para ver el detalle de dotación
        </p>
      )}
    </div>
  );
}
