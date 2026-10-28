import { describe, expect, it } from "vitest";
import { datos, HOY } from "./helpers";
import {
  actividadFlota,
  calcularKpis,
  crearBuckets,
  cuentasPorCobrar,
  enRango,
  rangoAnterior,
  rangoDePreset,
  resumenFlota,
  serieCombustible,
  serieOperacion,
  serieVentas,
  totalesVenta,
  trabajoDespacho,
  ventasEnPeriodo,
  ventasPorCliente,
  ventasPorMaterial,
  ventasPorVendedor,
  viajesEnPeriodo,
  variacionPct,
} from "../src/lib/calc";
import { generarAlertas } from "../src/lib/alertas";
import { addDays } from "../src/lib/fecha";

describe("totales de venta", () => {
  it("calcula descuento, neto, IVA y total con redondeo en pesos", () => {
    const t = totalesVenta({ cantidadM3: 30, precioUnitario: 14000, descuentoPct: 5, ivaPct: 19 });
    expect(t.brutoSinDescuento).toBe(420000);
    expect(t.descuento).toBe(21000);
    expect(t.neto).toBe(399000);
    expect(t.iva).toBe(75810);
    expect(t.total).toBe(474810);
  });
  it("sin descuento ni IVA el total es cantidad × precio", () => {
    expect(totalesVenta({ cantidadM3: 12.5, precioUnitario: 1000, descuentoPct: 0, ivaPct: 0 }).total).toBe(12500);
  });
});

describe("periodos", () => {
  it("incluyen ambos extremos", () => {
    const r = rangoDePreset("7d", HOY);
    expect(r).toEqual({ desde: "2026-10-21", hasta: "2026-10-27" });
    expect(enRango("2026-10-21", r)).toBe(true);
    expect(enRango("2026-10-27", r)).toBe(true);
    expect(enRango("2026-10-20", r)).toBe(false);
    expect(enRango("2026-10-27T23:59", r)).toBe(true);
  });
  it("mes actual, mes anterior y año", () => {
    expect(rangoDePreset("mes", HOY)).toEqual({ desde: "2026-10-01", hasta: HOY });
    expect(rangoDePreset("mes_anterior", HOY)).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
    expect(rangoDePreset("anio", HOY)).toEqual({ desde: "2026-01-01", hasta: HOY });
    expect(rangoDePreset("hoy", HOY)).toEqual({ desde: HOY, hasta: HOY });
  });
  it("personalizado se ordena si viene al revés", () => {
    expect(rangoDePreset("personalizado", HOY, { desde: "2026-10-10", hasta: "2026-10-01" })).toEqual({ desde: "2026-10-01", hasta: "2026-10-10" });
  });
  it("el periodo anterior es contiguo y de igual duración", () => {
    const r = rangoDePreset("30d", HOY);
    const a = rangoAnterior("30d", r);
    expect(addDays(a.hasta, 1)).toBe(r.desde);
    expect(crearBuckets(a).length).toBe(crearBuckets(r).length);
    expect(rangoAnterior("mes_anterior", rangoDePreset("mes_anterior", HOY))).toEqual({ desde: "2026-08-01", hasta: "2026-08-31" });
  });
});

describe("indicadores", () => {
  const d = datos();
  const f = { preset: "anio" as const };
  const r = rangoDePreset("anio", HOY);

  it("ventas = suma de ventas confirmadas del periodo (sin borradores ni anuladas)", () => {
    const k = calcularKpis(d, f, r, HOY);
    const manual = d.ventas.filter((v) => v.estado === "confirmada" && v.fecha >= r.desde && v.fecha <= r.hasta);
    expect(k.nVentas).toBe(manual.length);
    expect(k.ventasTotal).toBe(manual.reduce((s, v) => s + totalesVenta(v).total, 0));
    expect(k.ventasNeto + k.ventasIva).toBe(k.ventasTotal);
    expect(k.volumenVendido).toBeCloseTo(manual.reduce((s, v) => s + v.cantidadM3, 0), 6);
  });

  it("volumen vendido y entregado son indicadores distintos", () => {
    const k = calcularKpis(d, f, r, HOY);
    expect(k.volumenEntregado).not.toBe(k.volumenVendido);
    expect(k.volumenEntregado).toBeCloseTo(viajesEnPeriodo(d, f, r).reduce((s, v) => s + v.cantidadM3, 0), 6);
  });

  it("las series suman exactamente lo mismo que los indicadores", () => {
    for (const preset of ["7d", "30d", "mes", "mes_anterior", "anio"] as const) {
      const rr = rangoDePreset(preset, HOY);
      const k = calcularKpis(d, { preset }, rr, HOY);
      const sv = serieVentas(d, { preset }, rr, rangoAnterior(preset, rr));
      expect(sv.reduce((s, p) => s + p.total, 0)).toBe(k.ventasTotal);
      expect(sv.reduce((s, p) => s + p.n, 0)).toBe(k.nVentas);
      const so = serieOperacion(d, { preset }, rr);
      expect(so.reduce((s, p) => s + p.entregado, 0)).toBeCloseTo(k.volumenEntregado, 6);
      expect(so.reduce((s, p) => s + p.vendido, 0)).toBeCloseTo(k.volumenVendido, 6);
      const sc = serieCombustible(d, { preset }, rr);
      expect(sc.reduce((s, p) => s + p.litros, 0)).toBeCloseTo(k.combustibleConsumido, 6);
    }
  });

  it("las agrupaciones por material, vendedor y cliente suman el total", () => {
    const k = calcularKpis(d, f, r, HOY);
    for (const lista of [ventasPorMaterial(d, f, r), ventasPorVendedor(d, f, r), ventasPorCliente(d, f, r)]) {
      expect(lista.reduce((s, x) => s + x.total, 0)).toBe(k.ventasTotal);
      expect(lista.reduce((s, x) => s + x.n, 0)).toBe(k.nVentas);
    }
  });

  it("los filtros realmente cambian los resultados", () => {
    const todos = calcularKpis(d, f, r, HOY);
    const vend = calcularKpis(d, { ...f, vendedorId: "u-vend-1" }, r, HOY);
    const mat = calcularKpis(d, { ...f, materialId: "m-arena" }, r, HOY);
    const cond = calcularKpis(d, { ...f, conductorId: "u-cond-1" }, r, HOY);
    expect(vend.nVentas).toBeGreaterThan(0);
    expect(vend.nVentas).toBeLessThan(todos.nVentas);
    expect(mat.ventasTotal).toBeLessThan(todos.ventasTotal);
    expect(cond.volumenEntregado).toBeLessThan(todos.volumenEntregado);
    expect(cond.volumenEntregado).toBeGreaterThan(0);
    // conductor y vendedor juntos nunca superan a cada uno por separado
    const ambos = calcularKpis(d, { ...f, vendedorId: "u-vend-1", conductorId: "u-cond-1" }, r, HOY);
    expect(ambos.volumenEntregado).toBeLessThanOrEqual(Math.min(vend.volumenEntregado, cond.volumenEntregado) + 1e-9);
  });

  it("cuentas por cobrar: pagado + saldos por estado = facturado", () => {
    const ventas = ventasEnPeriodo(d, f, r);
    const c = cuentasPorCobrar(d, ventas, HOY);
    const suma = c.pagado + c.pendiente.monto + c.parcial.monto + c.vencido.monto;
    expect(suma).toBe(c.facturado);
    expect(c.facturadoNeto + c.iva).toBe(c.facturado);
    expect(c.vencido.n).toBeGreaterThan(0);
  });

  it("la variación no se calcula sin base comparable", () => {
    expect(variacionPct(10, 0)).toBeNull();
    expect(variacionPct(null, 5)).toBeNull();
    expect(variacionPct(150, 100)).toBe(50);
  });
});

