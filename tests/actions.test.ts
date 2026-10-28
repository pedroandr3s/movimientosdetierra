import { describe, expect, it } from "vitest";
import { ADMIN, AHORA, CONDUCTOR, CONDUCTOR2, VENDEDOR, VENDEDOR2, datos, ctx, falla, ok, HOY } from "./helpers";
import type { AppData } from "../src/lib/types";
import {
  actualizarConfig,
  anularDespacho,
  anularPago,
  anularVenta,
  anularViaje,
  crearDespacho,
  crearVenta,
  devolverRegistro,
  editarDespacho,
  editarVenta,
  eliminarEntidad,
  finalizarEntregaConductor,
  guardarAvanceConductor,
  guardarCarga,
  guardarEntidad,
  informarIncidencia,
  iniciarEntrega,
  registrarPago,
  registrarViajeAdmin,
  validarRegistro,
} from "../src/lib/actions";
import {
  calcularKpis,
  cobradoVenta,
  estadoComercialVenta,
  estadoPagoVenta,
  idx,
  rangoDePreset,
  ultimaLectura,
  saldoVenta,
  totalesVenta,
  volumenEntregadoVenta,
  volumenPendienteVenta,
} from "../src/lib/calc";
import { generarAlertas } from "../src/lib/alertas";

const ventaInput = (over: Record<string, unknown> = {}) => ({
  clienteId: "c-1",
  faenaId: "f-1",
  materialId: "m-arena",
  cantidadM3: 30,
  precioUnitario: 14000,
  descuentoPct: 0,
  metodoPago: "transferencia",
  fechaEntregaPrevista: "2026-10-28",
  ...over,
});

function nuevaVenta(d: AppData, over: Record<string, unknown> = {}, c = VENDEDOR) {
  const r = ok(crearVenta(d, c, ventaInput(over)));
  return { d: r.data, id: r.id };
}

function nuevoDespacho(d: AppData, ventaId: string, vehiculoId = "veh-cam-02", conductorId = "u-cond-2", volumen = 30) {
  const r = ok(crearDespacho(d, VENDEDOR, { ventaId, fecha: HOY, vehiculoId, conductorId, volumenSolicitadoM3: volumen }));
  return { d: r.data, id: r.id };
}

