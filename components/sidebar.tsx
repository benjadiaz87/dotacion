"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import React from "react";
import {
  BadgeCheck,
  BarChart3,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Search as SearchIcon,
  Settings,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems: { href: string; label: string; icon: React.ElementType; disabled?: boolean; badge?: string; superadminOnly?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/proyectos", label: "Proyectos", icon: FolderKanban },
  { href: "/dashboard/empleados", label: "Empleados", icon: Users },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/dashboard/cargos", label: "Cargos", icon: BadgeCheck, superadminOnly: true },
  { href: "/dashboard/acceso", label: "Acceso", icon: KeyRound, superadminOnly: true },
];

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: string | null };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter(
    (item) => !item.superadminOnly || user.role === "SUPERADMIN"
  );

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "AD";

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-full" style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <BrandMark size={36} className="flex-shrink-0 drop-shadow-lg" />
        <div>
          <p className="text-sm font-bold leading-none" style={{ color: "var(--sidebar-foreground)" }}>
            Dotia
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Gestión de Dotación
          </p>
        </div>
      </div>

      {/* Búsqueda global */}
      <div className="px-3 pt-4">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          aria-label="Abrir búsqueda global"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-colors hover:bg-white/5"
          style={{ borderColor: "var(--sidebar-border)", color: "rgba(255,255,255,0.45)" }}
        >
          <SearchIcon className="w-3.5 h-3.5" />
          <span className="flex-1 text-left text-xs">Buscar…</span>
          <kbd className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-xs font-semibold px-3 mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>
          MENÚ PRINCIPAL
        </p>
        {visibleItems.map(({ href, label, icon: Icon, disabled, badge }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={disabled ? "#" : href}
              onClick={disabled ? (e) => e.preventDefault() : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group relative",
                active ? "text-white" : "hover:text-white hover:bg-white/5",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              style={active ? { color: "white" } : { color: "var(--sidebar-foreground)" }}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-lg"
                  style={{ background: "var(--sidebar-accent)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
                />
              )}
              <Icon className={cn("w-4 h-4 flex-shrink-0 relative z-10", active ? "text-primary" : "opacity-70 group-hover:opacity-100 transition-opacity")} />
              <span className="flex-1 relative z-10">{label}</span>
              {badge && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded relative z-10" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                  {badge}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId="sidebar-active-bar"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary z-10"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="text-xs font-bold bg-primary text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--sidebar-foreground)" }}>
                {user.name}
              </p>
              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                {user.email}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
            <DropdownMenuItem className="flex items-center gap-2">
              <Link href="/dashboard/configuracion" className="flex items-center gap-2 w-full">
                <Settings className="w-4 h-4" /> Configuración
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive flex items-center gap-2"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
