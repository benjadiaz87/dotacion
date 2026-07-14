"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { CalendarIcon, Users, X } from "lucide-react";
import { formatWeekRange } from "@/lib/project-utils";
import { DotacionSparkline } from "@/components/dotacion-sparkline";
import type { DateRange } from "react-day-picker";

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
  const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Collect all unique roles across all weeks (sin filtrar — para poblar el selector)
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

  const allRolesUnfiltered = Array.from(roleMap.entries())
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9) || a.name.localeCompare(b.name));

  // ── Filtros ──
  const filteredWeekPlans = useMemo(() => {
    if (!dateRange?.from) return weekPlans;
    const from = dateRange.from;
    const to = dateRange.to ?? dateRange.from;
    return weekPlans.filter((wp) => wp.endDate >= from && wp.startDate <= to);
  }, [weekPlans, dateRange]);

  const allRoles = roleFilter.size === 0 ? allRolesUnfiltered : allRolesUnfiltered.filter((r) => roleFilter.has(r.id));

  function toggleRoleFilter(roleId: string) {
    setRoleFilter((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  const hasActiveFilters = roleFilter.size > 0 || !!dateRange?.from;

  function clearFilters() {
    setRoleFilter(new Set());
    setDateRange(undefined);
  }

  // Max headcount across semanas filtradas, considerando solo los cargos visibles
  const maxHeadcount = Math.max(
    ...filteredWeekPlans.map((wp) =>
      wp.requirements.filter((r) => allRoles.some((ar) => ar.id === r.role.id)).reduce((s, r) => s + r.quantity, 0)
    ),
    1
  );

  const selectedWeekNumber = selection?.type === "week" ? selection.weekNumber : null;
  const selectedRoleId = selection?.type === "role" ? selection.roleId : null;

  const selectedPlan = selectedWeekNumber !== null ? filteredWeekPlans.find((w) => w.weekNumber === selectedWeekNumber) : null;
  const selectedRole = selectedRoleId ? allRolesUnfiltered.find((r) => r.id === selectedRoleId) : null;

  function toggleWeek(weekNumber: number) {
    setSelection((prev) =>
      prev?.type === "week" && prev.weekNumber === weekNumber ? null : { type: "week", weekNumber }
    );
  }

  function toggleRole(roleId: string) {
    setSelection((prev) => (prev?.type === "role" && prev.roleId === roleId ? null : { type: "role", roleId }));
  }

  // Datos del cargo seleccionado a través de las semanas filtradas
  const roleWeeklyData = selectedRoleId
    ? [...filteredWeekPlans]
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
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">Filtrar por cargo:</span>
        {allRolesUnfiltered.map((role) => {
          const isActive = roleFilter.has(role.id);
          return (
            <button
              key={role.id}
              onClick={() => toggleRoleFilter(role.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                isActive ? "text-white border-transparent" : "bg-background hover:bg-muted border-input"
              }`}
              style={isActive ? { background: role.color } : undefined}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: isActive ? "white" : role.color }}
              />
              {role.name}
            </button>
          );
        })}

        <span className="w-px h-5 bg-border mx-1" />

        <Popover>
          <PopoverTrigger
            className={buttonVariants({
              variant: dateRange?.from ? "default" : "outline",
              size: "sm",
              className: "gap-1.5",
            })}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            {dateRange?.from
              ? dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
                ? `${dateRange.from.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} – ${dateRange.to.toLocaleDateString("es-CL", { day: "numeric", month: "short" })}`
                : dateRange.from.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
              : "Filtrar por fecha"}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Gantt grid */}
      <Card className="border overflow-hidden">
        {filteredWeekPlans.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Ninguna semana coincide con el rango de fechas seleccionado.
          </div>
        ) : allRoles.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Ningún cargo coincide con el filtro seleccionado.
          </div>
        ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(filteredWeekPlans.length * 96 + 180, 600) }}>
            {/* Header row */}
            <div className="flex border-b bg-muted/30">
              <div className="w-44 flex-shrink-0 px-4 py-3 border-r">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cargo</span>
              </div>
              {filteredWeekPlans.map((wp) => {
                const isSelected = selectedWeekNumber === wp.weekNumber;
                const isHovered = hoveredWeek === wp.weekNumber;
                const weekTotal = wp.requirements
                  .filter((r) => allRoles.some((ar) => ar.id === r.role.id))
                  .reduce((s, r) => s + r.quantity, 0);
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
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatWeekRange(wp.startDate, wp.endDate)}
                    </p>
                    <div className="mt-1.5 flex items-center justify-center gap-1">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] font-semibold text-foreground">{weekTotal}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Headcount bar row */}
            <div className="flex border-b bg-background">
              <div className="w-44 flex-shrink-0 px-4 py-2 border-r flex items-center">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Dotación {hasActiveFilters ? "filtrada" : "total"}
                </span>
              </div>
              {filteredWeekPlans.map((wp) => {
                const total = wp.requirements
                  .filter((r) => allRoles.some((ar) => ar.id === r.role.id))
                  .reduce((s, r) => s + r.quantity, 0);
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
                    <p className="text-[11px] text-center font-medium text-foreground">{total}</p>
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
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                          {categoryLabel[role.category]}
                        </span>
                      </div>
                      {filteredWeekPlans.map((wp) => (
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
                    {filteredWeekPlans.map((wp) => {
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
        )}
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
                    {categoryLabel[selectedRole.category]} · activo en {roleWeeksActive} de {filteredWeekPlans.length} semanas
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs" style={{ borderColor: selectedRole.color, color: selectedRole.color }}>
                {roleTotal.toLocaleString("es-CL")} personas-semana
              </Badge>
            </div>

            {/* Curva del cargo a lo largo de las semanas filtradas */}
            <div className="rounded-lg bg-muted/40 px-3 pt-3 pb-2 mb-4">
              <DotacionSparkline data={roleWeeklyData} height={64} color={selectedRole.color} />
              <div className="flex justify-between text-[11px] text-muted-foreground px-1 mt-1">
                <span>{roleWeeklyData[0] ? `S${roleWeeklyData[0].weekNumber}` : ""}</span>
                {roleMaxWeek && roleMaxWeek.total > 0 && (
                  <span className="font-medium text-foreground">
                    Pico: {roleMaxWeek.total} personas en S{roleMaxWeek.weekNumber}
                  </span>
                )}
                <span>{roleWeeklyData.length ? `S${roleWeeklyData[roleWeeklyData.length - 1].weekNumber}` : ""}</span>
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
                  <span className="text-[11px] text-muted-foreground">S{w.weekNumber}</span>
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