describe("ventas", () => {
  it("el vendedor crea una venta con totales correctos, IVA 19 % y precio de catálogo congelado", () => {
    const d0 = datos();
    const { d, id } = nuevaVenta(d0);
    const v = idx(d).ventas.get(id)!;
    expect(v.vendedorId).toBe("u-vend-1");
    expect(v.estado).toBe("confirmada");
    expect(v.ivaPct).toBe(19);
    expect(v.precioReferencia).toBe(14000);
    expect(totalesVenta(v).total).toBe(Math.round(30 * 14000 * 1.19));
    expect(v.numero).toBe(`V-${String(d0.ventas.length + 1).padStart(4, "0")}`);
    expect(v.fechaVencimiento).toBe("2026-11-11"); // transferencia: 15 días
    expect(d.cambios.at(-1)?.entidadId).toBe(id);
  });

  it("valida campos con mensajes claros", () => {
    const d = datos();
    expect(falla(crearVenta(d, VENDEDOR, ventaInput({ cantidadM3: 0 }))).campo).toBe("cantidadM3");
    expect(falla(crearVenta(d, VENDEDOR, ventaInput({ cantidadM3: -5 }))).campo).toBe("cantidadM3");
    expect(falla(crearVenta(d, VENDEDOR, ventaInput({ clienteId: "" }))).campo).toBe("clienteId");
    expect(falla(crearVenta(d, VENDEDOR, ventaInput({ faenaId: undefined, referenciaFaena: "" }))).campo).toBe("faenaId");
    expect(falla(crearVenta(d, VENDEDOR, ventaInput({ fechaEntregaPrevista: "2026-10-01" }))).campo).toBe("fechaEntregaPrevista");
    expect(falla(crearVenta(d, VENDEDOR, ventaInput({ metodoPago: "trueque" }))).campo).toBe("metodoPago");
    expect(falla(crearVenta(d, VENDEDOR, ventaInput({ clienteId: "c-8" }))).campo).toBe("clienteId"); // inactivo
  });

  it("el descuento y el precio del vendedor tienen límites; el administrador puede excederlos", () => {
    const d = datos();
    expect(falla(crearVenta(d, VENDEDOR, ventaInput({ descuentoPct: 10 }))).campo).toBe("descuentoPct");
    expect(falla(crearVenta(d, VENDEDOR, ventaInput({ precioUnitario: 20000 }))).campo).toBe("precioUnitario");
    expect(ok(crearVenta(d, VENDEDOR, ventaInput({ descuentoPct: 5, precioUnitario: 14500 }))).ok).toBe(true);
    expect(ok(crearVenta(d, ADMIN, ventaInput({ descuentoPct: 10, precioUnitario: 20000 }))).ok).toBe(true);
  });

  it("cambiar el precio del catálogo no altera ventas históricas ni nuevas ya creadas", () => {
    const { d, id } = nuevaVenta(datos());
    const antes = totalesVenta(idx(d).ventas.get(id)!).total;
    const d2 = ok(guardarEntidad(d, ADMIN, "materiales", { id: "m-arena", nombre: "Arena", unidad: "m³", precioReferencia: 20000, activo: true })).data;
    expect(idx(d2).materiales.get("m-arena")!.precioReferencia).toBe(20000);
    expect(totalesVenta(idx(d2).ventas.get(id)!).total).toBe(antes);
    expect(idx(d2).ventas.get(id)!.precioUnitario).toBe(14000);
    // ventas antiguas intactas
    expect(d2.ventas.slice(0, 5)).toEqual(d.ventas.slice(0, 5));
  });

  it("cambiar el IVA solo afecta a ventas nuevas", () => {
    const d1 = ok(actualizarConfig(datos(), ADMIN, { ivaPct: 10 })).data;
    const { d, id } = nuevaVenta(d1);
    expect(idx(d).ventas.get(id)!.ivaPct).toBe(10);
    expect(d.ventas[0].ivaPct).toBe(19);
  });

  it("un vendedor solo edita sus ventas y solo mientras no tienen despachos ni pagos", () => {
    const { d, id } = nuevaVenta(datos());
    expect(ok(editarVenta(d, VENDEDOR, id, { cantidadM3: 40 })).ok).toBe(true);
    expect(falla(editarVenta(d, VENDEDOR2, id, { cantidadM3: 40 })).error).toMatch(/propias/);
    const conPago = ok(registrarPago(d, VENDEDOR, id, { monto: 1000, metodo: "efectivo" })).data;
    expect(falla(editarVenta(conPago, VENDEDOR, id, { cantidadM3: 40 })).error).toMatch(/pagos/);
    expect(ok(editarVenta(conPago, ADMIN, id, { cantidadM3: 40 })).ok).toBe(true);
  });

  it("no permite bajar la cantidad por debajo de lo despachado, ni el total por debajo de lo cobrado", () => {
    let { d, id } = nuevaVenta(datos());
    ({ d } = nuevoDespacho(d, id, "veh-cam-02", "u-cond-2", 30));
    expect(falla(editarVenta(d, ADMIN, id, { cantidadM3: 20 })).campo).toBe("cantidadM3");
    const pagada = ok(registrarPago(d, ADMIN, id, { monto: totalesVenta(idx(d).ventas.get(id)!).total, metodo: "transferencia" })).data;
    expect(falla(editarVenta(pagada, ADMIN, id, { precioUnitario: 10000 })).error).toMatch(/cobrado/);
  });

  it("no se puede anular una venta con entregas o pagos; con trazabilidad sí", () => {
    let { d, id } = nuevaVenta(datos());
    const conPago = ok(registrarPago(d, ADMIN, id, { monto: 5000, metodo: "efectivo" })).data;
    expect(falla(anularVenta(conPago, ADMIN, id, "Cliente desistió")).error).toMatch(/pagos/);
    expect(falla(anularVenta(d, ADMIN, id, "")).campo).toBe("motivo");
    let desp: string;
    ({ d, id: desp } = nuevoDespacho(d, id));
    const anulada = ok(anularVenta(d, ADMIN, id, "Cliente desistió")).data;
    expect(idx(anulada).ventas.get(id)!.estado).toBe("anulada");
    expect(idx(anulada).despachos.get(desp)!.estado).toBe("anulado");
    expect(estadoComercialVenta(anulada, idx(anulada).ventas.get(id)!)).toBe("anulada");
    expect(anulada.cambios.length).toBeGreaterThan(d.cambios.length);
  });
});