describe("rendimientos de combustible", () => {
  it("excluye distancias en cero, lecturas inconsistentes y registros sin combustible", () => {
    const base = datos();
    const cam = base.despachos.filter((x) => x.vehiculoId === "veh-cam-02" && x.estado === "finalizado");
    const [a, b, c, e] = cam;
    const manipulados = [
      { ...a, lecturaInicial: 1000, lecturaFinal: 1100, combustibleConsumidoL: 40 }, // válido: 100 km, 40 L
      { ...b, lecturaInicial: 2000, lecturaFinal: 2000, combustibleConsumidoL: 80 }, // 0 km → excluido
      { ...c, lecturaInicial: 3000, lecturaFinal: 2900, combustibleConsumidoL: 80 }, // inconsistente → excluido
      { ...e, lecturaInicial: 4000, lecturaFinal: 4100, combustibleConsumidoL: undefined }, // sin combustible
    ];
    const res = resumenFlota(base, manipulados);
    expect(res.l100km).toBe(40);
    expect(res.km).toBe(200); // los km válidos incluyen el registro sin combustible
    expect(res.kmParaRendimiento).toBe(100);
    expect(res.litrosConsumidos).toBe(40 + 80 + 80);
    expect(trabajoDespacho(base, manipulados[1]).valida).toBe(false);
  });

  it("sin datos válidos el rendimiento es null (nunca 0)", () => {
    expect(resumenFlota(datos(), []).l100km).toBeNull();
    expect(resumenFlota(datos(), []).lh).toBeNull();
  });

  it("camiones (L/100 km) y máquinas (L/h) se calculan por separado", () => {
    const d = datos();
    const act = actividadFlota(d, { preset: "anio" }, rangoDePreset("anio", HOY));
    for (const a of act) {
      if (a.medidor === "km") expect(a.lh).toBeNull();
      else expect(a.l100km).toBeNull();
    }
    expect(act.find((a) => a.codigo === "MAQ-01")?.lh).not.toBeNull();
    expect(act.find((a) => a.codigo === "CAM-01")?.l100km).not.toBeNull();
  });
});

describe("alertas", () => {
  it("se derivan de los datos", () => {
    const d = datos();
    const al = generarAlertas(d, HOY);
    const tipos = new Set(al.map((a) => a.tipo));
    for (const t of ["incidencia", "pendiente", "sin_validar", "lectura", "consumo", "revision", "incompleto", "cobranza"] as const) expect(tipos.has(t)).toBe(true);
  });
  it("desaparecen cuando se resuelve la causa", () => {
    const d = datos();
    const sinIncidencia = { ...d, despachos: d.despachos.map((x) => (x.estado === "incidencia" ? { ...x, estado: "anulado" as const } : x)) };
    expect(generarAlertas(d, HOY).some((a) => a.tipo === "incidencia")).toBe(true);
    expect(generarAlertas(sinIncidencia, HOY).some((a) => a.tipo === "incidencia")).toBe(false);
  });
  it("una entrega programada para ayer y no finalizada es retraso", () => {
    const d = datos();
    const prog = d.despachos.find((x) => x.estado === "programado")!;
    const d2 = { ...d, despachos: d.despachos.map((x) => (x.id === prog.id ? { ...x, fecha: addDays(HOY, -2) } : x)) };
    expect(generarAlertas(d2, HOY).some((a) => a.tipo === "retraso")).toBe(true);
  });
});
