"use client";

import { useState, useTransition } from "react";
import { createProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronRight, Loader2, Minus, Plus, Trash2, Users } from "lucide-react";

type Role = { id: string; name: string; category: string; color: string };

interface Props {
  roles: Role[];
}

type WeekRoleEntry = { roleId: string; quantity: number };
type WeekData = { roles: WeekRoleEntry[] };

const categoryLabel: Record<string, string> = {
  OPERATIVO: "Operativo",
  TECNICO: "Técnico",
  ADMINISTRATIVO: "Administrativo",
  SUPERVISION: "Supervisión",
};

export function NewProjectForm({ roles }: Props) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [client, setClient] = useState("");
  const [startDate, setStartDate] = useState("");
  const [weeks, setWeeks] = useState(4);

  const [weekData, setWeekData] = useState<WeekData[]>(() =>
    Array.from({ length: 4 }, () => ({ roles: [] }))
  );

  function handleWeeksChange(val: number) {
    const n = Math.max(1, Math.min(104, val));
    setWeeks(n);
    setWeekData((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ roles: [] });
      return next.slice(0, n);
    });
  }

  function addRoleToWeek(weekIdx: number, roleId: string) {
    setWeekData((prev) => {
      const next = prev.map((w, i) => (i === weekIdx ? { ...w, roles: [...w.roles] } : w));
      if (!next[weekIdx].roles.find((r) => r.roleId === roleId)) {
        next[weekIdx].roles.push({ roleId, quantity: 1 });
      }
      return next;
    });
  }

  function updateQty(weekIdx: number, roleId: string, delta: number) {
    setWeekData((prev) =>
      prev.map((w, i) => {
        if (i !== weekIdx) return w;
        return {
          ...w,
          roles: w.roles
            .map((r) =>
              r.roleId === roleId ? { ...r, quantity: Math.max(0, r.quantity + delta) } : r
            )
            .filter((r) => r.quantity > 0),
        };
      })
    );
  }

  function removeRole(weekIdx: number, roleId: string) {
    setWeekData((prev) =>
      prev.map((w, i) =>
        i !== weekIdx ? w : { ...w, roles: w.roles.filter((r) => r.roleId !== roleId) }
      )
    );
  }

  function copyFromPreviousWeek(weekIdx: number) {
    if (weekIdx === 0) return;
    setWeekData((prev) =>
      prev.map((w, i) =>
        i !== weekIdx ? w : { roles: prev[weekIdx - 1].roles.map((r) => ({ ...r })) }
      )
    );
  }

  function handleSubmit() {
    if (!name || !startDate) {
      toast.error("Completa el nombre y la fecha de inicio");
      return;
    }

    startTransition(async () => {
      try {
        await createProject(
          { name, description, location, client, startDate, weeks },
          weekData.map((wd, i) => ({ weekNumber: i + 1, roles: wd.roles }))
        );
      } catch (e: unknown) {
        if (e instanceof Error && e.message !== "NEXT_REDIRECT") {
          toast.error("Error al crear el proyecto");
        }
      }
    });
  }

  const rolesByCategory = roles.reduce<Record<string, Role[]>>((acc, r) => {
    (acc[r.category] ||= []).push(r);
    return acc;
  }, {});

  const totalHeadcount = weekData.reduce(
    (sum, w) => sum + w.roles.reduce((s, r) => s + r.quantity, 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setStep(1)}
          className={`flex items-center gap-1.5 font-medium transition-colors ${step === 1 ? "text-primary" : "text-muted-foreground"}`}
        >
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
            1
          </span>
          Datos del proyecto
        </button>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <button
          onClick={() => { if (name && startDate) setStep(2); }}
          className={`flex items-center gap-1.5 font-medium transition-colors ${step === 2 ? "text-primary" : "text-muted-foreground"}`}
        >
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
            2
          </span>
          Dotación por semana
        </button>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información del proyecto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Nombre del proyecto *</Label>
                <Input
                  placeholder="Ej: Proyecto Minero Atacama Norte"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cliente / Empresa</Label>
                <Input
                  placeholder="Ej: Minera Norte S.A."
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ubicación / Faena</Label>
                <Input
                  placeholder="Ej: Atacama, Chile"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de inicio *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duración (semanas) *</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => handleWeeksChange(weeks - 1)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={104}
                    value={weeks}
                    onChange={(e) => handleWeeksChange(parseInt(e.target.value) || 1)}
                    className="text-center w-20"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => handleWeeksChange(weeks + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">semanas</span>
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Descripción</Label>
                <Textarea
                  placeholder="Descripción del proyecto, objetivos, alcance..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => {
                  if (!name || !startDate) {
                    toast.error("Completa el nombre y la fecha de inicio");
                    return;
                  }
                  setStep(2);
                }}
                className="gap-2"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm">
            <span className="text-muted-foreground">
              <strong className="text-foreground">{name}</strong> · {weeks} semanas · inicio {startDate}
            </span>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{totalHeadcount.toLocaleString("es-CL")} personas totales</span>
            </div>
          </div>

          {weekData.map((wd, weekIdx) => (
            <Card key={weekIdx} className="border">
              <CardHeader className="pb-3 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">Semana {weekIdx + 1}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {wd.roles.reduce((s, r) => s + r.quantity, 0)} personas requeridas
                    </p>
                  </div>
                  {weekIdx > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-7"
                      onClick={() => copyFromPreviousWeek(weekIdx)}
                    >
                      Copiar semana anterior
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                {/* Roles actuales */}
                {wd.roles.length > 0 && (
                  <div className="space-y-2">
                    {wd.roles.map((r) => {
                      const role = roles.find((ro) => ro.id === r.roleId);
                      if (!role) return null;
                      return (
                        <div key={r.roleId} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: role.color }}
                          />
                          <span className="text-sm flex-1 font-medium">{role.name}</span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQty(weekIdx, r.roleId, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-semibold">{r.quantity}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQty(weekIdx, r.roleId, 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeRole(weekIdx, r.roleId)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Agregar cargo */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Agregar cargo:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(rolesByCategory).map(([cat, catRoles]) => (
                      <div key={cat} className="flex flex-wrap gap-1">
                        {catRoles
                          .filter((r) => !wd.roles.find((wr) => wr.roleId === r.id))
                          .map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => addRoleToWeek(weekIdx, r.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-background hover:bg-muted transition-colors"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: r.color }}
                              />
                              {r.name}
                              <Plus className="w-3 h-3 text-muted-foreground" />
                            </button>
                          ))}
                      </div>
                    ))}
                  </div>
                  {Object.values(rolesByCategory).flat().filter((r) => !wd.roles.find((wr) => wr.roleId === r.id)).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Todos los cargos agregados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Volver
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} className="gap-2">
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creando proyecto...
                </>
              ) : (
                "Crear proyecto"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