describe("pagos independientes de la entrega", () => {
  it("abonos separados, saldo, sobrepago bloqueado y anulación", () => {
    let { d, id } = nuevaVenta(datos());
    const total = totalesVenta(idx(d).ventas.get(id)!).total;
    expect(estadoPagoVenta(d, idx(d).ventas.get(id)!, HOY)).toBe("pendiente");
    d = ok(registrarPago(d, VENDEDOR, id, { monto: 100000, metodo: "transferencia" })).data;
    expect(estadoPagoVenta(d, idx(d).ventas.get(id)!, HOY)).toBe("parcial");
    expect(saldoVenta(d, idx(d).ventas.get(id)!)).toBe(total - 100000);
    const exceso = falla(registrarPago(d, VENDEDOR, id, { monto: total, metodo: "transferencia" }));
    expect(exceso.campo).toBe("monto");
    expect(falla(registrarPago(d, VENDEDOR, id, { monto: 0, metodo: "efectivo" })).campo).toBe("monto");
    expect(falla(registrarPago(d, VENDEDOR, id, { monto: 100, metodo: "efectivo", fecha: "2026-12-01" })).campo).toBe("fecha");
    d = ok(registrarPago(d, VENDEDOR, id, { monto: total - 100000, metodo: "efectivo" })).data;
    expect(estadoPagoVenta(d, idx(d).ventas.get(id)!, HOY)).toBe("pagada");
    // el estado de entrega no cambió por pagar
    expect(estadoComercialVenta(d, idx(d).ventas.get(id)!)).toBe("confirmada");
    expect(falla(anularPago(d, VENDEDOR, d.pagos.at(-1)!.id, "error de digitación")).error).toMatch(/administrador/);
    d = ok(anularPago(d, ADMIN, d.pagos.at(-1)!.id, "error de digitación")).data;
    expect(estadoPagoVenta(d, idx(d).ventas.get(id)!, HOY)).toBe("parcial");
    expect(cobradoVenta(d, id)).toBe(100000);
  });

  it("entregar no marca como pagada", () => {
    const d = datos();
    const entregadaSinPago = d.ventas.find((v) => estadoComercialVenta(d, v) === "entregada" && cobradoVenta(d, v.id) === 0);
    expect(entregadaSinPago).toBeTruthy();
    expect(estadoPagoVenta(d, entregadaSinPago!, HOY)).not.toBe("pagada");
  });

  it("vence cuando pasa la fecha de vencimiento con saldo", () => {
    const d = datos();
    const v = d.ventas.find((x) => x.fechaVencimiento && x.fechaVencimiento < HOY && saldoVenta(d, x) > 0)!;
    expect(estadoPagoVenta(d, v, HOY)).toBe("vencida");
  });
});

