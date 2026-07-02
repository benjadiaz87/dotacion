"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import type { ProyectoDetalle, ReportesData } from "@/lib/actions/reportes";

// ── Proyección de vacantes ──────────────────────────────────────────────────
export function ProyeccionChart({
  data,
  proyectos,
}: {
  data: ReportesData["proyeccionVacantes"];
  proyectos: ReportesData["proyectosActivos"];
}) {
  if (data.length === 0 || proyectos.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sin datos de proyección disponibles.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="weekNumber"
          tickFormatter={(v) => `S${v}`}
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
        <Tooltip
          formatter={(value, name) => [`${value} vacantes`, name]}
          labelFormatter={(v) => `Semana ${v}`}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {proyectos.map((p) => (
          <Line
            key={p.id}
            type="monotone"
            dataKey={p.name}
            stroke={p.color}
            strokeWidth={2}
            dot={{ r: 3, fill: p.color }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Cobertura por proyecto (barras) ─────────────────────────────────────────
export function CoberturaBarChart({ data }: { data: ReportesData["coberturaProyectos"] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sin proyectos activos.
      </div>
    );
  }
  const chartData = data.map((p) => ({
    name: p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name,
    fullName: p.name,
    Cubiertos: p.cubiertos,
    Vacantes: p.vacantes,
    total: p.totales,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }} barSize={24}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
        <Tooltip
          formatter={(value, name) => [`${value} personas`, name]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Cubiertos" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Vacantes" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Detalle semana a semana de un proyecto ──────────────────────────────────
export function ProyectoDetalleChart({ proyecto }: { proyecto: ProyectoDetalle }) {
  const now = Date.now();
  // We don't have dates here; use weekNumber as reference line if needed
  const data = proyecto.semanas.map((s) => ({
    semana: `S${s.weekNumber}`,
    Cubiertos: s.cubiertos,
    Vacantes: s.vacantes,
    total: s.totales,
    pct: s.totales > 0 ? Math.round((s.cubiertos / s.totales) * 100) : 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="semana" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
        <Tooltip
          formatter={(value, name) => [`${value} personas`, name]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Cubiertos" stackId="a" fill="#22c55e" />
        <Bar dataKey="Vacantes" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Semáforo documentación (donut-like bar) ─────────────────────────────────
export function SemaphoreBar({ stats }: { stats: ReportesData["semaphoreStats"] }) {
  const total = stats.total || 1;
  const pctGreen = (stats.green / total) * 100;
  const pctYellow = (stats.yellow / total) * 100;
  const pctRed = (stats.red / total) * 100;

  return (
    <div className="space-y-4">
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {pctGreen > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctGreen}%` }} />}
        {pctYellow > 0 && <div className="h-full bg-amber-400 transition-all" style={{ width: `${pctYellow}%` }} />}
        {pctRed > 0 && <div className="h-full bg-red-400 transition-all" style={{ width: `${pctRed}%` }} />}
        {total === 0 && <div className="h-full bg-muted w-full" />}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Habilitados", count: stats.green, pct: pctGreen, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
          { label: "Doc. parcial", count: stats.yellow, pct: pctYellow, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-400" },
          { label: "Sin documentos", count: stats.red, pct: pctRed, color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-400" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <p className={`text-xs font-medium ${s.color}`}>{s.label}</p>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className={`text-xs mt-0.5 opacity-70 ${s.color}`}>{Math.round(s.pct)}% del total</p>
          </div>
        ))}
      </div>
    </div>
  );
}
