import { describe, expect, it } from "vitest";
import { FILTROS_INICIALES, cuentasPorCobrar, rangoDeFiltros, totalesVenta, ventasEnPeriodo, volumenEntregadoVenta } from "../src/lib/calc";
import { REPORTES, generarReporte } from "../src/lib/reportes";
import { HOY, datos } from "./helpers";

const f = { ...FILTROS_INICIALES, preset: "anio" as const };

describe("reportes", () => {
  const d = datos();

  it("existen los 12 reportes pedidos con identificadores únicos", () => {
    expect(REPORTES).toHaveLength(12);
    expect(new Set(REPORTES.map((r) => r.id)).size).toBe(12);
  });

  it("cada reporte genera filas rectangulares (mismo largo que sus columnas)", () => {
    for (const def of REPORTES) {
      const r = generarReporte(d, def.id, f, HOY)!;
      expect(r.columnas.length).toBeGreaterThan(0);
      for (const fila of r.filas) expect(fila).toHaveLength(r.columnas.length);
      if (r.totales) expect(r.totales).toHaveLength(r.columnas.length);
      expect(r.notas.length).toBeGreaterThan(0);
    }
  });

  it("ventas por periodo coincide con el cálculo base y sus totales suman", () => {
    const r = generarReporte(d, "ventas-periodo", f, HOY)!;
    const ventas = ventasEnPeriodo(d, f, rangoDeFiltros(f, HOY));
    expect(r.filas).toHaveLength(ventas.length);
    const totalEsperado = ventas.reduce((s, v) => s + totalesVenta(v).total, 0);
    expect(r.totales?.[8]).toBe(totalEsperado);
  });

  it("no incluye ventas borrador ni anuladas", () => {
    const r = generarReporte(d, "ventas-periodo", f, HOY)!;
    const numeros = new Set(r.filas.map((x) => x[0]));
    for (const v of d.ventas.filter((x) => x.estado !== "confirmada")) expect(numeros.has(v.numero)).toBe(false);
  });

  it("vendido vs entregado usa viajes válidos y el pendiente nunca es negativo", () => {
    const r = generarReporte(d, "vendido-entregado", f, HOY)!;
    for (const fila of r.filas) {
      const numero = fila[0] as string;
      const v = d.ventas.find((x) => x.numero === numero)!;
      expect(fila[6]).toBe(volumenEntregadoVenta(d, v.id));
      expect(fila[7] as number).toBeGreaterThanOrEqual(0);
    }
  });

  it("cuentas por cobrar: el saldo del reporte coincide con el resumen de cobranza", () => {
    const r = generarReporte(d, "cobranza", f, HOY)!;
    const cob = cuentasPorCobrar(d, ventasEnPeriodo(d, f, rangoDeFiltros(f, HOY)), HOY);
    expect(r.resumen.find((x) => x.etiqueta === "Saldo total por cobrar")?.valor).toBe(cob.saldoTotal);
  });

  it("combustible separa consumido de cargado y usa null cuando no hay dato", () => {
    const r = generarReporte(d, "combustible", f, HOY)!;
    expect(r.columnas.map((c) => c.titulo)).toEqual(expect.arrayContaining(["Combustible consumido (L)", "Combustible cargado (L)"]));
    for (const fila of r.filas) {
      if (fila[2] === null || fila[3] === null) expect(fila[4]).toBeNull();
    }
  });

  it("el rendimiento no mezcla km con horas y excluye datos incompletos sin devolver 0", () => {
    const r = generarReporte(d, "rendimiento", f, HOY)!;
    for (const fila of r.filas) {
      expect(["L/100 km", "L/h"]).toContain(fila[4]);
      expect(fila[3] === null || (fila[3] as number) > 0).toBe(true);
    }
  });

  it("un filtro por vendedor reduce las filas de ventas", () => {
    const todas = generarReporte(d, "ventas-periodo", f, HOY)!.filas.length;
    const una = generarReporte(d, "ventas-periodo", { ...f, vendedorId: "u-vend-1" }, HOY)!.filas;
    expect(una.length).toBeLessThan(todas);
    expect(una.every((x) => x[3] === d.usuarios.find((u) => u.id === "u-vend-1")!.nombre)).toBe(true);
  });
});
