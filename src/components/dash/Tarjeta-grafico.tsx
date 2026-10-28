"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/base";
import { EstadoVacio } from "@/components/ui/datos";
import { cn } from "@/components/ui/cn";
import { ChartLine } from "@/components/ui/icons";

interface Props {
  titulo: string;
  subtitulo?: ReactNode;
  /** Controles propios del gráfico (por ejemplo, alternar volumen/ingresos). */
  controles?: ReactNode;
  /** Vista alternativa en tabla (accesible, copiable). */
  tabla?: ReactNode;
  vacio?: { titulo: string; descripcion?: string } | null;
  children: ReactNode;
  className?: string;
  pie?: ReactNode;
}

export function TarjetaGrafico({ titulo, subtitulo, controles, tabla, vacio, children, className, pie }: Props) {
  const [vista, setVista] = useState<"grafico" | "tabla">("grafico");
  return (
    <Tarjeta className={cn("flex flex-col", className)}>
      <EncabezadoTarjeta
        titulo={titulo}
        subtitulo={subtitulo}
        acciones={
          <>
            {controles}
            {tabla && !vacio && (
              <div role="group" aria-label="Vista" className="no-imprimir flex rounded-md bg-slate-100 p-0.5 text-xs">
                {(["grafico", "tabla"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={vista === v} onClick={() => setVista(v)} className={cn("rounded px-2 py-1 font-medium", vista === v ? "bg-white text-navy-900 shadow-sm" : "text-slate-600")}>
                    {v === "grafico" ? "Gráfico" : "Tabla"}
                  </button>
                ))}
              </div>
            )}
          </>
        }
      />
      <div className="flex-1 p-3 sm:p-4">
        {vacio ? (
          <EstadoVacio icono={<ChartLine className="size-6" aria-hidden />} titulo={vacio.titulo} descripcion={vacio.descripcion} />
        ) : vista === "tabla" && tabla ? (
          <div className="overflow-x-auto">{tabla}</div>
        ) : (
          children
        )}
      </div>
      {pie && <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">{pie}</div>}
    </Tarjeta>
  );
}

/** Caja flotante común para los tooltips de los gráficos. */
export function CajaTooltip({ titulo, filas }: { titulo?: ReactNode; filas: { etiqueta: string; valor: ReactNode; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {titulo && <p className="mb-1 font-semibold text-navy-900">{titulo}</p>}
      <ul className="space-y-0.5">
        {filas.map((f, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600">
              {f.color && <span className="size-2 rounded-sm" style={{ background: f.color }} aria-hidden />}
              {f.etiqueta}
            </span>
            <span className="tabular font-medium text-slate-900">{f.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TablaSimple({ columnas, filas, pie }: { columnas: { t: string; der?: boolean }[]; filas: ReactNode[][]; pie?: ReactNode[] }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          {columnas.map((c, i) => <th key={i} scope="col" className={cn("px-2 py-1.5 font-semibold", c.der ? "text-right" : "text-left")}>{c.t}</th>)}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={i} className="border-b border-slate-100 last:border-0">
            {fila.map((c, j) => <td key={j} className={cn("px-2 py-1.5", columnas[j]?.der && "tabular text-right")}>{c}</td>)}
          </tr>
        ))}
      </tbody>
      {pie && (
        <tfoot>
          <tr className="border-t border-slate-300 font-semibold">
            {pie.map((c, j) => <td key={j} className={cn("px-2 py-1.5", columnas[j]?.der && "tabular text-right")}>{c}</td>)}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
