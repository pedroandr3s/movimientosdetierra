"use client";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "./cn";
import { Boton, Tarjeta } from "./base";
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info, TrendingDown, TrendingUp, Minus } from "./icons";

/* ------------------------- Encabezado de página ------------------------- */
export function EncabezadoPagina({ titulo, descripcion, acciones, migas }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode; migas?: { href?: string; texto: string }[] }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {migas && (
          <nav aria-label="Ruta" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            {migas.map((m, i) => (
              <span key={i} className="flex items-center gap-1">
                {m.href ? <Link href={m.href} className="hover:text-brand-600 hover:underline">{m.texto}</Link> : <span>{m.texto}</span>}
                {i < migas.length - 1 && <ChevronRight className="size-3" aria-hidden />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-3xl text-sm text-slate-600">{descripcion}</p>}
      </div>
      {acciones && <div className="no-imprimir flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}

/* ------------------------------ Estado vacío ------------------------------ */
export function EstadoVacio({ titulo, descripcion, accion, icono }: { titulo: string; descripcion?: ReactNode; accion?: ReactNode; icono?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-navy-50 text-navy-700">{icono ?? <Info className="size-6" aria-hidden />}</div>
      <p className="text-sm font-semibold text-navy-900">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-md text-sm text-slate-500">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

/* ------------------------------ Tarjeta KPI ------------------------------ */
interface PropsKpi {
  titulo: string;
  valor: string;
  /** Variación vs. periodo anterior (en %). null = sin base comparable. */
  variacion?: number | null;
  /** "sube = bueno" por defecto; invertir para costos/pendientes. */
  menorEsMejor?: boolean;
  detalle?: ReactNode;
  icono?: ReactNode;
  destacado?: boolean;
  href?: string;
  sinComparacion?: boolean;
  /** Sin juicio bueno/malo (por ejemplo, litros o kilómetros, que dependen de la actividad). */
  neutral?: boolean;
}

export function TarjetaKpi({ titulo, valor, variacion, menorEsMejor, detalle, icono, destacado, href, sinComparacion, neutral }: PropsKpi) {
  let comparacion: ReactNode = null;
  if (!sinComparacion) {
    if (variacion == null) {
      comparacion = <span className="text-xs text-slate-400">Sin base de comparación</span>;
    } else {
      const sube = variacion > 0.05;
      const baja = variacion < -0.05;
      const bueno = !neutral && (menorEsMejor ? baja : sube);
      const malo = !neutral && (menorEsMejor ? sube : baja);
      const Icono = sube ? TrendingUp : baja ? TrendingDown : Minus;
      comparacion = (
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", bueno ? "text-emerald-700" : malo ? "text-red-600" : "text-slate-500")}>
          <Icono className="size-3.5" aria-hidden />
          {variacion > 0 ? "+" : ""}
          {variacion.toFixed(1).replace(".", ",")} % <span className="font-normal text-slate-400">vs. periodo anterior</span>
        </span>
      );
    }
  }
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium leading-tight text-slate-600">{titulo}</p>
        {icono && <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", destacado ? "bg-accent-50 text-accent-600" : "bg-navy-50 text-navy-700")}>{icono}</span>}
      </div>
      <p className={cn("tabular mt-2 font-semibold tracking-tight text-navy-900", valor.length > 16 ? "text-base leading-8" : "text-2xl")}>{valor}</p>
      <div className="mt-1.5 min-h-5">{comparacion}</div>
      {detalle && <div className="mt-1 text-xs text-slate-500">{detalle}</div>}
    </>
  );
  const clases = cn("block p-4", href && "rounded-xl transition-colors hover:bg-slate-50");
  return <Tarjeta className={cn(destacado && "border-t-2 border-t-accent-500")}>{href ? <Link href={href} className={clases}>{contenido}</Link> : <div className={clases}>{contenido}</div>}</Tarjeta>;
}

/* ------------------------------ Lista de datos ------------------------------ */
export function ListaDatos({ items, columnas = 2 }: { items: { etiqueta: string; valor: ReactNode }[]; columnas?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columnas === 1 ? "grid-cols-1" : columnas === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium text-slate-500">{it.etiqueta}</dt>
          <dd className="mt-0.5 break-words text-sm text-slate-900">{it.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------ Pestañas ------------------------------ */
export function Pestanas<T extends string>({ valor, onCambiar, opciones, className }: { valor: T; onCambiar: (v: T) => void; opciones: { valor: T; etiqueta: string; conteo?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1", className)}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          role="tab"
          aria-selected={valor === o.valor}
          type="button"
          onClick={() => onCambiar(o.valor)}
          className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors", valor === o.valor ? "bg-white text-navy-900 shadow-sm" : "text-slate-600 hover:text-navy-900")}
        >
          {o.etiqueta}
          {o.conteo != null && <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-[11px] text-slate-700">{o.conteo}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Tabla de datos ------------------------------ */
export interface Columna<T> {
  clave: string;
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** Si se define, la columna es ordenable por este valor. */
  orden?: (fila: T) => string | number | null;
  alinear?: "izq" | "der" | "centro";
  className?: string;
  ocultarEnMovil?: boolean;
}

interface PropsTabla<T> {
  columnas: Columna<T>[];
  filas: T[];
  clave: (fila: T) => string;
  alHacerClic?: (fila: T) => void;
  tamanoPagina?: number;
  vacio?: ReactNode;
  ordenInicial?: { clave: string; dir: "asc" | "desc" };
  pie?: ReactNode;
  ariaEtiqueta?: string;
}

export function TablaDatos<T>({ columnas, filas, clave, alHacerClic, tamanoPagina = 15, vacio, ordenInicial, pie, ariaEtiqueta }: PropsTabla<T>) {
  const [orden, setOrden] = useState(ordenInicial ?? null);
  const [pagina, setPagina] = useState(0);

  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const col = columnas.find((c) => c.clave === orden.clave);
    if (!col?.orden) return filas;
    const f = col.orden;
    const signo = orden.dir === "asc" ? 1 : -1;
    return [...filas].sort((a, b) => {
      const va = f(a);
      const vb = f(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * signo;
      return String(va).localeCompare(String(vb), "es-CL", { numeric: true }) * signo;
    });
  }, [filas, orden, columnas]);

  const paginas = Math.max(1, Math.ceil(ordenadas.length / tamanoPagina));
  const paginaActual = Math.min(pagina, paginas - 1);
  const visibles = ordenadas.slice(paginaActual * tamanoPagina, (paginaActual + 1) * tamanoPagina);

  if (filas.length === 0) return <>{vacio ?? <EstadoVacio titulo="Sin registros" descripcion="No hay datos que mostrar con los filtros actuales." />}</>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm" aria-label={ariaEtiqueta}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {columnas.map((c) => {
                const activo = orden?.clave === c.clave;
                return (
                  <th
                    key={c.clave}
                    scope="col"
                    aria-sort={activo ? (orden!.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn("px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600", c.alinear === "der" ? "text-right" : c.alinear === "centro" ? "text-center" : "text-left", c.ocultarEnMovil && "hidden md:table-cell", c.className)}
                  >
                    {c.orden ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPagina(0);
                          setOrden(activo ? (orden!.dir === "asc" ? { clave: c.clave, dir: "desc" } : null) : { clave: c.clave, dir: "asc" });
                        }}
                        className={cn("inline-flex items-center gap-1 uppercase hover:text-navy-900", c.alinear === "der" && "flex-row-reverse")}
                      >
                        {c.titulo}
                        {activo ? orden!.dir === "asc" ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden /> : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                      </button>
                    ) : (
                      c.titulo
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr
                key={clave(f)}
                onClick={alHacerClic ? () => alHacerClic(f) : undefined}
                className={cn("border-b border-slate-100 last:border-0", alHacerClic && "cursor-pointer hover:bg-brand-50/50")}
              >
                {columnas.map((c) => (
                  <td key={c.clave} className={cn("px-3 py-2.5 align-middle text-slate-800", c.alinear === "der" ? "tabular text-right" : c.alinear === "centro" ? "text-center" : "text-left", c.ocultarEnMovil && "hidden md:table-cell", c.className)}>
                    {c.celda(f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {pie && <tfoot>{pie}</tfoot>}
        </table>
      </div>
      {paginas > 1 && (
        <div className="no-imprimir flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5 text-xs text-slate-600">
          <span>
            {paginaActual * tamanoPagina + 1}–{Math.min((paginaActual + 1) * tamanoPagina, ordenadas.length)} de {ordenadas.length}
          </span>
          <div className="flex items-center gap-1">
            <Boton tamano="sm" variante="secundario" disabled={paginaActual === 0} onClick={() => setPagina(paginaActual - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" /></Boton>
            <span className="px-2 tabular">Página {paginaActual + 1} de {paginas}</span>
            <Boton tamano="sm" variante="secundario" disabled={paginaActual >= paginas - 1} onClick={() => setPagina(paginaActual + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" /></Boton>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Barra de filtros ------------------------------ */
export function BarraFiltros({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("no-imprimir flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

/* ------------------------------ Aviso en página ------------------------------ */
export function AvisoPagina({ tono = "info", titulo, children, accion }: { tono?: "info" | "alerta" | "error" | "exito"; titulo?: string; children?: ReactNode; accion?: ReactNode }) {
  const estilos = {
    info: "border-brand-200 bg-brand-50 text-brand-700",
    alerta: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
    exito: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tono];
  return (
    <div role={tono === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", estilos)}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={cn(titulo && "mt-0.5", "text-[13px] leading-relaxed")}>{children}</div>}
      </div>
      {accion}
    </div>
  );
}