describe("despachos", () => {
  it("exige venta confirmada, vehículo disponible y respeta el volumen pendiente", () => {
    let { d, id } = nuevaVenta(datos());
    expect(falla(crearDespacho(d, VENDEDOR, { ventaId: id, fecha: HOY, vehiculoId: "veh-cam-03", conductorId: "u-cond-3", volumenSolicitadoM3: 10 })).codigo).toBe("vehiculo");
    expect(falla(crearDespacho(d, VENDEDOR, { ventaId: id, fecha: HOY, vehiculoId: "veh-cam-03", conductorId: "u-cond-3", volumenSolicitadoM3: 10 }, { autorizarVehiculo: true })).codigo).toBe("vehiculo"); // un vendedor no autoriza
    expect(ok(crearDespacho(d, ADMIN, { ventaId: id, fecha: HOY, vehiculoId: "veh-cam-03", conductorId: "u-cond-3", volumenSolicitadoM3: 10 }, { autorizarVehiculo: true })).ok).toBe(true);
    const e = falla(crearDespacho(d, VENDEDOR, { ventaId: id, fecha: HOY, vehiculoId: "veh-cam-02", conductorId: "u-cond-2", volumenSolicitadoM3: 35 }));
    expect(e.codigo).toBe("exceso");
    expect(ok(crearDespacho(d, ADMIN, { ventaId: id, fecha: HOY, vehiculoId: "veh-cam-02", conductorId: "u-cond-2", volumenSolicitadoM3: 35 }, { autorizarExceso: true })).ok).toBe(true);
    const borrador = ok(crearVenta(d, VENDEDOR, ventaInput({ estado: "borrador" })));
    expect(falla(crearDespacho(borrador.data, VENDEDOR, { ventaId: borrador.id, fecha: HOY, vehiculoId: "veh-cam-02", conductorId: "u-cond-2", volumenSolicitadoM3: 10 })).error).toMatch(/confirmada/);
    // un vendedor no despacha ventas ajenas
    expect(falla(crearDespacho(d, VENDEDOR2, { ventaId: id, fecha: HOY, vehiculoId: "veh-cam-02", conductorId: "u-cond-2", volumenSolicitadoM3: 10 })).error).toMatch(/propias/);
    // camión tolva tiene 3 viajes planificados para 30 m³ (14 m³ cada uno)
    ({ d } = nuevoDespacho(d, id));
    expect(d.despachos.at(-1)!.viajesPlanificados).toBe(3);
    expect(d.despachos.at(-1)!.estado).toBe("programado");
  });

  it("una operación sin venta solo la registra el administrador y con motivo", () => {
    const d = datos();
    const base = { fecha: HOY, vehiculoId: "veh-cam-02", conductorId: "u-cond-2", volumenSolicitadoM3: 10, materialId: "m-grava" };
    expect(falla(crearDespacho(d, VENDEDOR, { ...base, motivoIndependiente: "traslado interno" })).error).toMatch(/administrador/);
    expect(falla(crearDespacho(d, ADMIN, base)).campo).toBe("motivoIndependiente");
    expect(ok(crearDespacho(d, ADMIN, { ...base, motivoIndependiente: "Traslado interno entre patios" })).ok).toBe(true);
  });
});

