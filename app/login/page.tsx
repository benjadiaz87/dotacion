"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Lock, Mail, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { BrandMark } from "@/components/brand-mark";
import { CountUp } from "@/components/motion-primitives";

const STATS = [
  { label: "Proyectos activos", value: 120, suffix: "+" },
  { label: "Empleados gestionados", value: 8500, suffix: "+" },
  { label: "Mineras usuarias", value: 15, suffix: "" },
];

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function doLogin(em: string, pw: string) {
    startTransition(async () => {
      const res = await signIn("credentials", { email: em, password: pw, redirect: false });
      if (res?.error) {
        toast.error("Credenciales inválidas. Verifica tu email y contraseña.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doLogin(email, password);
  }

  function handleDemo() {
    setEmail("admin@faenas.cl");
    setPassword("admin123");
    doLogin("admin@faenas.cl", "admin123");
  }

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 aurora-intense bg-noise relative overflow-hidden" style={{ background: "var(--sidebar)" }}>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 relative z-10"
        >
          <BrandMark size={40} className="drop-shadow-lg" />
          <span className="text-xl font-bold text-white">DotaciónFaenas</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative z-10"
        >
          {/* Comillas decorativas */}
          <span aria-hidden="true" className="block text-7xl font-black leading-none mb-2 text-gradient select-none" style={{ opacity: 0.95, filter: "brightness(1.8)" }}>
            "
          </span>
          <blockquote className="text-[1.7rem] font-medium leading-snug mb-6 max-w-md">
            <span className="text-white/70">La plataforma que transforma la gestión de dotación </span>
            <span className="text-white font-semibold">en faenas mineras y constructivas.</span>
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/40 to-indigo-500/40 ring-1 ring-white/20 flex items-center justify-center text-white font-bold text-sm">
              CF
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Carlos Fernández</p>
              <p className="text-xs text-white/60">Gerente RRHH, Minera Norte S.A.</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-3 gap-4 relative z-10">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="relative overflow-hidden rounded-xl p-4 backdrop-blur-md"
              style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <p
                className="text-2xl font-black"
                style={{
                  background: "linear-gradient(135deg, #a78bfa, #818cf8 55%, #7dd3fc)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                <CountUp value={s.value} suffix={s.suffix} duration={1.8} />
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Panel derecho - formulario */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background bg-dotgrid">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <BrandMark size={36} />
            <span className="text-lg font-bold">DotaciónFaenas</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Bienvenido de vuelta</h1>
            <p className="text-muted-foreground text-sm mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@faenas.cl"
                  className="pl-10 h-11 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 font-semibold shadow-lg shadow-primary/20" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar a la plataforma"
              )}
            </Button>

            {/* Acceso demo de un clic */}
            <button
              type="button"
              onClick={handleDemo}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Explorar con cuenta demo
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-8">
            ¿Olvidaste tu contraseña?{" "}
            <span className="text-primary cursor-pointer hover:underline">Contacta a soporte</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
