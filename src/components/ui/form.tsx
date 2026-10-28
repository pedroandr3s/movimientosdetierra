"use client";
import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

/** Interpreta números escritos al estilo chileno: "1.250,5" → 1250.5; "14.000" → 14000; "12.5" → 12.5. */
export function parseNum(texto: string | undefined | null): number | null {
  if (texto == null) return null;
  let t = texto.trim().replace(/\s/g, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Texto editable para un número ya existente (sin separador de miles). */
export function numATexto(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(n).replace(".", ",");
}

const BASE_CONTROL =
  "w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500";

interface PropsCampo {
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
  obligatorio?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string; className: string }) => ReactNode;
}

/** Envoltorio accesible: etiqueta, control, ayuda y mensaje de error asociados. */
export function Campo({ etiqueta, error, ayuda, obligatorio, className, children }: PropsCampo) {
  const id = useId();
  const idMsg = `${id}-msg`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-slate-700">
        {etiqueta}
        {obligatorio && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
      </label>
      {children({
        id,
        "aria-invalid": !!error,
        "aria-describedby": error || ayuda ? idMsg : undefined,
        className: cn(BASE_CONTROL, error ? "border-red-400" : "border-slate-300"),
      })}
      {error ? (
        <p id={idMsg} role="alert" className="text-xs font-medium text-red-600">{error}</p>
      ) : ayuda ? (
        <p id={idMsg} className="text-xs text-slate-500">{ayuda}</p>
      ) : null}
    </div>
  );
}

type PropsBase = { etiqueta: string; error?: string; ayuda?: ReactNode; obligatorio?: boolean; claseCampo?: string };

export function CampoTexto({ etiqueta, error, ayuda, obligatorio, claseCampo, className, ...rest }: PropsBase & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio} className={claseCampo}>
      {(p) => <input {...p} {...rest} className={cn(p.className, "h-10", className)} />}
    </Campo>
  );
}

/** Número con teclado decimal; el formulario guarda el texto y lo interpreta con parseNum. */
export function CampoNumero({ etiqueta, error, ayuda, obligatorio, claseCampo, className, unidad, ...rest }: PropsBase & { unidad?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio} className={claseCampo}>
      {(p) => (
        <div className="relative">
          <input {...p} {...rest} type="text" inputMode="decimal" autoComplete="off" className={cn(p.className, "h-10 tabular", unidad && "pr-12", className)} />
          {unidad && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{unidad}</span>}
        </div>
      )}
    </Campo>
  );
}

export function CampoSelect({ etiqueta, error, ayuda, obligatorio, claseCampo, className, children, ...rest }: PropsBase & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio} className={claseCampo}>
      {(p) => (
        <select {...p} {...rest} className={cn(p.className, "h-10 pr-8", className)}>
          {children}
        </select>
      )}
    </Campo>
  );
}

export function CampoTextoLargo({ etiqueta, error, ayuda, obligatorio, claseCampo, className, ...rest }: PropsBase & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio} className={claseCampo}>
      {(p) => <textarea rows={3} {...p} {...rest} className={cn(p.className, "py-2", className)} />}
    </Campo>
  );
}

export function Casilla({ etiqueta, descripcion, className, ...rest }: { etiqueta: string; descripcion?: string; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-5 rounded border-slate-300 accent-brand-600" {...rest} />
      <label htmlFor={id} className="text-sm text-slate-700">
        {etiqueta}
        {descripcion && <span className="block text-xs text-slate-500">{descripcion}</span>}
      </label>
    </div>
  );
}

/** Entrada compacta para barras de filtros (sin etiqueta visible; usa aria-label). */
export function SelectFiltro({ etiqueta, className, children, ...rest }: { etiqueta: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select aria-label={etiqueta} {...rest} className={cn("h-9 rounded-lg border border-slate-300 bg-white px-2.5 pr-7 text-[13px] text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20", className)}>
      {children}
    </select>
  );
}

export function EntradaFiltro({ etiqueta, className, ...rest }: { etiqueta: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input aria-label={etiqueta} {...rest} className={cn("h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20", className)} />
  );
}