describe("flujo completo: venta → despacho → viajes → entrega → indicadores", () => {
  const completo = (d: AppData, despachoId: string, viajes: number[], extra: Record<string, unknown> = {}) =>
    finalizarEntregaConductor(d, CONDUCTOR2, despachoId, {
      lecturaInicial: undefined,
      lecturaFinal: undefined,
      combustibleConsumidoL: 42,
      viajes: viajes.map((cantidadM3) => ({ cantidadM3 })),
      confirmaNombre: "Jaime Contreras",
      ...extra,
    });

  it("una entrega parcial no aparece como completa y la completa sí", () => {
    const base = datos();
    const kpi0 = calcularKpis(base, { preset: "hoy" }, rangoDePreset("hoy", HOY), HOY);
    let { d, id } = nuevaVenta(base);
    let desp: string;
    ({ d, id: desp } = nuevoDespacho(d, id));
    const inicio = ultimaLectura(d, "veh-cam-02");

    d = ok(iniciarEntrega(d, CONDUCTOR2, desp)).data;
    expect(idx(d).despachos.get(desp)!.estado).toBe("en_curso");
    expect(idx(d).vehiculos.get("veh-cam-02")!.estado).toBe("en_operacion");
    expect(estadoComercialVenta(d, idx(d).ventas.get(id)!)).toBe("en_despacho");

    // guardar avance con 2 viajes de 14 (28 de 30)
    d = ok(guardarAvanceConductor(d, CONDUCTOR2, desp, { lecturaInicial: inicio, viajes: [{ cantidadM3: 14 }, { cantidadM3: 14 }] })).data;
    expect(estadoComercialVenta(d, idx(d).ventas.get(id)!)).toBe("parcial");
    expect(volumenEntregadoVenta(d, id)).toBe(28);
    expect(volumenPendienteVenta(d, idx(d).ventas.get(id)!)).toBe(2);

    // finalizar con solo 28 m³: sigue siendo parcial (la entrega no está "completa")
    const parcial = ok(completo(d, desp, [14, 14], { lecturaInicial: inicio, lecturaFinal: inicio + 60 })).data;
    expect(idx(parcial).despachos.get(desp)!.estado).toBe("finalizado");
    expect(estadoComercialVenta(parcial, idx(parcial).ventas.get(id)!)).toBe("parcial");

    // completar los 30 m³ → entregada
    const total = ok(completo(d, desp, [14, 14, 2], { lecturaInicial: inicio, lecturaFinal: inicio + 60 }));
    expect(estadoComercialVenta(total.data, idx(total.data).ventas.get(id)!)).toBe("entregada");
    expect(total.numeroRegistro).toMatch(/^R-/);
    const dsp = idx(total.data).despachos.get(desp)!;
    expect(dsp.conformidad?.nombre).toBe("Jaime Contreras");
    expect(dsp.registroDiarioId).toBeTruthy();
    expect(idx(total.data).vehiculos.get("veh-cam-02")!.estado).toBe("disponible");
    // aún sin cobrar: estados independientes
    expect(estadoPagoVenta(total.data, idx(total.data).ventas.get(id)!, HOY)).toBe("pendiente");
    // los indicadores del día reflejan el cambio sin duplicar viajes
    const kpi1 = calcularKpis(total.data, { preset: "hoy" }, rangoDePreset("hoy", HOY), HOY);
    expect(kpi1.volumenEntregado - kpi0.volumenEntregado).toBe(30);
    expect(kpi1.combustibleConsumido - kpi0.combustibleConsumido).toBe(42);
    expect(kpi1.kmFlota - kpi0.kmFlota).toBe(60);
    expect(kpi1.nVentas - kpi0.nVentas).toBe(1);
  });

  it("guardar el avance dos veces no duplica los viajes", () => {
    let { d, id } = nuevaVenta(datos());
    let desp: string;
    ({ d, id: desp } = nuevoDespacho(d, id));
    d = ok(guardarAvanceConductor(d, CONDUCTOR2, desp, { viajes: [{ cantidadM3: 14 }] })).data;
    const viaje = d.viajes.at(-1)!;
    d = ok(guardarAvanceConductor(d, CONDUCTOR2, desp, { viajes: [{ id: viaje.id, cantidadM3: 14 }, { cantidadM3: 10 }] })).data;
    d = ok(guardarAvanceConductor(d, CONDUCTOR2, desp, { viajes: [{ id: viaje.id, cantidadM3: 14 }, { id: d.viajes.at(-1)!.id, cantidadM3: 10 }] })).data;
    expect(d.viajes.filter((v) => v.despachoId === desp && v.estado === "valido").length).toBe(2);
    expect(volumenEntregadoVenta(d, id)).toBe(24);
    // quitar un viaje lo anula (no se borra la evidencia)
    d = ok(guardarAvanceConductor(d, CONDUCTOR2, desp, { viajes: [{ id: viaje.id, cantidadM3: 14 }] })).data;
    expect(volumenEntregadoVenta(d, id)).toBe(14);
    expect(d.viajes.filter((v) => v.despachoId === desp).length).toBe(2);
    expect(d.viajes.filter((v) => v.despachoId === desp && v.estado === "anulado").length).toBe(1);
  });

  it("al finalizar informa el dato exacto que falta", () => {
    let { d, id } = nuevaVenta(datos());
    let desp: string;
    ({ d, id: desp } = nuevoDespacho(d, id));
    const inicio = ultimaLectura(d, "veh-cam-02");
    const base = { lecturaInicial: inicio, lecturaFinal: inicio + 40, combustibleConsumidoL: 30, viajes: [{ cantidadM3: 14 }], confirmaNombre: "Jaime Contreras" };
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, viajes: [] })).error).toMatch(/viajes/);
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, lecturaInicial: null })).error).toMatch(/kilometraje inicial/);
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, lecturaFinal: null })).error).toMatch(/kilometraje final/);
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, combustibleConsumidoL: null })).error).toMatch(/combustible/);
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, confirmaNombre: "" })).error).toMatch(/confirmar/);
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, lecturaFinal: inicio - 5 })).campo).toBe("lecturaFinal");
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, lecturaFinal: inicio })).campo).toBe("lecturaFinal");
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, combustibleConsumidoL: -3 })).campo).toBe("combustibleConsumidoL");
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, viajes: [{ cantidadM3: -2 }] })).campo).toBe("viajes");
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, viajes: [{ cantidadM3: 20 }] })).error).toMatch(/capacidad/);
    expect(falla(finalizarEntregaConductor(d, CONDUCTOR2, desp, { ...base, lecturaInicial: inicio - 100 })).campo).toBe("lecturaInicial");
  });

  it("no se puede entregar más de lo vendido sin autorización explícita del administrador", () => {
    let { d, id } = nuevaVenta(datos(), { cantidadM3: 20 });
    let desp: string;
    ({ d, id: desp } = nuevoDespacho(d, id, "veh-cam-02", "u-cond-2", 20));
    const e = falla(guardarAvanceConductor(d, CONDUCTOR2, desp, { viajes: [{ cantidadM3: 14 }, { cantidadM3: 14 }] }));
    expect(e.codigo).toBe("exceso");
    // el administrador puede registrar el exceso de forma explícita y trazable
    d = ok(guardarAvanceConductor(d, CONDUCTOR2, desp, { viajes: [{ cantidadM3: 14 }, { cantidadM3: 6 }] })).data;
    const dd = falla(registrarViajeAdmin(d, ADMIN, desp, { cantidadM3: 5 }));
    expect(dd.codigo).toBe("exceso");
    d = ok(registrarViajeAdmin(d, ADMIN, desp, { cantidadM3: 5 }, { autorizarExceso: true })).data;
    expect(d.viajes.at(-1)!.autorizadoExceso).toBe(true);
    expect(estadoComercialVenta(d, idx(d).ventas.get(id)!)).toBe("entregada");
    expect(generarAlertas(d, HOY).some((a) => a.tipo === "exceso" && a.id === `exc-${id}`)).toBe(true);
  });

  it("combustible cargado y consumido son datos distintos", () => {
    let { d, id } = nuevaVenta(datos());
    let desp: string;
    ({ d, id: desp } = nuevoDespacho(d, id));
    const inicio = ultimaLectura(d, "veh-cam-02");
    const antes = d.cargas.length;
    d = ok(guardarAvanceConductor(d, CONDUCTOR2, desp, { lecturaInicial: inicio, combustibleCargadoL: 150, combustibleConsumidoL: 35 })).data;
    expect(d.cargas.length).toBe(antes + 1);
    expect(d.cargas.at(-1)!.litros).toBe(150);
    expect(idx(d).despachos.get(desp)!.combustibleConsumidoL).toBe(35);
    d = ok(guardarAvanceConductor(d, CONDUCTOR2, desp, { combustibleCargadoL: 180 })).data;
    expect(d.cargas.length).toBe(antes + 1);
    expect(d.cargas.at(-1)!.litros).toBe(180);
    expect(idx(d).despachos.get(desp)!.combustibleConsumidoL).toBe(35);
  });

  it("anular un viaje o un despacho recalcula cantidades y estados", () => {
    let { d, id } = nuevaVenta(datos(), { cantidadM3: 28 });
    let desp: string;
    ({ d, id: desp } = nuevoDespacho(d, id, "veh-cam-02", "u-cond-2", 28));
    const inicio = ultimaLectura(d, "veh-cam-02");
    d = ok(finalizarEntregaConductor(d, CONDUCTOR2, desp, { lecturaInicial: inicio, lecturaFinal: inicio + 40, combustibleConsumidoL: 20, viajes: [{ cantidadM3: 14 }, { cantidadM3: 14 }], confirmaNombre: "J" })).data;
    expect(estadoComercialVenta(d, idx(d).ventas.get(id)!)).toBe("entregada");
    const kpiAntes = calcularKpis(d, { preset: "hoy" }, rangoDePreset("hoy", HOY), HOY).volumenEntregado;
    const viaje = d.viajes.filter((v) => v.despachoId === desp)[0];
    expect(falla(anularViaje(d, VENDEDOR, viaje.id, "carga rechazada")).error).toMatch(/administrador/);
    expect(falla(anularViaje(d, ADMIN, viaje.id, "")).campo).toBe("motivo");
    d = ok(anularViaje(d, ADMIN, viaje.id, "carga rechazada por el cliente")).data;
    expect(volumenEntregadoVenta(d, id)).toBe(14);
    expect(estadoComercialVenta(d, idx(d).ventas.get(id)!)).toBe("parcial");
    expect(calcularKpis(d, { preset: "hoy" }, rangoDePreset("hoy", HOY), HOY).volumenEntregado).toBe(kpiAntes - 14);
    d = ok(anularDespacho(d, ADMIN, desp, "despacho cargado por error")).data;
    expect(volumenEntregadoVenta(d, id)).toBe(0);
    expect(estadoComercialVenta(d, idx(d).ventas.get(id)!)).toBe("confirmada");
    expect(d.viajes.filter((v) => v.despachoId === desp).length).toBe(2); // la evidencia se conserva
    expect(idx(d).despachos.get(desp)!.motivoAnulacion).toBeTruthy();
  });

  it("validar el registro actualiza la lectura del vehículo sin retroceder", () => {
    let { d, id } = nuevaVenta(datos(), { cantidadM3: 14 });
    let desp: string;
    ({ d, id: desp } = nuevoDespacho(d, id, "veh-cam-02", "u-cond-2", 14));
    const actualOriginal = idx(d).vehiculos.get("veh-cam-02")!.lecturaActual;
    const antes = ultimaLectura(d, "veh-cam-02");
    const r = ok(finalizarEntregaConductor(d, CONDUCTOR2, desp, { lecturaInicial: antes, lecturaFinal: antes + 33, combustibleConsumidoL: 14, viajes: [{ cantidadM3: 14 }], confirmaNombre: "J" }));
    d = r.data;
    const reg = d.registros.find((x) => x.numero === r.numeroRegistro)!;
    expect(reg.estado).toBe("pendiente");
    expect(idx(d).vehiculos.get("veh-cam-02")!.lecturaActual).toBe(actualOriginal); // aún no aprobado
    expect(falla(validarRegistro(d, VENDEDOR, reg.id)).error).toMatch(/administrador/);
    expect(falla(devolverRegistro(d, ADMIN, reg.id, "")).campo).toBe("comentario");
    d = ok(validarRegistro(d, ADMIN, reg.id)).data;
    expect(idx(d).vehiculos.get("veh-cam-02")!.lecturaActual).toBe(antes + 33);
    expect(d.registros.find((x) => x.id === reg.id)!.estado).toBe("validado");
    expect(d.registros.find((x) => x.id === reg.id)!.validaciones.at(-1)!.userId).toBe("u-admin");
    // corregir un registro validado exige motivo, queda trazado y vuelve a pendiente
    expect(falla(editarDespacho(d, ADMIN, desp, { combustibleConsumidoL: 18 })).campo).toBe("motivo");
    d = ok(editarDespacho(d, ADMIN, desp, { combustibleConsumidoL: 18 }, { motivo: "El conductor se equivocó al anotar los litros" })).data;
    const regDespues = d.registros.find((x) => x.id === reg.id)!;
    expect(regDespues.estado).toBe("pendiente");
    expect(regDespues.validaciones.at(-1)!.accion).toBe("reabierto");
    expect(regDespues.validaciones.at(-1)!.comentario).toMatch(/litros/);
    // devolver y que el conductor corrija
    d = ok(devolverRegistro(d, ADMIN, reg.id, "Falta confirmar combustible")).data;
    expect(d.registros.find((x) => x.id === reg.id)!.estado).toBe("devuelto");
  });

  it("informar una incidencia deja la entrega visible para el administrador", () => {
    let { d, id } = nuevaVenta(datos());
    let desp: string;
    ({ d, id: desp } = nuevoDespacho(d, id));
    expect(falla(informarIncidencia(d, CONDUCTOR2, desp, {})).campo).toBe("incidencia");
    d = ok(informarIncidencia(d, CONDUCTOR2, desp, { incidencia: "Neumático pinchado" })).data;
    expect(idx(d).despachos.get(desp)!.estado).toBe("incidencia");
    expect(generarAlertas(d, HOY).some((a) => a.tipo === "incidencia" && a.id === `inc-${desp}`)).toBe(true);
  });

  it("un conductor solo opera sus propias entregas", () => {
    let { d, id } = nuevaVenta(datos());
    let desp: string;
    ({ d, id: desp } = nuevoDespacho(d, id));
    expect(falla(iniciarEntrega(d, CONDUCTOR, desp)).error).toMatch(/no está asignada/);
    expect(falla(guardarAvanceConductor(d, CONDUCTOR, desp, { viajes: [{ cantidadM3: 10 }] })).error).toMatch(/no está asignada/);
    expect(falla(guardarAvanceConductor(d, VENDEDOR, desp, { viajes: [{ cantidadM3: 10 }] })).error).toMatch(/permiso/);
  });
});

