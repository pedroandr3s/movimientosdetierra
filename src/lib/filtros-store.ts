/**
 * Filtros globales de los dashboards. Se comparten entre las vistas del administrador
 * para que cambiar de dashboard conserve el periodo y los filtros elegidos.
 * Solo en memoria (no se persisten).
 */
import { useSyncExternalStore } from "react";
import { FILTROS_INICIALES, type Filtros } from "./calc";

let filtros: Filtros = FILTROS_INICIALES;
const oyentes = new Set<() => void>();

function suscribir(cb: () => void) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

export function fijarFiltros(patch: Partial<Filtros>) {
  const sig: Record<string, unknown> = { ...filtros };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === "") delete sig[k];
    else sig[k] = v;
  }
  filtros = sig as unknown as Filtros;
  oyentes.forEach((l) => l());
}

export function limpiarFiltros() {
  filtros = FILTROS_INICIALES;
  oyentes.forEach((l) => l());
}

export function useFiltros(): Filtros {
  return useSyncExternalStore(suscribir, () => filtros, () => FILTROS_INICIALES);
}
