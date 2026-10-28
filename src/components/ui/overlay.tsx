"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { Boton } from "./base";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "./icons";
import { CampoTextoLargo } from "./form";

/* ------------------------------ Modal ------------------------------ */
interface PropsModal {
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: "sm" | "md" | "lg" | "xl";
}

const ANCHOS = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

/** Diálogo modal accesible basado en <dialog> (foco atrapado y Escape nativos). Se monta solo cuando está abierto. */
export function Modal({ titulo, descripcion, onCerrar, children, pie, ancho = "md" }: PropsModal) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar();
      }}
      aria-labelledby="modal-titulo"
      className={cn("m-auto w-[calc(100%-1.5rem)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/40 animar-aparecer", ANCHOS[ancho])}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="modal-titulo" className="text-base font-semibold text-navy-900">{titulo}</h2>
            {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="-mr-1.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 rounded-b-2xl">{pie}</div>}
      </div>
    </dialog>
  );
}

/* ------------------------- Confirmación ------------------------- */
interface PropsConfirmar {
  titulo: string;
  mensaje: ReactNode;
  textoConfirmar?: string;
  peligro?: boolean;
  /** Si se indica, exige un motivo escrito antes de confirmar. */
  pideMotivo?: { etiqueta: string; minimo?: number };
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
  cargando?: boolean;
}

export function ConfirmarDialogo({ titulo, mensaje, textoConfirmar = "Confirmar", peligro, pideMotivo, onConfirmar, onCancelar, cargando }: PropsConfirmar) {
  const [motivo, setMotivo] = useState("");
  const [tocado, setTocado] = useState(false);
  const min = pideMotivo?.minimo ?? 5;
  const motivoOk = !pideMotivo || motivo.trim().length >= min;
  return (
    <Modal
      titulo={titulo}
      onCerrar={onCancelar}
      ancho="sm"
      pie={
        <>
          <Boton variante="secundario" onClick={onCancelar}>Cancelar</Boton>
          <Boton
            variante={peligro ? "peligro" : "primario"}
            cargando={cargando}
            onClick={() => {
              if (!motivoOk) {
                setTocado(true);
                return;
              }
              onConfirmar(motivo.trim());
            }}
          >
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        <div className="flex gap-3">
          {peligro ? <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden /> : <Info className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />}
          <div>{mensaje}</div>
        </div>
        {pideMotivo && (
          <CampoTextoLargo
            etiqueta={pideMotivo.etiqueta}
            obligatorio
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            error={tocado && !motivoOk ? `Escribe al menos ${min} caracteres para dejar constancia.` : undefined}
          />
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------ Avisos ------------------------------ */
type TipoAviso = "exito" | "error" | "info";
interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
}
let avisos: Aviso[] = [];
let contador = 0;
const oyentesAviso = new Set<() => void>();
const emitir = () => oyentesAviso.forEach((l) => l());

export function notificar(tipo: TipoAviso, texto: string) {
  const a: Aviso = { id: ++contador, tipo, texto };
  avisos = [...avisos, a].slice(-4);
  emitir();
  setTimeout(() => descartar(a.id), tipo === "error" ? 7000 : 4200);
}
function descartar(id: number) {
  avisos = avisos.filter((a) => a.id !== id);
  emitir();
}

export function Avisos() {
  const lista = useSyncExternalStore(
    (cb) => {
      oyentesAviso.add(cb);
      return () => {
        oyentesAviso.delete(cb);
      };
    },
    () => avisos,
    () => avisos,
  );
  return (
    <div className="no-imprimir pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 p-3 sm:bottom-0 sm:items-end sm:p-5" aria-live="polite">
      {lista.map((a) => (
        <div
          key={a.id}
          role={a.tipo === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-white p-3.5 text-sm shadow-lg animar-aparecer",
            a.tipo === "error" ? "border-red-200" : a.tipo === "exito" ? "border-emerald-200" : "border-brand-200",
          )}
        >
          {a.tipo === "error" ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-600" /> : a.tipo === "exito" ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <Info className="mt-0.5 size-5 shrink-0 text-brand-600" />}
          <p className="flex-1 text-slate-800">{a.texto}</p>
          <button type="button" onClick={() => descartar(a.id)} aria-label="Cerrar aviso" className="rounded p-0.5 text-slate-400 hover:text-slate-700">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
