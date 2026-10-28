"use client";
import { useMemo } from "react";
import { calcularKpis, rangoAnterior, rangoDeFiltros, type Filtros } from "@/lib/calc";
import { useFiltros } from "@/lib/filtros-store";
import { hoyISO } from "@/lib/fecha";
import { useData } from "@/lib/store";

/** Calcula rango, periodo anterior y KPIs a partir de los filtros globales. `vendedorId` fija la vista del vendedor. */
export function useAnalisis(vendedorId?: string) {
  const data = useData();
  const base = useFiltros();
  const hoy = hoyISO();
  const f: Filtros = useMemo(() => (vendedorId ? { ...base, vendedorId } : base), [base, vendedorId]);
  return useMemo(() => {
    const r = rangoDeFiltros(f, hoy);
    const rp = rangoAnterior(f.preset, r);
    return { data, f, hoy, r, rp, kpis: calcularKpis(data, f, r, hoy), previos: calcularKpis(data, f, rp, hoy) };
  }, [data, f, hoy]);
}
export type Analisis = ReturnType<typeof useAnalisis>;