describe("permisos y catálogos", () => {
  it("las acciones respetan el rol", () => {
    const d = datos();
    expect(falla(crearVenta(d, CONDUCTOR, ventaInput())).error).toMatch(/permiso/);
    expect(falla(guardarEntidad(d, VENDEDOR, "materiales", { id: "m-arena", nombre: "Arena", precioReferencia: 1, unidad: "m³" })).error).toMatch(/permiso/);
    expect(falla(guardarEntidad(d, VENDEDOR, "vehiculos", { id: "veh-cam-01", codigo: "CAM-01", tipo: "camion", medidor: "km", capacidadM3: 12, lecturaActual: 1 })).error).toMatch(/permiso/);
    expect(falla(guardarCarga(d, VENDEDOR, { fecha: HOY, vehiculoId: "veh-cam-01", litros: 10 })).error).toMatch(/administrador/);
    expect(falla(actualizarConfig(d, VENDEDOR, { ivaPct: 5 })).error).toMatch(/administrador/);
    expect(ok(guardarEntidad(d, VENDEDOR, "clientes", { nombre: "Cliente Nuevo Demo", activo: true })).ok).toBe(true);
  });

  it("no se elimina lo que tiene historial; se desactiva", () => {
    const d = datos();
    expect(falla(eliminarEntidad(d, ADMIN, "clientes", "c-1")).error).toMatch(/Desactívalo/);
    const nuevo = ok(guardarEntidad(d, ADMIN, "clientes", { nombre: "Cliente sin historial", activo: true }));
    expect(ok(eliminarEntidad(nuevo.data, ADMIN, "clientes", nuevo.id)).ok).toBe(true);
    expect(falla(eliminarEntidad(d, ADMIN, "usuarios", "u-admin")).error).toMatch(/propio/);
  });

  it("la lectura del vehículo no puede retroceder y los datos del catálogo se validan", () => {
    const d = datos();
    const v = idx(d).vehiculos.get("veh-cam-01")!;
    expect(falla(guardarEntidad(d, ADMIN, "vehiculos", { ...v, lecturaActual: v.lecturaActual - 500 })).campo).toBe("lecturaActual");
    expect(falla(guardarEntidad(d, ADMIN, "vehiculos", { ...v, codigo: "CAM-02" })).campo).toBe("codigo");
    expect(falla(guardarEntidad(d, ADMIN, "clientes", { nombre: "", activo: true })).campo).toBe("nombre");
    expect(falla(guardarEntidad(d, ADMIN, "clientes", { nombre: "X", email: "no-es-correo", activo: true })).campo).toBe("email");
    expect(falla(guardarEntidad(d, ADMIN, "materiales", { nombre: "Arena", precioReferencia: 100, unidad: "m³" })).campo).toBe("nombre");
    expect(falla(guardarEntidad(d, ADMIN, "materiales", { nombre: "Nuevo", precioReferencia: -1, unidad: "m³" })).campo).toBe("precioReferencia");
  });

  it("la configuración se valida", () => {
    const d = datos();
    expect(falla(actualizarConfig(d, ADMIN, { ivaPct: 150 })).campo).toBe("ivaPct");
    expect(falla(actualizarConfig(d, ADMIN, { umbrales: { consumoMaxCamionL100km: 0 } })).error).toMatch(/umbrales/);
    expect(ok(actualizarConfig(d, ADMIN, { umbrales: { consumoMaxCamionL100km: 70 } })).data.config.umbrales.consumoMaxCamionL100km).toBe(70);
  });

  it("el historial registra quién, cuándo y qué", () => {
    const d = datos();
    const { d: d2, id } = nuevaVenta(d);
    const c = d2.cambios.at(-1)!;
    expect(c.userId).toBe("u-vend-1");
    expect(c.fecha).toBe(AHORA);
    expect(c.entidad).toBe("venta");
    expect(c.entidadId).toBe(id);
    expect(ctx("u-admin").hoy).toBe(HOY);
  });
});
