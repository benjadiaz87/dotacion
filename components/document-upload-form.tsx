"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { uploadWorkerDocument } from "@/lib/actions/workers";
import {
  extractCarnetFromImage, verifyCarnetInRC, type CarnetExtracted, type VerificationResult,
  extractAntecedentesFromPdf, verifyAntecedentesInRC, type AntecedentesExtracted, type AntecedentesVerificationResult,
  extractHojaVidaFromPdf, type HojaVidaExtracted,
  validateLicenciaDoc, type LicenciaValidationResult, type LicenciaExtracted,
} from "@/lib/actions/verificar-documento";
import { toast } from "sonner";
import {
  Check, Upload, ScanLine, ShieldCheck, ShieldAlert,
  User, Hash, Calendar, Flag, FileText, X, Brain, Bot, Landmark, Sparkles, Camera,
} from "lucide-react";

interface Props {
  workerId: string;
  documentTypeId: string;
  isCarnet?: boolean;
  isAntecedentes?: boolean;
  isLicencia?: boolean;
  isHojaVida?: boolean;
}

type Phase =
  | "idle"
  | "uploading"
  | "extracting"
  | "extracted"
  | "verifying"
  | "done_ok"
  | "done_fail"
  | "error";

const STEPS = [
  { key: "uploading",  label: "Subiendo" },
  { key: "extracting", label: "IA extrae datos" },
  { key: "verifying",  label: "Registro Civil" },
  { key: "done_ok",    label: "Completado" },
];

const PHASE_STEP: Record<Phase, number> = {
  idle: -1, uploading: 0, extracting: 1, extracted: 1, verifying: 2, done_ok: 3, done_fail: 3, error: -1,
};

const PHASE_MESSAGE_CARNET: Partial<Record<Phase, { title: string; subtitle: string }>> = {
  uploading:  { title: "Subiendo imagen…",              subtitle: "Guardando el archivo en el servidor" },
  extracting: { title: "IA leyendo el carnet…",         subtitle: "Claude Vision extrae RUT, nombre y número de serie" },
  verifying:  { title: "Consultando Registro Civil…",   subtitle: "Resolviendo CAPTCHA y verificando vigencia en el SRCeI" },
};

const PHASE_MESSAGE_ANTECEDENTES: Partial<Record<Phase, { title: string; subtitle: string }>> = {
  uploading:  { title: "Subiendo certificado…",         subtitle: "Guardando el PDF en el servidor" },
  extracting: { title: "IA leyendo el certificado…",    subtitle: "Claude extrae folio y código de verificación" },
  verifying:  { title: "Consultando Registro Civil…",   subtitle: "Verificando autenticidad del certificado en el SRCeI" },
};

const PHASE_MESSAGE_HOJA_VIDA: Partial<Record<Phase, { title: string; subtitle: string }>> = {
  uploading: { title: "Subiendo hoja de vida…", subtitle: "Guardando el PDF de forma segura" },
  extracting: { title: "Leyendo el certificado con IA…", subtitle: "Extrayendo folio, código de verificación y anotaciones" },
  verifying: { title: "Verificando en el Registro Civil…", subtitle: "Contrastando folio y código de verificación" },
};

const PHASE_MESSAGE_LICENCIA: Partial<Record<Phase, { title: string; subtitle: string }>> = {
  uploading:  { title: "Subiendo licencia…",            subtitle: "Guardando el archivo en el servidor" },
  extracting: { title: "IA leyendo la licencia…",       subtitle: "Claude extrae clase, vencimiento y RUT" },
  verifying:  { title: "Validando vigencia…",           subtitle: "Verificando fecha con extensión legal de 1 año" },
};

