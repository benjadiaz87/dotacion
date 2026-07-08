"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stagger, StaggerItem, CountUp } from "@/components/motion-primitives";
import { createPlatformUser, type PlatformUser } from "@/lib/actions/users";
import type { AppRole } from "@/lib/authz";
import {
  Crown, Eye, EyeOff, KeyRound, Loader2, Plus, Shield, ShieldCheck, UserPlus, X,
} from "lucide-react";

const ROLE_CFG: Record<string, { label: string; desc: string; icon: React.ElementType; badge: string; tile: string }> = {
  SUPERADMIN: {
    label: "Superadmin",
    desc: "Todo + Cargos y Acceso",
    icon: Crown,
    badge: "bg-violet-50 border-violet-200 text-violet-700",
    tile: "from-violet-500 to-purple-600",
  },
  ADMIN: {
    label: "Admin",
    desc: "Gestión operativa completa",
    icon: Shield,
    badge: "bg-blue-50 border-blue-200 text-blue-700",
    tile: "from-blue-500 to-blue-600",
  },
  AUDITOR: {
    label: "Auditor",
    desc: "Solo lectura de toda la plataforma",
    icon: Eye,
    badge: "bg-slate-50 border-slate-200 text-slate-600",
    tile: "from-slate-400 to-slate-500",
  },
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ─── Crear usuario ────────────────────────────────────────────────────────────
function CreateUserForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<AppRole>("ADMIN");
  const [pending, start] = useTransition();

  function reset() {
    setName(""); setEmail(""); setPassword(""); setRole("ADMIN"); setShowPw(false);
  }

  function submit() {
    start(async () => {
      try {
        await createPlatformUser({ name: name.trim(), email: email.trim().toLowerCase(), password, role });
        toast.success(`${name.trim()} creado como ${ROLE_CFG[role].label}`);
        reset(); setOpen(false); onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al crear el usuario");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 py-5 text-muted-foreground hover:text-primary font-semibold text-sm"
      >
        <UserPlus className="w-4 h-4" /> Agregar usuario a la plataforma
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium rounded-2xl p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="font-bold text-foreground">Nuevo usuario</p>
        <button onClick={() => { setOpen(false); reset(); }} aria-label="Cerrar">
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nombre completo *</Label>
          <Input placeholder="María González" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>Email *</Label>
          <Input type="email" placeholder="maria@faenas.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Contraseña * <span className="text-muted-foreground font-normal">(mínimo 6 caracteres — comunícala por un canal seguro)</span></Label>
        <div className="relative">
          <Input
            type={showPw ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Selector de rol */}
      <div className="space-y-1.5">
        <Label>Rol de acceso *</Label>
        <div className="grid sm:grid-cols-3 gap-2">
          {(Object.keys(ROLE_CFG) as AppRole[]).map((r) => {
            const cfg = ROLE_CFG[r];
            const selected = role === r;
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  selected ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${cfg.tile} flex items-center justify-center`}>
                    <cfg.icon className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-foreground">{cfg.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{cfg.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <Button
        onClick={submit}
        disabled={pending || !name.trim() || !email.trim() || password.length < 6}
        className="w-full h-10 font-semibold gap-2"
      >
        {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</> : <><Plus className="w-4 h-4" /> Crear usuario</>}
      </Button>
    </motion.div>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export function AccesoView({ users }: { users: PlatformUser[] }) {
  const router = useRouter();

  return (
    <>
      {/* Hero */}
      <div className="hero-aurora bg-dotgrid border-b bg-background/60">
        <div className="max-w-5xl mx-auto px-6 pt-10 pb-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1 mb-4 shadow-sm"
          >
            <KeyRound className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
              Control de acceso a la plataforma
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="text-4xl font-black tracking-tight text-gradient"
          >
            Acceso
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className="text-sm text-muted-foreground mt-1"
          >
            <CountUp value={users.length} /> usuario{users.length !== 1 ? "s" : ""} con acceso · Superadmin, Admin y Auditor (solo lectura)
          </motion.p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <CreateUserForm onDone={() => router.refresh()} />

        {/* Lista de usuarios */}
        <Stagger className="space-y-2">
          {users.map((u) => {
            const cfg = ROLE_CFG[u.role] ?? ROLE_CFG.ADMIN;
            return (
              <StaggerItem key={u.id}>
                <div className="card-premium rounded-2xl flex items-center gap-4 px-5 py-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.tile} flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <span className="text-white font-black text-xs">{initials(u.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-foreground truncate">{u.name}</p>
                      {u.isSelf && (
                        <span className="text-[9px] font-bold uppercase tracking-widest bg-muted text-muted-foreground px-1.5 py-0.5 rounded">tú</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${cfg.badge}`}>
                    <cfg.icon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>

        {/* Leyenda de roles */}
        <div className="grid sm:grid-cols-3 gap-3">
          {(Object.keys(ROLE_CFG) as AppRole[]).map((r) => {
            const cfg = ROLE_CFG[r];
            return (
              <div key={r} className="rounded-xl border bg-background/60 px-4 py-3 flex items-start gap-2.5">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.tile} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <cfg.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">{cfg.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{cfg.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
