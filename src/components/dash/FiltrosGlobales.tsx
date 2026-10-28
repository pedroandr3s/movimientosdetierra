"use client";
import { useMemo } from "react";
import { ETIQUETAS_PERIODO, hayFiltrosActivos, rangoAnterior, rangoDeFiltros, type PresetPeriodo } from "@/lib/calc";
import { fijarFiltros, limpiarFiltros, useFiltros } from "@/lib/filtros-store";
import { useData } from "@/lib/store";
import { hoyISO } from "@/lib/fecha";
import { fecha } from "@/lib/formato";
import { ETIQUETAS, type EstadoComercial, type EstadoDespacho } from "@/lib/types";
import { Tarjeta } from "@/components/ui/base";
import { Boton } from "@/components/ui/base";
import { EntradaFiltro, SelectFiltro } from "@/components/ui/form";
import { SlidersHorizontal, X } from "@/components/ui/icons";

type Dimension = "vendedor" | "cliente" | "conductor" | "vehiculo" | "material" | "faena" | "estadoVenta" | "estadoDespacho";

interface Props {
  /** Dimensiones de filtro a mostrar (además del periodo). */
  dimensiones: Dimension[];
  /** Si se indica, el vendedor está fijado (vista del vendedor). */
  fijarVendedorId?: string;
}

const PRESETS = Object.keys(ETIQUETAS_PERIODO) as PresetPeriodo[];

export function FiltrosGlobales({ dimensiones, fijarVendedorId }: Props) {
  const data = useData();
  const f = useFiltros();
  const hoy = hoyISO();
  const r = useMemo(() => rangoDeFiltros(f, hoy), [f, hoy]);
  const rp = useMemo(() => rangoAnterior(f.preset, r), [f, r]);
  const tiene = (d: Dimension) => dimensiones.includes(d);
  const activos = hayFiltrosActivos(f) || f.preset !== "30d";

  return (
    <Tarjeta className="no-imprimir mb-5 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-[13px] font-semibold text-navy-900">
          <SlidersHorizontal className="size-4 text-brand-600" aria-hidden /> Filtros
        </span>
        <SelectFiltro etiqueta="Periodo" value={f.preset} onChange={(e) => fijarFiltros({ preset: e.target.value as PresetPeriodo, desde: undefined, hasta: undefined })}>
          {PRESETS.map((p) => <option key={p} value={p}>{ETIQUETAS_PERIODO[p]}</option>)}
        </SelectFiltro>
        {f.preset === "personalizado" && (
          <>
            <EntradaFiltro etiqueta="Desde" type="date" value={f.desde ?? r.desde} max={hoy} onChange={(e) => fijarFiltros({ desde: e.target.value || undefined })} />
            <span className="text-xs text-slate-500">a</span>
            <EntradaFiltro etiqueta="Hasta" type="date" value={f.hasta ?? r.hasta} max={hoy} onChange={(e) => fijarFiltros({ hasta: e.target.value || undefined })} />
          </>
        )}
        {tiene("vendedor") && !fijarVendedorId && (
          <SelectFiltro etiqueta="Vendedor" value={f.vendedorId ?? ""} onChange={(e) => fijarFiltros({ vendedorId: e.target.value })}>
            <option value="">Todos los vendedores</option>
            {data.usuarios.filter((u) => u.rol === "vendedor").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </SelectFiltro>
        )}
        {tiene("cliente") && (
          <SelectFiltro etiqueta="Cliente" value={f.clienteId ?? ""} onChange={(e) => fijarFiltros({ clienteId: e.target.value })}>
            <option value="">Todos los clientes</option>
            {data.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </SelectFiltro>
        )}
        {tiene("material") && (
          <SelectFiltro etiqueta="Material" value={f.materialId ?? ""} onChange={(e) => fijarFiltros({ materialId: e.target.value })}>
            <option value="">Todos los materiales</option>
            {data.materiales.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </SelectFiltro>
        )}
        {tiene("faena") && (
          <SelectFiltro etiqueta="Faena" value={f.faenaId ?? ""} onChange={(e) => fijarFiltros({ faenaId: e.target.value })}>
            <option value="">Todas las faenas</option>
            {data.faenas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </SelectFiltro>
        )}
        {tiene("conductor") && (
          <SelectFiltro etiqueta="Conductor" value={f.conductorId ?? ""} onChange={(e) => fijarFiltros({ conductorId: e.target.value })}>
            <option value="">Todos los conductores</option>
            {data.usuarios.filter((u) => u.rol === "conductor").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </SelectFiltro>
        )}
        {tiene("vehiculo") && (
          <SelectFiltro etiqueta="Camión o máquina" value={f.vehiculoId ?? ""} onChange={(e) => fijarFiltros({ vehiculoId: e.target.value })}>
            <option value="">Todos los vehículos</option>
            {data.vehiculos.map((v) => <option key={v.id} value={v.id}>{v.codigo}{v.patente ? ` · ${v.patente}` : ""}</option>)}
          </SelectFiltro>
        )}
        {tiene("estadoVenta") && (
          <SelectFiltro etiqueta="Estado de la venta" value={f.estadoVenta ?? ""} onChange={(e) => fijarFiltros({ estadoVenta: (e.target.value || undefined) as EstadoComercial | undefined })}>
            <option value="">Cualquier estado de venta</option>
            {(["confirmada", "en_despacho", "parcial", "entregada"] as EstadoComercial[]).map((s) => <option key={s} value={s}>{ETIQUETAS.estadoComercial[s]}</option>)}
          </SelectFiltro>
        )}
        {tiene("estadoDespacho") && (
          <SelectFiltro etiqueta="Estado del despacho" value={f.estadoDespacho ?? ""} onChange={(e) => fijarFiltros({ estadoDespacho: (e.target.value || undefined) as EstadoDespacho | undefined })}>
            <option value="">Cualquier estado de despacho</option>
            {(["programado", "en_curso", "finalizado", "incidencia"] as EstadoDespacho[]).map((s) => <option key={s} value={s}>{ETIQUETAS.estadoDespacho[s]}</option>)}
          </SelectFiltro>
        )}
        {activos && (
          <Boton tamano="sm" variante="fantasma" onClick={limpiarFiltros}><X className="size-3.5" /> Limpiar</Boton>
        )}
      </div>
      <p className="mt-2.5 text-xs text-slate-500">
        Periodo analizado: <strong className="font-semibold text-slate-700">{fecha(r.desde)} – {fecha(r.hasta)}</strong> · comparado con {fecha(rp.desde)} – {fecha(rp.hasta)}
      </p>
    </Tarjeta>
  );
}