function StepIndicator({ phase, verifyLabel = "Registro Civil" }: { phase: Phase; verifyLabel?: string }) {
  if (phase === "idle" || phase === "error") return null;
  const steps = STEPS.map((s) => (s.key === "verifying" ? { ...s, label: verifyLabel } : s));
  const current = PHASE_STEP[phase];
  const done_all = phase === "done_ok";
  const failed = phase === "done_fail";

  return (
    <div className="flex items-start gap-0">
      {steps.map((s, i) => {
        const isDone = i < current || done_all;
        const isActive = i === current && !done_all && !failed;
        const isFail = failed && i === current;
        return (
          <div key={s.key} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center flex-shrink-0 w-10">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500
                ${isFail  ? "bg-red-100 ring-2 ring-red-400 text-red-600" :
                  isDone  ? "bg-emerald-500 text-white shadow-md shadow-emerald-200" :
                  isActive ? "bg-primary text-white shadow-md shadow-primary/30 ring-4 ring-primary/20" :
                  "bg-muted text-muted-foreground/50"}
              `}>
                {isFail  ? <X className="w-3.5 h-3.5" /> :
                 isDone  ? <Check className="w-3.5 h-3.5" /> :
                 isActive ? (
                   <span className="relative flex h-2.5 w-2.5">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                     <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                   </span>
                 ) : <span>{i + 1}</span>}
              </div>
              <span className={`text-[9px] mt-1.5 text-center leading-tight font-medium ${
                isActive ? "text-primary" : isDone ? "text-emerald-600" : "text-muted-foreground/60"
              }`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mt-4 mx-1">
                <div className={`h-0.5 w-full rounded-full transition-all duration-700 ${i < current || done_all ? "bg-emerald-400" : "bg-muted"}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const FIELD_META: { key: keyof CarnetExtracted; label: string; icon: React.ReactNode }[] = [
  { key: "fullName",       label: "Nombre completo",  icon: <User className="w-3.5 h-3.5" /> },
  { key: "rut",            label: "RUT",              icon: <Hash className="w-3.5 h-3.5" /> },
  { key: "documentNumber", label: "N° de serie",      icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "birthDate",      label: "Nacimiento",       icon: <Calendar className="w-3.5 h-3.5" /> },
  { key: "expiryDate",     label: "Vencimiento",      icon: <Calendar className="w-3.5 h-3.5" /> },
  { key: "nationality",    label: "Nacionalidad",     icon: <Flag className="w-3.5 h-3.5" /> },
];

function ExtractedCardAntecedentes({ data, dim }: { data: AntecedentesExtracted; dim?: boolean }) {
  return (
    <div className={`transition-all duration-500 ${dim ? "opacity-40 scale-[0.99]" : "opacity-100 scale-100"} space-y-2`}>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-violet-100 flex items-center justify-center">
          <Brain className="w-3 h-3 text-violet-600" />
        </div>
        <p className="text-xs font-semibold text-violet-700">Datos extraídos por Claude</p>
      </div>

      {/* Folio + código — los datos únicos del certificado */}
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500">Identificadores únicos del certificado</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-lg border border-violet-100 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-violet-400 mb-1">
              <Hash className="w-3 h-3" />
              <span className="text-[9px] uppercase tracking-widest font-semibold">Folio</span>
            </div>
            <p className="text-sm font-black font-mono text-foreground tracking-tight">{data.folio ?? "—"}</p>
          </div>
          <div className="bg-white rounded-lg border border-violet-100 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-violet-400 mb-1">
              <ShieldCheck className="w-3 h-3" />
              <span className="text-[9px] uppercase tracking-widest font-semibold">Código verificación</span>
            </div>
            <p className="text-sm font-black font-mono text-foreground tracking-tight">{data.codigoVerificacion ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Resto de datos */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: "Nombre",   value: data.fullName,      icon: <User className="w-3.5 h-3.5" /> },
          { label: "RUT",      value: data.rut,           icon: <Hash className="w-3.5 h-3.5" /> },
          { label: "Emisión",  value: data.fechaEmision,  icon: <Calendar className="w-3.5 h-3.5" /> },
          { label: "Tipo",     value: data.tipoFines,     icon: <FileText className="w-3.5 h-3.5" /> },
        ].filter(f => f.value).map(({ label, value, icon }) => (
          <div key={label} className="bg-white rounded-xl border border-border/60 px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              {icon}
              <span className="text-[9px] uppercase tracking-widest font-semibold">{label}</span>
            </div>
            <p className="text-sm font-bold font-mono text-foreground truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Sin/con antecedentes */}
      {data.sinAntecedentes !== null && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${
          data.sinAntecedentes
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {data.sinAntecedentes
            ? <><Check className="w-3.5 h-3.5" /> Registro: SIN ANTECEDENTES</>
            : <><X className="w-3.5 h-3.5" /> Registro: CON ANTECEDENTES</>}
        </div>
      )}
    </div>
  );
}

function ExtractedCard({ data, dim }: { data: CarnetExtracted; dim?: boolean }) {
  return (
    <div className={`transition-all duration-500 ${dim ? "opacity-40 scale-[0.99]" : "opacity-100 scale-100"}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-5 h-5 rounded-md bg-violet-100 flex items-center justify-center">
          <Brain className="w-3 h-3 text-violet-600" />
        </div>
        <p className="text-xs font-semibold text-violet-700">Datos extraídos por Claude Vision</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {FIELD_META.map(({ key, label, icon }) => {
          const value = data[key];
          if (!value) return null;
          return (
            <div key={key} className="bg-white rounded-xl border border-border/60 px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                {icon}
                <span className="text-[9px] uppercase tracking-widest font-semibold">{label}</span>
              </div>
              <p className="text-sm font-bold font-mono text-foreground truncate">{value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PROCESS_STEPS = (rut: string, serie: string, valid: boolean) => [
  {
    icon: <Brain className="w-4 h-4" />,
    color: "bg-violet-100 text-violet-600",
    label: "Claude Vision (Anthropic)",
    detail: "Analizó la imagen y extrajo RUT, nombre, N° de serie y fechas sin intervención manual.",
  },
  {
    icon: <Bot className="w-4 h-4" />,
    color: "bg-blue-100 text-blue-600",
    label: "Resolución automática de CAPTCHA",
    detail: "El sistema resolvió el desafío de seguridad del sitio oficial del Registro Civil.",
  },
  {
    icon: <Landmark className="w-4 h-4" />,
    color: "bg-amber-100 text-amber-700",
    label: "Consulta al SRCeI",
    detail: `Se verificó en tiempo real con RUT ${rut} y serie ${serie} en el sistema oficial del Estado.`,
  },
  valid ? {
    icon: <Sparkles className="w-4 h-4" />,
    color: "bg-emerald-100 text-emerald-600",
    label: "Aprobación automática",
    detail: "El documento fue aprobado en el sistema sin ninguna intervención manual.",
  } : {
    icon: <X className="w-4 h-4" />,
    color: "bg-red-100 text-red-600",
    label: "Revisión manual requerida",
    detail: "El documento no pudo ser validado automáticamente y requiere revisión.",
  },
];

function CameraCaptureModal({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // En contextos no seguros (http en red local) mediaDevices no existe
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("La cámara requiere una conexión segura (HTTPS). Usa el selector de archivos: en el teléfono también permite tomar una foto.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setReady(true);
      })
      .catch(() => setError("No se pudo acceder a la cámara. Revisa los permisos del navegador."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `captura-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-background overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold flex items-center gap-2"><Camera className="w-4 h-4 text-primary" /> Tomar foto del documento</p>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="relative aspect-[4/3] bg-black">
          {error ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80 px-8 text-center">{error}</p>
          ) : (
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          )}
        </div>
        <div className="p-4 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="button" className="flex-1 gap-2" disabled={!ready || !!error} onClick={capture}>
            <Camera className="w-4 h-4" /> Capturar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DocumentUploadForm({ workerId, documentTypeId, isCarnet, isAntecedentes, isLicencia, isHojaVida }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [extracted, setExtracted] = useState<CarnetExtracted | null>(null);
  const [extractedAnt, setExtractedAnt] = useState<AntecedentesExtracted | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verificationAnt, setVerificationAnt] = useState<AntecedentesVerificationResult | null>(null);
  const [verificationLic, setVerificationLic] = useState<LicenciaValidationResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // La cámara aplica solo a tipos que aceptan imágenes (los certificados RC son PDF)
  const acceptsImages = !(isAntecedentes || isHojaVida);

  function openCamera() {
    // En móviles la cámara nativa del sistema es más confiable que getUserMedia
    // (y funciona sin HTTPS); en desktop usamos el modal con vista previa.
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) captureInputRef.current?.click();
    else setCameraOpen(true);
  }

  function handleCameraCapture(captured: File) {
    // Inyecta la foto en el input del formulario para que viaje en el FormData
    const dt = new DataTransfer();
    dt.items.add(captured);
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    setCameraOpen(false);
    setFile(captured);
    setPhase("idle");
    setExtracted(null);
    setExtractedAnt(null);
    setVerification(null);
    setVerificationAnt(null);
    setVerificationLic(null);
  }

  const phaseMsg = isHojaVida ? PHASE_MESSAGE_HOJA_VIDA[phase] : isLicencia ? PHASE_MESSAGE_LICENCIA[phase] : isAntecedentes ? PHASE_MESSAGE_ANTECEDENTES[phase] : PHASE_MESSAGE_CARNET[phase];
  const isProcessing = ["uploading", "extracting", "verifying"].includes(phase);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setPhase("idle");
    setExtracted(null);
    setExtractedAnt(null);
    setVerification(null);
    setVerificationAnt(null);
    setVerificationLic(null);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        setPhase("uploading");
        const { documentId } = await uploadWorkerDocument(workerId, documentTypeId, formData);

        // ── Licencia de conducir ─────────────────────────────────────────────
        if (isLicencia) {
          setPhase("extracting");
          const result = await validateLicenciaDoc(documentId);
          setVerificationLic(result);
          setPhase(result.valid ? "done_ok" : "done_fail");

          if (result.valid) {
            toast.success("Licencia vigente — aprobada automáticamente");
          } else {
            toast.error(`Licencia: ${result.message}`);
          }

          formRef.current?.reset();
          setFile(null);
          setTimeout(() => router.refresh(), 3000);
          return;
        }

        // ── Hoja de Vida del Conductor ───────────────────────────────────────
        // Mismo circuito que antecedentes: folio + código contra el Registro Civil
        if (isHojaVida && file && /\.pdf$/i.test(file.name)) {
          setPhase("extracting");
          const hv: HojaVidaExtracted = await extractHojaVidaFromPdf(documentId);
          setExtractedAnt({ folio: hv.folio, codigoVerificacion: hv.codigoVerificacion, rut: hv.rut, fullName: hv.fullName, fechaEmision: hv.fechaEmision, sinAntecedentes: hv.sinAnotaciones, antecedentesDetalle: hv.anotacionesDetalle, tipoFines: null });
          setPhase("extracted");

          if (!hv.folio || !hv.codigoVerificacion) {
            toast.error("No se encontraron folio o código de verificación en el PDF");
            setPhase("done_fail");
            return;
          }

          setPhase("verifying");
          const result = await verifyAntecedentesInRC(documentId, hv.folio, hv.codigoVerificacion, hv.rut);
          setVerificationAnt(result);
          setPhase(result.valid ? "done_ok" : "done_fail");

          if (result.valid) {
            toast.success("Hoja de vida verificada y aprobada automáticamente");
          } else {
            toast.error(`Registro Civil: ${result.message}`);
          }

          formRef.current?.reset();
          setFile(null);
          setTimeout(() => router.refresh(), 3000);
          return;
        }

        // ── Certificado de antecedentes ──────────────────────────────────────
        if (isAntecedentes && file && /\.pdf$/i.test(file.name)) {
          setPhase("extracting");
          const data = await extractAntecedentesFromPdf(documentId);
          setExtractedAnt(data);
          setPhase("extracted");

          if (!data.folio || !data.codigoVerificacion) {
            toast.error("No se encontraron folio o código de verificación en el PDF");
            setPhase("done_fail");
            return;
          }

          setPhase("verifying");
          const result = await verifyAntecedentesInRC(documentId, data.folio, data.codigoVerificacion, data.rut);
          setVerificationAnt(result);
          setPhase(result.valid ? "done_ok" : "done_fail");

          if (result.valid) {
            toast.success("Certificado verificado y aprobado automáticamente");
          } else {
            toast.error(`Registro Civil: ${result.message}`);
          }

          formRef.current?.reset();
          setFile(null);
          setTimeout(() => router.refresh(), 3000);
          return;
        }

        // ── Cédula de identidad ──────────────────────────────────────────────
        if (!isCarnet || !file || !/\.(jpg|jpeg|png)$/i.test(file.name)) {
          toast.success("Documento subido");
          setPhase("idle");
          formRef.current?.reset();
          setFile(null);
          return;
        }

        setPhase("extracting");
        const data = await extractCarnetFromImage(documentId);
        setExtracted(data);
        setPhase("extracted");

        if (!data.rut || !data.documentNumber) {
          toast.error("No se encontraron RUT o N° de serie en la imagen");
          setPhase("done_fail");
          return;
        }

        setPhase("verifying");
        const result = await verifyCarnetInRC(documentId, data.rut, data.documentNumber);
        setVerification(result);
        setPhase(result.valid ? "done_ok" : "done_fail");

        if (result.valid) {
          toast.success("Carnet verificado y aprobado automáticamente");
        } else {
          toast.error(`Registro Civil: ${result.message}`);
        }

        formRef.current?.reset();
        setFile(null);
        setTimeout(() => router.refresh(), 3000);
      } catch (e) {
        toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
        setPhase("error");
      }
    });
  }

  return (
    <div className="space-y-5">

      {/* Upload zone */}
      {!isProcessing && phase !== "done_ok" && phase !== "done_fail" && (
        <form ref={formRef} action={handleSubmit} className="space-y-2">
          <label className={`
            group relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed cursor-pointer
            transition-all duration-200
            ${file
              ? "border-primary/40 bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/40"}
          `}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              file ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            }`}>
              {isCarnet ? <ScanLine className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
            </div>
            <div className="text-center">
              <p className={`text-sm font-semibold ${file ? "text-primary" : "text-foreground"}`}>
                {file?.name ?? (isCarnet ? "Selecciona la foto del carnet" : (isAntecedentes || isHojaVida) ? "Selecciona el certificado PDF" : isLicencia ? "Selecciona la licencia de conducir" : "Selecciona el documento")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isCarnet ? "JPG o PNG — frente del carnet" : (isAntecedentes || isHojaVida) ? "PDF del Registro Civil" : isLicencia ? "JPG, PNG o PDF — un solo archivo" : "PDF, JPG o PNG"}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept={isCarnet ? "image/jpeg,image/png,.jpg,.jpeg,.png" : (isAntecedentes || isHojaVida) ? "application/pdf,.pdf" : isLicencia ? "image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" : "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"}
              className="hidden"
              onChange={handleFileChange}
              required
            />
          </label>

          {acceptsImages && (
            <>
              <Button type="button" variant="outline" className="w-full gap-2 h-10" onClick={openCamera}>
                <Camera className="w-4 h-4" /> Tomar foto con la cámara
              </Button>
              <input
                ref={captureInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCameraCapture(f);
                }}
              />
            </>
          )}

          {cameraOpen && <CameraCaptureModal onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} />}

          {(isCarnet || isAntecedentes || isLicencia || isHojaVida) && (
            <p className="text-[11px] text-muted-foreground px-1 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-violet-500 flex-shrink-0" />
              {isLicencia
                ? "La IA lee la licencia y valida la vigencia con extensión legal de +1 año"
                : "La IA extrae los datos y verifica autenticidad en Registro Civil automáticamente"}
            </p>
          )}

          <Button type="submit" disabled={!file} className="w-full gap-2 h-10 font-semibold">
            {(isCarnet || isAntecedentes || isLicencia || isHojaVida) ? (
              <><ScanLine className="w-4 h-4" /> Subir y verificar automáticamente</>
            ) : "Subir documento"}
          </Button>
        </form>
      )}

      {/* Progress */}
      {phase !== "idle" && phase !== "error" && (
        <div className="space-y-4">
          <StepIndicator phase={phase} verifyLabel={isLicencia ? "Vigencia" : "Registro Civil"} />

          {/* Active step card */}
          {isProcessing && phaseMsg && (
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-muted/60 to-muted/20 p-4">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent" />
              <div className="relative flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{phaseMsg.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{phaseMsg.subtitle}</p>
                </div>
              </div>
            </div>
          )}

          {/* Extracted data — carnet */}
          {extracted && <ExtractedCard data={extracted} dim={phase === "verifying"} />}

          {/* Extracted data — antecedentes */}
          {extractedAnt && <ExtractedCardAntecedentes data={extractedAnt} dim={phase === "verifying"} />}
        </div>
      )}

      {/* Result — licencia */}
      {verificationLic && (phase === "done_ok" || phase === "done_fail") && (
        <div className={`rounded-2xl overflow-hidden border shadow-lg ${
          verificationLic.valid ? "border-emerald-200 shadow-emerald-100" : "border-red-200 shadow-red-100"
        }`}>
          <div className={`relative px-5 py-5 overflow-hidden ${
            verificationLic.valid ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-red-500 to-red-600"
          }`}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 50%, white 0%, transparent 60%)" }} />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                {verificationLic.valid ? <ShieldCheck className="w-6 h-6 text-white" /> : <ShieldAlert className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white leading-tight">
                  {verificationLic.valid ? "Licencia VIGENTE" : `Licencia ${verificationLic.status.replace(/_/g, " ")}`}
                </p>
                <p className="text-sm text-white/80 mt-0.5">{verificationLic.message}</p>
                {verificationLic.valid && verificationLic.data.clases && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {verificationLic.data.clases.split(",").map(c => (
                      <div key={c} className="bg-white/15 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
                        <p className="text-[9px] text-white/70 font-semibold uppercase tracking-wider">Clase</p>
                        <p className="text-xs font-bold text-white font-mono">{c.trim()}</p>
                      </div>
                    ))}
                    {verificationLic.diasRestantes !== null && (
                      <div className="bg-white/15 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
                        <p className="text-[9px] text-white/70 font-semibold uppercase tracking-wider">Días restantes</p>
                        <p className="text-xs font-bold text-white font-mono">{verificationLic.diasRestantes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {verificationLic.valid && (
            <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-3">Datos verificados</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: "Titular",           value: verificationLic.data.fullName },
                  { label: "RUT",               value: verificationLic.data.rut },
                  { label: "Vencimiento real",  value: verificationLic.fechaVencimientoReal },
                  { label: "Vencimiento +1 año",value: verificationLic.fechaVencimientoExtendida },
                  { label: "Restricciones",     value: verificationLic.data.restricciones },
                ].filter(f => f.value).map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-emerald-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-emerald-600 font-semibold uppercase tracking-wider">{label}</p>
                      <p className="text-xs font-bold text-emerald-900 truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-5 py-4 bg-white">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Proceso ejecutado</p>
            <div className="relative">
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {[
                  { icon: <Brain className="w-4 h-4" />, color: "bg-violet-100 text-violet-600", label: "Claude Vision (Anthropic)", detail: "Extrajo clase, fecha de vencimiento y RUT directamente del documento." },
                  { icon: <Calendar className="w-4 h-4" />, color: "bg-blue-100 text-blue-600", label: "Extensión legal aplicada (+1 año)", detail: `Vencimiento original ${verificationLic.fechaVencimientoReal} → extendido hasta ${verificationLic.fechaVencimientoExtendida}.` },
                  verificationLic.valid
                    ? { icon: <Sparkles className="w-4 h-4" />, color: "bg-emerald-100 text-emerald-600", label: "Aprobación automática", detail: "La licencia fue aprobada sin intervención manual." }
                    : { icon: <X className="w-4 h-4" />, color: "bg-red-100 text-red-600", label: "Revisión manual requerida", detail: verificationLic.message },
                ].map(({ icon, color, label, detail }, i) => (
                  <div key={i} className="flex gap-3 relative">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 z-10 ${color}`}>{icon}</div>
                    <div className="pt-1 min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground leading-none">{label}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result — antecedentes */}
      {verificationAnt && (phase === "done_ok" || phase === "done_fail") && (
        <div className={`rounded-2xl overflow-hidden border shadow-lg ${
          verificationAnt.valid ? "border-emerald-200 shadow-emerald-100" : "border-red-200 shadow-red-100"
        }`}>
          <div className={`relative px-5 py-5 overflow-hidden ${
            verificationAnt.valid ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-red-500 to-red-600"
          }`}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 50%, white 0%, transparent 60%)" }} />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                {verificationAnt.valid ? <ShieldCheck className="w-6 h-6 text-white" /> : <ShieldAlert className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white leading-tight">
                  {verificationAnt.valid ? "Certificado VÁLIDO" : `Certificado ${verificationAnt.status.replace(/_/g, " ")}`}
                </p>
                <p className="text-sm text-white/80 mt-0.5">
                  {verificationAnt.valid ? "Verificado automáticamente en el Registro Civil de Chile" : verificationAnt.message}
                </p>
                {verificationAnt.valid && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { label: "Folio", value: verificationAnt.confirmedFolio ?? extractedAnt?.folio },
                      { label: "RUT",   value: verificationAnt.confirmedRut   ?? extractedAnt?.rut },
                    ].filter(f => f.value).map(({ label, value }) => (
                      <div key={label} className="bg-white/15 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
                        <p className="text-[9px] text-white/70 font-semibold uppercase tracking-wider">{label}</p>
                        <p className="text-xs font-bold text-white font-mono">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {verificationAnt.valid && extractedAnt && (
            <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-3">Datos confirmados</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: "Titular",   value: extractedAnt.fullName },
                  { label: "Tipo",      value: extractedAnt.tipoFines },
                  { label: "Emisión",   value: extractedAnt.fechaEmision },
                  { label: "Resultado", value: extractedAnt.sinAntecedentes ? "Sin antecedentes" : "Con antecedentes" },
                ].filter(f => f.value).map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-emerald-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-emerald-600 font-semibold uppercase tracking-wider">{label}</p>
                      <p className="text-xs font-bold text-emerald-900 truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-5 py-4 bg-white">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Proceso automático ejecutado</p>
            <div className="relative">
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {[
                  { icon: <Brain className="w-4 h-4" />, color: "bg-violet-100 text-violet-600", label: "Claude (Anthropic)", detail: "Analizó el PDF y extrajo folio y código de verificación sin intervención manual." },
                  { icon: <Bot className="w-4 h-4" />,   color: "bg-blue-100 text-blue-600",    label: "Resolución automática de CAPTCHA", detail: "El sistema resolvió el desafío de seguridad del sitio oficial del Registro Civil." },
                  { icon: <Landmark className="w-4 h-4" />, color: "bg-amber-100 text-amber-700", label: "Consulta al SRCeI", detail: `Se verificó el folio ${extractedAnt?.folio ?? "—"} en el sistema oficial del Estado.` },
                  verificationAnt.valid
                    ? { icon: <Sparkles className="w-4 h-4" />, color: "bg-emerald-100 text-emerald-600", label: "Aprobación automática", detail: "El certificado fue aprobado en el sistema sin ninguna intervención manual." }
                    : { icon: <X className="w-4 h-4" />,        color: "bg-red-100 text-red-600",         label: "Revisión manual requerida", detail: "El certificado no pudo ser validado automáticamente y requiere revisión." },
                ].map(({ icon, color, label, detail }, i) => (
                  <div key={i} className="flex gap-3 relative">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 z-10 ${color}`}>{icon}</div>
                    <div className="pt-1 min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground leading-none">{label}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result — carnet */}
      {verification && (phase === "done_ok" || phase === "done_fail") && (
        <div className={`rounded-2xl overflow-hidden border shadow-lg ${
          verification.valid ? "border-emerald-200 shadow-emerald-100" : "border-red-200 shadow-red-100"
        }`}>

          {/* Hero header */}
          <div className={`relative px-5 py-5 overflow-hidden ${
            verification.valid
              ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
              : "bg-gradient-to-br from-red-500 to-red-600"
          }`}>
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: "radial-gradient(circle at 70% 50%, white 0%, transparent 60%)"
            }} />
            <div className="relative flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                verification.valid ? "bg-white/20" : "bg-white/20"
              }`}>
                {verification.valid
                  ? <ShieldCheck className="w-6 h-6 text-white" />
                  : <ShieldAlert className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white leading-tight">
                  {verification.valid ? "Documento VIGENTE" : `Documento ${verification.status.replace(/_/g, " ")}`}
                </p>
                <p className="text-sm text-white/80 mt-0.5">
                  {verification.valid
                    ? "Verificado automáticamente en el Registro Civil de Chile"
                    : verification.message}
                </p>
                {verification.valid && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { label: "RUT", value: verification.confirmedRut ?? extracted?.rut },
                      { label: "N° serie", value: verification.confirmedDocumentNumber ?? extracted?.documentNumber },
                    ].filter(f => f.value).map(({ label, value }) => (
                      <div key={label} className="bg-white/15 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
                        <p className="text-[9px] text-white/70 font-semibold uppercase tracking-wider">{label}</p>
                        <p className="text-xs font-bold text-white font-mono">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Confirmed data rows */}
          {verification.valid && extracted && (
            <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-3">
                Datos confirmados por Registro Civil
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: "Titular", value: extracted.fullName },
                  { label: "Nacionalidad", value: extracted.nationality },
                  { label: "Fecha nacimiento", value: extracted.birthDate },
                  { label: "Vencimiento", value: extracted.expiryDate },
                ].filter(f => f.value).map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-emerald-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-emerald-600 font-semibold uppercase tracking-wider">{label}</p>
                      <p className="text-xs font-bold text-emerald-900 truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process timeline */}
          <div className="px-5 py-4 bg-white">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Proceso automático ejecutado
            </p>
            <div className="relative">
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {PROCESS_STEPS(
                  verification.confirmedRut ?? extracted?.rut ?? "—",
                  verification.confirmedDocumentNumber ?? extracted?.documentNumber ?? "—",
                  verification.valid,
                ).map(({ icon, color, label, detail }, i) => (
                  <div key={i} className="flex gap-3 relative">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 z-10 ${color}`}>
                      {icon}
                    </div>
                    <div className="pt-1 min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground leading-none">{label}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retry */}
      {(phase === "done_fail" || phase === "error") && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setPhase("idle"); setExtracted(null); setExtractedAnt(null); setVerification(null); setVerificationAnt(null); setVerificationLic(null); }}
          className="w-full"
        >
          {(isAntecedentes || isHojaVida) ? "Intentar con otro PDF" : isLicencia ? "Intentar con otro archivo" : "Intentar con otra imagen"}
        </Button>
      )}
    </div>
  );
}
