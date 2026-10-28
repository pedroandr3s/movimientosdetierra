import { describe, expect, it } from "vitest";
import { datos, HOY } from "./helpers";
import { generarDatosDemo } from "../src/lib/seed";
import { validarEstructura, importarJSON, exportarJSON } from "../src/lib/persist";
import {
  cobradoVenta,
  estadoComercialVenta,
  estadoPagoVenta,
  totalesVenta,
  trabajoDespacho,
  viajesDeDespacho,
  volumenEntregadoDespacho,
  volumenEntregadoVenta,
} from "../src/lib/calc";

describe("datos de demostración", () => {
  it("son deterministas: misma fecha, mismos datos", () => {
    expect(JSON.stringify(generarDatosDemo(HOY))).toBe(JSON.stringify(generarDatosDemo(HOY)));
  });

  it("cumplen los mínimos pedidos", () => {
    const d = datos();
    expect(d.usuarios.filter((u) => u.rol === "admin").length).toBeGreaterThanOrEqual(1);
    expect(d.usuarios.filter((u) => u.rol === "vendedor").length).toBeGreaterThanOrEqual(2);
    expect(d.usuarios.filter((u) => u.rol === "conductor").length).toBeGreaterThanOrEqual(4);
    expect(d.clientes.length).toBeGreaterThanOrEqual(5);
    expect(d.vehiculos.length).toBeGreaterThanOrEqual(5);
    expect(d.materiales.map((m) => m.nombre)).toEqual(["Arena", "Grava", "Estabilizado", "Otro material"]);
    expect(d.faenas.length).toBeGreaterThanOrEqual(6);
    expect(d.ventas.length).toBeGreaterThanOrEqual(30);
    expect(d.viajes.length).toBeGreaterThanOrEqual(40);
  });

  it("incluye variedad de estados de venta, entrega y pago", () => {
    const d = datos();
    const pagos = new Set(d.ventas.map((v) => estadoPagoVenta(d, v, HOY)));
    expect(pagos.has("pagada")).toBe(true);
    expect(pagos.has("pendiente")).toBe(true);
    expect(pagos.has("parcial")).toBe(true);
    expect(pagos.has("vencida")).toBe(true);
    const ent = new Set(d.ventas.map((v) => estadoComercialVenta(d, v)));
    for (const e of ["entregada", "parcial", "en_despacho", "confirmada", "borrador", "anulada"] as const) expect(ent.has(e)).toBe(true);
    expect(d.registros.some((r) => r.estado === "pendiente")).toBe(true);
    expect(d.registros.some((r) => r.estado === "validado")).toBe(true);
    expect(d.registros.some((r) => r.estado === "devuelto")).toBe(true);
    expect(d.despachos.some((x) => x.estado === "incidencia")).toBe(true);
  });

  it("es coherente: nada entregado sobre lo vendido ni cobrado sobre lo facturado", () => {
    const d = datos();
    for (const v of d.ventas) {
      expect(volumenEntregadoVenta(d, v.id)).toBeLessThanOrEqual(v.cantidadM3 + 1e-9);
      expect(cobradoVenta(d, v.id)).toBeLessThanOrEqual(totalesVenta(v).total);
    }
  });

  it("todas las referencias existen (sin conductores ni vehículos inexistentes)", () => {
    const d = datos();
    expect(validarEstructura(JSON.parse(JSON.stringify(d))).ok).toBe(true);
  });

  it("los viajes no superan la capacidad del camión y cierran con lo despachado", () => {
    const d = datos();
    for (const v of d.viajes) {
      const cap = d.vehiculos.find((x) => x.id === v.vehiculoId)?.capacidadM3 ?? 0;
      expect(v.cantidadM3).toBeLessThanOrEqual(cap + 1e-9);
    }
    for (const x of d.despachos.filter((q) => q.estado === "finalizado" && q.tipo === "transporte" && q.ventaId)) {
      const entregado = volumenEntregadoDespacho(d, x.id);
      const esParcial = x.volumenSolicitadoM3 - entregado > 1e-9;
      if (!esParcial) expect(entregado).toBeCloseTo(x.volumenSolicitadoM3, 6);
    }
  });

  it("las lecturas válidas son crecientes por vehículo", () => {
    const d = datos();
    for (const veh of d.vehiculos) {
      let prev = -Infinity;
      for (const x of d.despachos.filter((q) => q.vehiculoId === veh.id && q.lecturaInicial != null)) {
        expect(x.lecturaInicial!).toBeGreaterThanOrEqual(prev - 1e-6);
        const t = trabajoDespacho(d, x);
        prev = t.valida ? (x.lecturaFinal as number) : x.lecturaInicial!;
      }
    }
  });

  it("hay un registro con lectura inconsistente y otro con combustible incompleto, excluidos de rendimientos", () => {
    const d = datos();
    const motivos = d.despachos.filter((x) => x.estado === "finalizado").map((x) => trabajoDespacho(d, x).motivo);
    expect(motivos).toContain("inconsistente");
    expect(d.despachos.some((x) => x.estado === "finalizado" && x.combustibleConsumidoL == null)).toBe(true);
  });

  it("las ventas históricas conservan su precio aunque el catálogo sea distinto", () => {
    const d = datos();
    const antigua = d.ventas[0];
    const material = d.materiales.find((m) => m.id === antigua.materialId)!;
    expect(antigua.precioReferencia).toBeLessThan(material.precioReferencia);
  });

  it("los despachos cerrados tienen viajes válidos asociados y los pendientes no", () => {
    const d = datos();
    for (const x of d.despachos) {
      const n = viajesDeDespacho(d, x.id).length;
      if (x.estado === "programado") expect(n).toBe(0);
      if (x.estado === "finalizado" && x.tipo === "transporte") expect(n).toBeGreaterThan(0);
    }
  });
});

describe("exportar e importar", () => {
  it("round-trip conserva los datos", () => {
    const d = datos();
    const txt = exportarJSON(d, "2026-10-27T12:00");
    const r = importarJSON(txt);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.ventas.length).toBe(d.ventas.length);
  });

  it("rechaza archivos inválidos con un mensaje claro", () => {
    expect(importarJSON("no es json").ok).toBe(false);
    expect(importarJSON(JSON.stringify({ hola: 1 })).ok).toBe(false);
    const d = datos();
    const roto = JSON.parse(exportarJSON(d, "x"));
    roto.despachos[0].vehiculoId = "no-existe";
    const r = importarJSON(JSON.stringify(roto));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/vehículo/);
    const sinLista = JSON.parse(exportarJSON(d, "x"));
    delete sinLista.ventas;
    expect(importarJSON(JSON.stringify(sinLista)).ok).toBe(false);
  });
});
