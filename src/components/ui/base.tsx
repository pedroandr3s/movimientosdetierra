"use client";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { LoaderCircle } from "./icons";

/* ---------------------------- Botón ---------------------------- */
type Variante = "primario" | "secundario" | "fantasma" | "peligro" | "acento" | "exito";
type Tamano = "sm" | "md" | "lg" | "xl";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300",
  secundario: "bg-white text-navy-900 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  fantasma: "text-navy-800 hover:bg-navy-50 disabled:text-slate-400",
  peligro: "bg-red-600 text-white hover:bg-red-700 shadow-sm disabled:bg-red-300",
  acento: "bg-accent-500 text-white hover:bg-accent-600 shadow-sm disabled:bg-accent-400/60",
  exito: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:bg-emerald-300",
};
const TAMANOS: Record<Tamano, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-md",
  md: "h-10 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-12 px-5 text-base gap-2 rounded-lg",
  xl: "h-16 px-6 text-lg gap-3 rounded-xl font-semibold",
};

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  bloque?: boolean;
}

export function claseBoton(variante: Variante = "primario", tamano: Tamano = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed select-none",
    VARIANTES[variante],
    TAMANOS[tamano],
    extra,
  );
}

export function Boton({ variante = "primario", tamano = "md", cargando, bloque, className, children, disabled, type = "button", ...rest }: PropsBoton) {
  return (
    <button type={type} disabled={disabled || cargando} className={claseBoton(variante, tamano, cn(bloque && "w-full", className))} {...rest}>
      {cargando && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function EnlaceBoton({ href, variante = "secundario", tamano = "md", className, children, bloque }: { href: string; variante?: Variante; tamano?: Tamano; className?: string; children: ReactNode; bloque?: boolean }) {
  return (
    <Link href={href} className={claseBoton(variante, tamano, cn(bloque && "w-full", className))}>
      {children}
    </Link>
  );
}

/* ----------------------------- Tarjeta ----------------------------- */
export function Tarjeta({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_27_45/0.04)] imprimir-sin-sombra", className)} {...rest}>
      {children}
    </div>
  );
}

export function EncabezadoTarjeta({ titulo, subtitulo, acciones, className }: { titulo: ReactNode; subtitulo?: ReactNode; acciones?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-navy-900">{titulo}</h3>
        {subtitulo && <p className="mt-0.5 text-xs text-slate-500">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
    </div>
  );
}

/* ------------------------------ Insignia ------------------------------ */
export type Tono = "gris" | "azul" | "verde" | "naranja" | "rojo" | "navy" | "amarillo";
const TONOS: Record<Tono, string> = {
  gris: "bg-slate-100 text-slate-700 ring-slate-200",
  azul: "bg-brand-50 text-brand-700 ring-brand-200",
  verde: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  naranja: "bg-accent-50 text-accent-700 ring-accent-100",
  amarillo: "bg-amber-50 text-amber-800 ring-amber-200",
  rojo: "bg-red-50 text-red-700 ring-red-200",
  navy: "bg-navy-900 text-white ring-navy-900",
};

export function Insignia({ tono = "gris", children, className }: { tono?: Tono; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONOS[tono], className)}>
      {children}
    </span>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}

export function Separador({ className }: { className?: string }) {
  return <hr className={cn("border-slate-100", className)} />;
}
