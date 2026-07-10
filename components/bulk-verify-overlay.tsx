"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { verifyOneDocument } from "@/lib/actions/verificar-documento";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Check, X, Clock, ShieldCheck, Landmark, Brain, FileText,
} from "lucide-react";

export type BulkDoc = { documentId: string; name: string };

type RowState = "queued" | "extracting" | "verifying" | "ok" | "fail";
type RowResult = { state: RowState; message?: string };

const STATE_TEXT: Record<RowState, string> = {
  queued: "En cola",
  extracting: "Leyendo el documento con IA…",
  verifying: "Verificando en Registro Civil…",
  ok: "Verificado y aprobado",
  fail: "Requiere revisión",
};

function RowIcon({ state }: { state: RowState }) {
  if (state === "queued")
    return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Clock className="w-4 h-4 text-muted-foreground" /></div>;
  if (state === "extracting")
    return (
      <div className="relative w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-violet-400 border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        />
        <Brain className="w-4 h-4 text-violet-600" />
      </div>
    );
  if (state === "verifying")
    return (
      <div className="relative w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-blue-400 border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        />
        <Landmark className="w-4 h-4 text-blue-600" />
      </div>
    );
  if (state === "ok")
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"
      >
        <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} />
      </motion.div>
    );
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1, x: [0, -4, 4, -3, 3, 0] }}
      transition={{ scale: { type: "spring", stiffness: 500, damping: 18 }, x: { duration: 0.4 } }}
      className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"
    >
      <X className="w-4 h-4 text-red-500" strokeWidth={3} />
    </motion.div>
  );
}

export function BulkVerifyOverlay({ docs, onClose }: { docs: BulkDoc[]; onClose: () => void }) {
  const [rows, setRows] = useState<Record<string, RowResult>>(
    () => Object.fromEntries(docs.map((d) => [d.documentId, { state: "queued" as RowState }]))
  );
  const [finished, setFinished] = useState(false);
  const started = useRef(false);

  const doneCount = Object.values(rows).filter((r) => r.state === "ok" || r.state === "fail").length;
  const okCount = Object.values(rows).filter((r) => r.state === "ok").length;
  const failCount = Object.values(rows).filter((r) => r.state === "fail").length;
  const pct = docs.length === 0 ? 100 : Math.round((doneCount / docs.length) * 100);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      for (const doc of docs) {
        setRows((r) => ({ ...r, [doc.documentId]: { state: "extracting" } }));
        // La acción cubre extracción + verificación; alternamos el texto para
        // reflejar la fase esperada mientras esperamos la respuesta
        const phaseTimer = setTimeout(() => {
          setRows((r) =>
            r[doc.documentId]?.state === "extracting"
              ? { ...r, [doc.documentId]: { state: "verifying" } }
              : r
          );
        }, 3500);
        try {
          const result = await verifyOneDocument(doc.documentId);
          clearTimeout(phaseTimer);
          setRows((r) => ({
            ...r,
            [doc.documentId]: { state: result.valid ? "ok" : "fail", message: result.message },
          }));
        } catch (e) {
          clearTimeout(phaseTimer);
          setRows((r) => ({
            ...r,
            [doc.documentId]: { state: "fail", message: e instanceof Error ? e.message : "Error inesperado" },
          }));
        }
      }
      setFinished(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (finished && failCount === 0 && okCount > 0) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#7c3aed", "#8b5cf6", "#10b981", "#3b82f6"] });
    }
  }, [finished, failCount, okCount]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="w-full max-w-md rounded-3xl bg-background shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-600" />
            <motion.div
              className="absolute inset-0 opacity-30"
              style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5), transparent 55%)" }}
              animate={{ opacity: [0.2, 0.45, 0.2] }}
              transition={{ repeat: Infinity, duration: 3 }}
            />
            <div className="relative flex items-center gap-3.5">
              <div className="relative w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                {!finished && (
                  <>
                    <motion.span
                      className="absolute inset-0 rounded-2xl border border-white/40"
                      animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
                      transition={{ repeat: Infinity, duration: 1.6 }}
                    />
                    <motion.span
                      className="absolute inset-0 rounded-2xl border border-white/40"
                      animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
                      transition={{ repeat: Infinity, duration: 1.6, delay: 0.8 }}
                    />
                  </>
                )}
                {finished
                  ? <ShieldCheck className="w-6 h-6 text-white" />
                  : <Sparkles className="w-6 h-6 text-white" />}
              </div>
              <div>
                <p className="text-white font-black text-lg leading-tight">
                  {finished ? "Validación completada" : "Validación inteligente"}
                </p>
                <p className="text-white/75 text-xs mt-0.5">
                  {finished
                    ? `${okCount} aprobado${okCount !== 1 ? "s" : ""}${failCount > 0 ? ` · ${failCount} por revisar` : ""}`
                    : `Verificando ${docs.length} documento${docs.length !== 1 ? "s" : ""} con IA + Registro Civil`}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="relative mt-5">
              <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-white"
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              <p className="text-right text-[10px] font-bold text-white/80 mt-1.5">{doneCount}/{docs.length}</p>
            </div>
          </div>

          {/* Rows */}
          <div className="px-4 py-4 space-y-1.5 max-h-[45vh] overflow-y-auto">
            {docs.map((doc) => {
              const row = rows[doc.documentId];
              const active = row.state === "extracting" || row.state === "verifying";
              return (
                <motion.div
                  key={doc.documentId}
                  layout
                  className={`relative flex items-center gap-3 rounded-xl px-3.5 py-3 border transition-colors overflow-hidden ${
                    active ? "border-violet-300 bg-violet-50/60" :
                    row.state === "ok" ? "border-emerald-200 bg-emerald-50/40" :
                    row.state === "fail" ? "border-red-200 bg-red-50/40" :
                    "border-border bg-muted/30"
                  }`}
                >
                  {active && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: "linear-gradient(105deg, transparent 40%, rgba(139,92,246,0.12) 50%, transparent 60%)" }}
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
                    />
                  )}
                  <RowIcon state={row.state} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      {doc.name}
                    </p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={row.state + (row.message ?? "")}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className={`text-[11px] mt-0.5 font-medium truncate ${
                          row.state === "ok" ? "text-emerald-600" :
                          row.state === "fail" ? "text-red-600" :
                          active ? "text-violet-600" : "text-muted-foreground"
                        }`}
                        title={row.message}
                      >
                        {row.state === "fail" && row.message ? row.message : STATE_TEXT[row.state]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 pb-4">
            <Button onClick={onClose} disabled={!finished} className="w-full h-10 font-semibold" variant={finished ? "default" : "outline"}>
              {finished ? "Cerrar" : "Validando…"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
