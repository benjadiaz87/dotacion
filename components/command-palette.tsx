"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getGlobalSearchData, type GlobalSearchData } from "@/lib/actions/workers";
import { FolderKanban, Search, Trophy, User, CornerDownLeft } from "lucide-react";

type Item =
  | { kind: "worker"; id: string; title: string; subtitle: string; habilitado: boolean }
  | { kind: "project"; id: string; title: string; subtitle: string };

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<GlobalSearchData | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load data lazily on first open
  useEffect(() => {
    if (open && !data) {
      getGlobalSearchData().then(setData);
    }
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open, data]);

  const items = useMemo<Item[]>(() => {
    if (!data) return [];
    const q = normalize(query.trim());
    const workers: Item[] = data.workers
      .filter((w) => !q || normalize(w.fullName).includes(q) || normalize(w.rut).includes(q))
      .slice(0, 6)
      .map((w) => ({
        kind: "worker" as const,
        id: w.id,
        title: w.fullName,
        subtitle: `${w.rut} · ${w.stageName}`,
        habilitado: w.habilitado,
      }));
    const projects: Item[] = data.projects
      .filter((p) => !q || normalize(p.name).includes(q) || (p.client && normalize(p.client).includes(q)))
      .slice(0, 4)
      .map((p) => ({
        kind: "project" as const,
        id: p.id,
        title: p.name,
        subtitle: p.client ?? (p.status === "ACTIVE" ? "Activo" : "Cerrado"),
      }));
    return [...workers, ...projects];
  }, [data, query]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const go = useCallback((item: Item) => {
    setOpen(false);
    router.push(item.kind === "worker" ? `/dashboard/trabajadores/${item.id}` : `/dashboard/proyectos/${item.id}`);
  }, [router]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, items.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && items[activeIdx]) { e.preventDefault(); go(items[activeIdx]); }
  }

  const workerItems = items.filter((i) => i.kind === "worker");
  const projectItems = items.filter((i) => i.kind === "project");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[16vh] px-4"
          style={{ background: "oklch(0.13 0.028 264 / 0.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="w-full max-w-xl bg-background rounded-2xl border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 border-b">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Buscar trabajador por nombre o RUT, proyecto…"
                className="flex-1 h-13 py-4 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
                aria-label="Búsqueda global"
              />
              <kbd className="text-[10px] font-semibold text-muted-foreground bg-muted rounded px-1.5 py-0.5 flex-shrink-0">ESC</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
              {!data ? (
                <p className="text-xs text-muted-foreground text-center py-8">Cargando…</p>
              ) : items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sin resultados para "{query}"</p>
              ) : (
                <>
                  {workerItems.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pt-2 pb-1">Trabajadores</p>
                      {workerItems.map((item) => {
                        const idx = items.indexOf(item);
                        return (
                          <button
                            key={item.id}
                            onClick={() => go(item)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              idx === activeIdx ? "bg-muted" : ""
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              item.kind === "worker" && item.habilitado ? "bg-emerald-100" : "bg-muted"
                            }`}>
                              {item.kind === "worker" && item.habilitado
                                ? <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                                : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                            </div>
                            {idx === activeIdx && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </>
                  )}
                  {projectItems.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pt-3 pb-1">Proyectos</p>
                      {projectItems.map((item) => {
                        const idx = items.indexOf(item);
                        return (
                          <button
                            key={item.id}
                            onClick={() => go(item)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              idx === activeIdx ? "bg-muted" : ""
                            }`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FolderKanban className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                            </div>
                            {idx === activeIdx && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/40">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <kbd className="bg-background border rounded px-1 py-0.5 font-semibold">↑↓</kbd> navegar
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <kbd className="bg-background border rounded px-1 py-0.5 font-semibold">↵</kbd> abrir
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
