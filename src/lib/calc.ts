/**
 * Lógica de cálculo reutilizable: totales, estados derivados, filtros, indicadores y series.
 * Es la ÚNICA fuente de fórmulas comerciales y operacionales (ver docs/FORMULAS.md).
 * Todas las funciones son puras: reciben `AppData` y devuelven valores.
 */
import type {
  AppData,
  Cliente,
  Despacho,
  EstadoComercial,
  EstadoDespacho,
  EstadoPago,
  Faena,
  ISODate,
  Material,
  Medidor,
  Pago,
  Usuario,
  Vehiculo,
  Venta,
  Viaje,
} from "./types";
import { addDays, addMonths, diffDays, fechaDe, finMes, inicioAnio, inicioMes } from "./fecha";
import { fechaCortaDia, mesCorto } from "./formato";

/* ================================================================== */
/* Índices                                                              */
/* ================================================================== */

export interface Idx {
  usuarios: Map<string, Usuario>;
  clientes: Map<string, Cliente>;
  faenas: Map<string, Faena>;
  vehiculos: Map<string, Vehiculo>;
  materiales: Map<string, Material>;
  ventas: Map<string, Venta>;
  despachos: Map<string, Despacho>;
  viajesPorDespacho: Map<string, Viaje[]>;
  despachosPorVenta: Map<string, Despacho[]>;
  pagosPorVenta: Map<string, Pago[]>;
}

const cacheIdx = new WeakMap<AppData, Idx>();

function mapa<T extends { id: string }>(arr: T[]): Map<string, T> {
  return new Map(arr.map((x) => [x.id, x]));
}

export function idx(data: AppData): Idx {
  const hit = cacheIdx.get(data);
  if (hit) return hit;
  const viajesPorDespacho = new Map<string, Viaje[]>();
  for (const v of data.viajes) {
    const l = viajesPorDespacho.get(v.despachoId);
    if (l) l.push(v);
    else viajesPorDespacho.set(v.despachoId, [v]);
  }
  const despachosPorVenta = new Map<string, Despacho[]>();
  for (const d of data.despachos) {
    if (!d.ventaId) continue;
    const l = despachosPorVenta.get(d.ventaId);
    if (l) l.push(d);
    else despachosPorVenta.set(d.ventaId, [d]);
  }
  const pagosPorVenta = new Map<string, Pago[]>();
  for (const p of data.pagos) {
    const l = pagosPorVenta.get(p.ventaId);
    if (l) l.push(p);
    else pagosPorVenta.set(p.ventaId, [p]);
  }
  const r: Idx = {
    usuarios: mapa(data.usuarios),
    clientes: mapa(data.clientes),
    faenas: mapa(data.faenas),
    vehiculos: mapa(data.vehiculos),
    materiales: mapa(data.materiales),
    ventas: mapa(data.ventas),
    despachos: mapa(data.despachos),
    viajesPorDespacho,
    despachosPorVenta,
    pagosPorVenta,
  };
  cacheIdx.set(data, r);
  return r;
}

/** Nombre legible de una entidad o un guion si no existe. */
export const nombreDe = {
  usuario: (d: AppData, id?: string) => (id ? idx(d).usuarios.get(id)?.nombre : undefined) ?? "—",
  cliente: (d: AppData, id?: string) => (id ? idx(d).clientes.get(id)?.nombre : undefined) ?? "—",
  faena: (d: AppData, id?: string) => (id ? idx(d).faenas.get(id)?.nombre : undefined) ?? "—",
  material: (d: AppData, id?: string) => (id ? idx(d).materiales.get(id)?.nombre : undefined) ?? "—",
  vehiculo: (d: AppData, id?: string) => (id ? idx(d).vehiculos.get(id)?.codigo : undefined) ?? "—",
};

/** Destino legible de una venta (faena del catálogo o referencia escrita). */
export function destinoVenta(d: AppData, v: Venta): string {
  if (v.faenaId) return nombreDe.faena(d, v.faenaId);
  return v.referenciaFaena || "—";
}

export function destinoDespacho(d: AppData, x: Despacho): string {
  if (x.faenaId) return nombreDe.faena(d, x.faenaId);
  if (x.referenciaDestino) return x.referenciaDestino;
  if (x.ventaId) {
    const v = idx(d).ventas.get(x.ventaId);
    if (v) return destinoVenta(d, v);
  }
  return "—";
}

/* ================================================================== */
/* Totales de venta (IVA y descuentos)                                  */
/* ================================================================== */

export interface TotalesVenta {
  /** cantidad × precio unitario neto */
  brutoSinDescuento: number;
  descuento: number;
  /** Subtotal neto (sin IVA) tras descuento */
  neto: number;
  iva: number;
  /** Total con IVA: importe que se cobra al cliente */
  total: number;
}

export function totalesVenta(
  v: Pick<Venta, "cantidadM3" | "precioUnitario" | "descuentoPct" | "ivaPct">,
): TotalesVenta {
  const brutoSinDescuento = Math.round(v.cantidadM3 * v.precioUnitario);
  const descuento = Math.round((brutoSinDescuento * (v.descuentoPct || 0)) / 100);
  const neto = brutoSinDescuento - descuento;
  const iva = Math.round((neto * (v.ivaPct || 0)) / 100);
  return { brutoSinDescuento, descuento, neto, iva, total: neto + iva };
}

/** Una venta cuenta para indicadores solo si está confirmada (no borrador ni anulada). */
export function ventaValida(v: Venta): boolean {
  return v.estado === "confirmada";
}

/* ================================================================== */
/* Cantidades                                                           */
/* ================================================================== */

/** Un viaje es efectivo si no está anulado y su despacho no está anulado. */
export function viajeEfectivo(data: AppData, v: Viaje): boolean {
  if (v.estado !== "valido") return false;
  const d = idx(data).despachos.get(v.despachoId);
  return !!d && d.estado !== "anulado";
}

export function viajesEfectivos(data: AppData): Viaje[] {
  return data.viajes.filter((v) => viajeEfectivo(data, v));
}

export function viajesDeDespacho(data: AppData, despachoId: string, soloEfectivos = true): Viaje[] {
  const l = idx(data).viajesPorDespacho.get(despachoId) ?? [];
  const d = idx(data).despachos.get(despachoId);
  const ordenados = [...l].sort((a, b) => a.secuencia - b.secuencia);
  if (!soloEfectivos) return ordenados;
  if (!d || d.estado === "anulado") return [];
  return ordenados.filter((v) => v.estado === "valido");
}

/** Volumen entregado = suma del volumen de los viajes válidos (sin duplicar). */
export function volumenEntregadoDespacho(data: AppData, despachoId: string): number {
  return viajesDeDespacho(data, despachoId).reduce((s, v) => s + v.cantidadM3, 0);
}

export function volumenEntregadoVenta(data: AppData, ventaId: string): number {
  const ds = idx(data).despachosPorVenta.get(ventaId) ?? [];
  return redondear(ds.reduce((s, d) => s + volumenEntregadoDespacho(data, d.id), 0));
}

/** Volumen ya comprometido en despachos no anulados (solicitado). */
export function volumenProgramadoVenta(data: AppData, ventaId: string, excluirDespachoId?: string): number {
  const ds = idx(data).despachosPorVenta.get(ventaId) ?? [];
  return redondear(
    ds.filter((d) => d.estado !== "anulado" && d.id !== excluirDespachoId).reduce((s, d) => s + d.volumenSolicitadoM3, 0),
  );
}

/** Pendiente = vendido − entregado (nunca negativo; el exceso se informa aparte). */
export function volumenPendienteVenta(data: AppData, v: Venta): number {
  if (v.estado !== "confirmada") return 0;
  return Math.max(0, redondear(v.cantidadM3 - volumenEntregadoVenta(data, v.id)));
}

export function excesoVenta(data: AppData, v: Venta): number {
  return Math.max(0, redondear(volumenEntregadoVenta(data, v.id) - v.cantidadM3));
}

/** Estado comercial derivado del avance real (no se puede "forzar" entregada). */
export function estadoComercialVenta(data: AppData, v: Venta): EstadoComercial {
  if (v.estado === "borrador") return "borrador";
  if (v.estado === "anulada") return "anulada";
  const entregado = volumenEntregadoVenta(data, v.id);
  if (entregado > 0 && entregado >= v.cantidadM3 - 1e-9) return "entregada";
  if (entregado > 0) return "parcial";
  const ds = idx(data).despachosPorVenta.get(v.id) ?? [];
  if (ds.some((d) => d.estado !== "anulado")) return "en_despacho";
  return "confirmada";
}

/* ================================================================== */
/* Pagos                                                                */
/* ================================================================== */

export function pagosValidos(data: AppData, ventaId: string): Pago[] {
  return (idx(data).pagosPorVenta.get(ventaId) ?? []).filter((p) => !p.anulado);
}

export function cobradoVenta(data: AppData, ventaId: string): number {
  return pagosValidos(data, ventaId).reduce((s, p) => s + p.monto, 0);
}

export function saldoVenta(data: AppData, v: Venta): number {
  if (v.estado !== "confirmada") return 0;
  return Math.max(0, totalesVenta(v).total - cobradoVenta(data, v.id));
}

/** Estado de pago independiente del estado de entrega. null si la venta no es cobrable. */
export function estadoPagoVenta(data: AppData, v: Venta, hoy: ISODate): EstadoPago | null {
  if (v.estado !== "confirmada") return null;
  const total = totalesVenta(v).total;
  const cobrado = cobradoVenta(data, v.id);
  const saldo = total - cobrado;
  if (total > 0 && saldo <= 0) return "pagada";
  if (v.fechaVencimiento && v.fechaVencimiento < hoy) return "vencida";
  if (cobrado > 0) return "parcial";
  return "pendiente";
}

/* ================================================================== */
/* Periodos y filtros globales                                          */
/* ================================================================== */

export type PresetPeriodo = "hoy" | "7d" | "30d" | "mes" | "mes_anterior" | "anio" | "personalizado";

export interface Rango {
  desde: ISODate;
  hasta: ISODate;
}

export const ETIQUETAS_PERIODO: Record<PresetPeriodo, string> = {
  hoy: "Hoy",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  mes: "Mes actual",
  mes_anterior: "Mes anterior",
  anio: "Año actual",
  personalizado: "Periodo personalizado",
};

export function rangoDePreset(preset: PresetPeriodo, hoy: ISODate, custom?: Partial<Rango>): Rango {
  switch (preset) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "7d":
      return { desde: addDays(hoy, -6), hasta: hoy };
    case "30d":
      return { desde: addDays(hoy, -29), hasta: hoy };
    case "mes":
      return { desde: inicioMes(hoy), hasta: hoy };
    case "mes_anterior": {
      const ref = addMonths(inicioMes(hoy), -1);
      return { desde: inicioMes(ref), hasta: finMes(ref) };
    }
    case "anio":
      return { desde: inicioAnio(hoy), hasta: hoy };
    case "personalizado": {
      const d = custom?.desde || addDays(hoy, -29);
      const h = custom?.hasta || hoy;
      return d <= h ? { desde: d, hasta: h } : { desde: h, hasta: d };
    }
  }
}

/** Periodo inmediatamente comparable (misma duración o mismo tramo del mes/año anterior). */
export function rangoAnterior(preset: PresetPeriodo, r: Rango): Rango {
  if (preset === "mes") {
    const desde = addMonths(r.desde, -1);
    const hasta = addMonths(r.hasta, -1);
    return { desde, hasta: hasta > finMes(desde) ? finMes(desde) : hasta };
  }
  if (preset === "mes_anterior") {
    const desde = addMonths(r.desde, -1);
    return { desde, hasta: finMes(desde) };
  }
  if (preset === "anio") {
    return { desde: addMonths(r.desde, -12), hasta: addMonths(r.hasta, -12) };
  }
  const largo = diffDays(r.desde, r.hasta) + 1;
  const hasta = addDays(r.desde, -1);
  return { desde: addDays(hasta, -(largo - 1)), hasta };
}

/** Inclusivo en ambos extremos: los días seleccionados siempre se incluyen. */
export function enRango(f: ISODate, r: Rango): boolean {
  const d = f.slice(0, 10);
  return d >= r.desde && d <= r.hasta;
}

export interface Filtros {
  preset: PresetPeriodo;
  desde?: ISODate;
  hasta?: ISODate;
  vendedorId?: string;
  clienteId?: string;
  materialId?: string;
  faenaId?: string;
  conductorId?: string;
  vehiculoId?: string;
  estadoVenta?: EstadoComercial;
  estadoDespacho?: EstadoDespacho;
}

export const FILTROS_INICIALES: Filtros = { preset: "30d" };

export function rangoDeFiltros(f: Filtros, hoy: ISODate): Rango {
  return rangoDePreset(f.preset, hoy, { desde: f.desde, hasta: f.hasta });
}

export function hayFiltrosActivos(f: Filtros): boolean {
  return !!(
    f.vendedorId ||
    f.clienteId ||
    f.materialId ||
    f.faenaId ||
    f.conductorId ||
    f.vehiculoId ||
    f.estadoVenta ||
    f.estadoDespacho
  );
}

/* ------------------------------------------------------------------ */
/* Selección de registros con filtros                                   */
/* ------------------------------------------------------------------ */

function ventaTieneDespachoDe(data: AppData, ventaId: string, f: Filtros): boolean {
  const ds = (idx(data).despachosPorVenta.get(ventaId) ?? []).filter((d) => d.estado !== "anulado");
  return ds.some(
    (d) => (!f.conductorId || d.conductorId === f.conductorId) && (!f.vehiculoId || d.vehiculoId === f.vehiculoId),
  );
}

/** Filtros no temporales aplicables a una venta. */
export function pasaFiltrosVenta(data: AppData, v: Venta, f: Filtros, hoy?: ISODate): boolean {
  if (f.vendedorId && v.vendedorId !== f.vendedorId) return false;
  if (f.clienteId && v.clienteId !== f.clienteId) return false;
  if (f.materialId && v.materialId !== f.materialId) return false;
  if (f.faenaId && v.faenaId !== f.faenaId) return false;
  if (f.estadoVenta && estadoComercialVenta(data, v) !== f.estadoVenta) return false;
  if ((f.conductorId || f.vehiculoId) && !ventaTieneDespachoDe(data, v.id, f)) return false;
  void hoy;
  return true;
}

export function ventasEnPeriodo(
  data: AppData,
  f: Filtros,
  r: Rango,
  opciones: { soloValidas?: boolean } = {},
): Venta[] {
  const soloValidas = opciones.soloValidas ?? true;
  return data.ventas.filter(
    (v) => enRango(v.fecha, r) && (!soloValidas || ventaValida(v)) && pasaFiltrosVenta(data, v, f),
  );
}

/** Filtros no temporales aplicables a un despacho. */
export function pasaFiltrosDespacho(data: AppData, d: Despacho, f: Filtros): boolean {
  const i = idx(data);
  const venta = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
  if (f.conductorId && d.conductorId !== f.conductorId) return false;
  if (f.vehiculoId && d.vehiculoId !== f.vehiculoId) return false;
  if (f.vendedorId && venta?.vendedorId !== f.vendedorId) return false;
  const clienteId = d.clienteId ?? venta?.clienteId;
  if (f.clienteId && clienteId !== f.clienteId) return false;
  const materialId = d.materialId ?? venta?.materialId;
  if (f.materialId && materialId !== f.materialId) return false;
  const faenaId = d.faenaId ?? venta?.faenaId;
  if (f.faenaId && faenaId !== f.faenaId) return false;
  if (f.estadoDespacho && d.estado !== f.estadoDespacho) return false;
  return true;
}

export function despachosEnPeriodo(
  data: AppData,
  f: Filtros,
  r: Rango,
  opciones: { incluirAnulados?: boolean } = {},
): Despacho[] {
  return data.despachos.filter(
    (d) =>
      enRango(d.fecha, r) &&
      (opciones.incluirAnulados || d.estado !== "anulado") &&
      pasaFiltrosDespacho(data, d, f),
  );
}

/** Viajes efectivos con fecha en el periodo y que cumplen los filtros (vía su despacho). */
export function viajesEnPeriodo(data: AppData, f: Filtros, r: Rango): Viaje[] {
  const i = idx(data);
  return data.viajes.filter((v) => {
    if (!viajeEfectivo(data, v)) return false;
    if (!enRango(fechaDe(v.fechaHora), r)) return false;
    const d = i.despachos.get(v.despachoId);
    if (!d) return false;
    // el estado del despacho se filtra en el despacho; conductor/vehículo en el viaje
    if (f.conductorId && v.conductorId !== f.conductorId) return false;
    if (f.vehiculoId && v.vehiculoId !== f.vehiculoId) return false;
    return pasaFiltrosDespacho(data, d, { ...f, conductorId: undefined, vehiculoId: undefined });
  });
}

/* ================================================================== */
/* Lecturas, consumo y rendimiento                                      */
/* ================================================================== */

export interface Trabajo {
  medidor: Medidor;
  /** km u horas trabajadas (solo si la lectura es válida) */
  cantidad: number | null;
  valida: boolean;
  motivo?: "incompleta" | "inconsistente" | "anomala";
}

/** Evalúa las lecturas de un despacho. Las inválidas NO entran en rendimientos. */
export function trabajoDespacho(data: AppData, d: Despacho): Trabajo {
  const veh = idx(data).vehiculos.get(d.vehiculoId);
  const medidor: Medidor = veh?.medidor ?? "km";
  if (d.lecturaInicial == null || d.lecturaFinal == null) {
    return { medidor, cantidad: null, valida: false, motivo: "incompleta" };
  }
  const delta = d.lecturaFinal - d.lecturaInicial;
  if (!(delta > 0)) return { medidor, cantidad: null, valida: false, motivo: "inconsistente" };
  const max = medidor === "km" ? data.config.umbrales.maxKmPorRegistro : data.config.umbrales.maxHorasPorRegistro;
  if (delta > max) return { medidor, cantidad: null, valida: false, motivo: "anomala" };
  return { medidor, cantidad: redondear(delta, 1), valida: true };
}

export interface ResumenFlota {
  /** Litros consumidos registrados (todos los despachos con dato de combustible). */
  litrosConsumidos: number;
  despachosConCombustible: number;
  /** Kilómetros válidos de vehículos medidos en km. */
  km: number;
  /** Horas válidas de maquinaria medida en horas. */
  horas: number;
  /** Rendimiento L/100 km: solo despachos con km válidos Y combustible registrado. */
  l100km: number | null;
  /** Consumo L/h: solo despachos con horas válidas Y combustible registrado. */
  lh: number | null;
  kmParaRendimiento: number;
  horasParaRendimiento: number;
  registrosExcluidos: number;
}

export function resumenFlota(data: AppData, despachos: Despacho[]): ResumenFlota {
  let litros = 0;
  let conComb = 0;
  let km = 0;
  let horas = 0;
  let litrosKm = 0;
  let kmRend = 0;
  let litrosH = 0;
  let hRend = 0;
  let excluidos = 0;
  for (const d of despachos) {
    if (d.estado === "anulado") continue;
    const tieneComb = d.combustibleConsumidoL != null && d.combustibleConsumidoL >= 0;
    if (tieneComb) {
      litros += d.combustibleConsumidoL as number;
      conComb++;
    }
    const t = trabajoDespacho(data, d);
    if (!t.valida || t.cantidad == null) {
      if (d.estado === "finalizado") excluidos++;
      continue;
    }
    if (t.medidor === "km") {
      km += t.cantidad;
      if (tieneComb) {
        litrosKm += d.combustibleConsumidoL as number;
        kmRend += t.cantidad;
      }
    } else {
      horas += t.cantidad;
      if (tieneComb) {
        litrosH += d.combustibleConsumidoL as number;
        hRend += t.cantidad;
      }
    }
    if (!tieneComb && d.estado === "finalizado") excluidos++;
  }
  return {
    litrosConsumidos: litros,
    despachosConCombustible: conComb,
    km: redondear(km, 1),
    horas: redondear(horas, 1),
    l100km: kmRend > 0 ? redondear((litrosKm / kmRend) * 100, 1) : null,
    lh: hRend > 0 ? redondear(litrosH / hRend, 2) : null,
    kmParaRendimiento: kmRend,
    horasParaRendimiento: hRend,
    registrosExcluidos: excluidos,
  };
}

/** Última lectura conocida: la mayor entre la registrada en el vehículo y los despachos no anulados. */
export function ultimaLectura(data: AppData, vehiculoId: string): number {
  const veh = idx(data).vehiculos.get(vehiculoId);
  let max = veh?.lecturaActual ?? 0;
  for (const d of data.despachos) {
    if (d.vehiculoId !== vehiculoId || d.estado === "anulado") continue;
    if (d.lecturaFinal != null && d.lecturaFinal > max) max = d.lecturaFinal;
  }
  return max;
}

/* ================================================================== */
/* Indicadores (KPI)                                                    */
/* ================================================================== */

export interface Kpis {
  /** Total con IVA de ventas confirmadas del periodo */
  ventasTotal: number;
  ventasNeto: number;
  ventasIva: number;
  nVentas: number;
  volumenVendido: number;
  volumenEntregado: number;
  entregasPendientes: number;
  ventasPendientesPagoMonto: number;
  ventasPendientesPagoCount: number;
  /** Pagos (no anulados) con fecha de pago dentro del periodo */
  cobrado: number;
  combustibleConsumido: number;
  kmFlota: number;
  horasMaquinaria: number;
  l100km: number | null;
  lh: number | null;
}

export function calcularKpis(data: AppData, f: Filtros, r: Rango, hoy: ISODate): Kpis {
  const ventas = ventasEnPeriodo(data, f, r);
  let total = 0;
  let neto = 0;
  let iva = 0;
  let vol = 0;
  let pendMonto = 0;
  let pendCount = 0;
  for (const v of ventas) {
    const t = totalesVenta(v);
    total += t.total;
    neto += t.neto;
    iva += t.iva;
    vol += v.cantidadM3;
    const s = saldoVenta(data, v);
    if (s > 0) {
      pendMonto += s;
      pendCount++;
    }
  }
  // Cobrado en el periodo: abonos fechados dentro del periodo para ventas que cumplen los filtros
  const ventasFiltradasTodas = new Set(
    data.ventas.filter((v) => ventaValida(v) && pasaFiltrosVenta(data, v, f)).map((v) => v.id),
  );
  const cobrado = data.pagos
    .filter((p) => !p.anulado && enRango(p.fecha, r) && ventasFiltradasTodas.has(p.ventaId))
    .reduce((s, p) => s + p.monto, 0);

  const viajes = viajesEnPeriodo(data, f, r);
  const entregado = viajes.reduce((s, v) => s + v.cantidadM3, 0);

  // Entregas pendientes: backlog de despachos no finalizados con fecha ≤ fin del periodo
  const pendientes = data.despachos.filter(
    (d) =>
      (d.estado === "programado" || d.estado === "en_curso" || d.estado === "incidencia") &&
      d.fecha <= r.hasta &&
      pasaFiltrosDespacho(data, d, { ...f, estadoDespacho: undefined }),
  ).length;

  const flota = resumenFlota(data, despachosEnPeriodo(data, f, r));
  void hoy;
  return {
    ventasTotal: total,
    ventasNeto: neto,
    ventasIva: iva,
    nVentas: ventas.length,
    volumenVendido: redondear(vol),
    volumenEntregado: redondear(entregado),
    entregasPendientes: pendientes,
    ventasPendientesPagoMonto: pendMonto,
    ventasPendientesPagoCount: pendCount,
    cobrado,
    combustibleConsumido: flota.litrosConsumidos,
    kmFlota: flota.km,
    horasMaquinaria: flota.horas,
    l100km: flota.l100km,
    lh: flota.lh,
  };
}

/** Variación porcentual vs periodo anterior; null si no hay base comparable. */
export function variacionPct(actual: number | null, previo: number | null): number | null {
  if (actual == null || previo == null || previo === 0) return null;
  return ((actual - previo) / Math.abs(previo)) * 100;
}

/* ================================================================== */
/* Series temporales                                                    */
/* ================================================================== */

export type Granularidad = "dia" | "semana" | "mes";

export interface Bucket {
  desde: ISODate;
  hasta: ISODate;
  etiqueta: string;
  clave: string;
}

export function granularidadPara(r: Rango): Granularidad {
  const dias = diffDays(r.desde, r.hasta) + 1;
  if (dias <= 45) return "dia";
  if (dias <= 200) return "semana";
  return "mes";
}

export function crearBuckets(r: Rango, g: Granularidad = granularidadPara(r)): Bucket[] {
  const out: Bucket[] = [];
  if (g === "dia") {
    for (let d = r.desde; d <= r.hasta; d = addDays(d, 1)) {
      out.push({ desde: d, hasta: d, etiqueta: fechaCortaDia(d), clave: d });
    }
  } else if (g === "semana") {
    for (let d = r.desde; d <= r.hasta; d = addDays(d, 7)) {
      const hasta = addDays(d, 6) > r.hasta ? r.hasta : addDays(d, 6);
      out.push({ desde: d, hasta, etiqueta: fechaCortaDia(d), clave: d });
    }
  } else {
    for (let d = r.desde; d <= r.hasta; ) {
      const fin = finMes(d) > r.hasta ? r.hasta : finMes(d);
      out.push({ desde: d, hasta: fin, etiqueta: mesCorto(d), clave: d.slice(0, 7) });
      d = addDays(finMes(d), 1);
    }
  }
  return out;
}

export interface PuntoVentas {
  etiqueta: string;
  desde: ISODate;
  hasta: ISODate;
  total: number;
  neto: number;
  n: number;
  volumen: number;
  previo: number | null;
  previoN: number | null;
  previoEtiqueta: string | null;
}

function agregarVentasPorBucket(data: AppData, f: Filtros, r: Rango, buckets: Bucket[]) {
  const ventas = ventasEnPeriodo(data, f, r);
  return buckets.map((b) => {
    let total = 0;
    let neto = 0;
    let n = 0;
    let volumen = 0;
    for (const v of ventas) {
      if (v.fecha >= b.desde && v.fecha <= b.hasta) {
        const t = totalesVenta(v);
        total += t.total;
        neto += t.neto;
        volumen += v.cantidadM3;
        n++;
      }
    }
    return { b, total, neto, n, volumen };
  });
}

export function serieVentas(data: AppData, f: Filtros, r: Rango, rPrevio: Rango | null): PuntoVentas[] {
  const g = granularidadPara(r);
  const buckets = crearBuckets(r, g);
  const actual = agregarVentasPorBucket(data, f, r, buckets);
  const previo = rPrevio ? agregarVentasPorBucket(data, f, rPrevio, crearBuckets(rPrevio, g)) : [];
  return actual.map((a, i) => ({
    etiqueta: a.b.etiqueta,
    desde: a.b.desde,
    hasta: a.b.hasta,
    total: a.total,
    neto: a.neto,
    n: a.n,
    volumen: redondear(a.volumen),
    previo: previo[i] ? previo[i].total : null,
    previoN: previo[i] ? previo[i].n : null,
    previoEtiqueta: previo[i] ? previo[i].b.etiqueta : null,
  }));
}

export interface PuntoOperacion {
  etiqueta: string;
  desde: ISODate;
  hasta: ISODate;
  vendido: number;
  entregado: number;
  viajes: number;
  finalizadas: number;
  pendientes: number;
}

export function serieOperacion(data: AppData, f: Filtros, r: Rango): PuntoOperacion[] {
  const buckets = crearBuckets(r);
  const ventas = ventasEnPeriodo(data, f, r);
  const viajes = viajesEnPeriodo(data, f, r);
  const despachos = data.despachos.filter(
    (d) => d.estado !== "anulado" && d.fecha >= r.desde && d.fecha <= r.hasta && pasaFiltrosDespacho(data, d, f),
  );
  return buckets.map((b) => {
    const vendido = ventas.filter((v) => v.fecha >= b.desde && v.fecha <= b.hasta).reduce((s, v) => s + v.cantidadM3, 0);
    const vs = viajes.filter((v) => {
      const fd = fechaDe(v.fechaHora);
      return fd >= b.desde && fd <= b.hasta;
    });
    const ds = despachos.filter((d) => d.fecha >= b.desde && d.fecha <= b.hasta);
    return {
      etiqueta: b.etiqueta,
      desde: b.desde,
      hasta: b.hasta,
      vendido: redondear(vendido),
      entregado: redondear(vs.reduce((s, v) => s + v.cantidadM3, 0)),
      viajes: vs.length,
      finalizadas: ds.filter((d) => d.estado === "finalizado").length,
      pendientes: ds.filter((d) => d.estado !== "finalizado").length,
    };
  });
}

export interface PuntoCombustible {
  etiqueta: string;
  litros: number;
  km: number;
  horas: number;
  l100km: number | null;
  lh: number | null;
}

export function serieCombustible(data: AppData, f: Filtros, r: Rango): PuntoCombustible[] {
  const buckets = crearBuckets(r);
  const despachos = despachosEnPeriodo(data, f, r);
  return buckets.map((b) => {
    const ds = despachos.filter((d) => d.fecha >= b.desde && d.fecha <= b.hasta);
    const res = resumenFlota(data, ds);
    return { etiqueta: b.etiqueta, litros: res.litrosConsumidos, km: res.km, horas: res.horas, l100km: res.l100km, lh: res.lh };
  });
}

/* ================================================================== */
/* Agrupaciones                                                         */
/* ================================================================== */

export interface FilaGrupoVenta {
  id: string;
  nombre: string;
  total: number;
  neto: number;
  volumen: number;
  n: number;
  entregado: number;
}

function agruparVentas(data: AppData, ventas: Venta[], clave: (v: Venta) => string, nombre: (id: string) => string): FilaGrupoVenta[] {
  const m = new Map<string, FilaGrupoVenta>();
  for (const v of ventas) {
    const k = clave(v);
    const fila = m.get(k) ?? { id: k, nombre: nombre(k), total: 0, neto: 0, volumen: 0, n: 0, entregado: 0 };
    const t = totalesVenta(v);
    fila.total += t.total;
    fila.neto += t.neto;
    fila.volumen += v.cantidadM3;
    fila.n += 1;
    fila.entregado += volumenEntregadoVenta(data, v.id);
    m.set(k, fila);
  }
  return [...m.values()].map((x) => ({ ...x, volumen: redondear(x.volumen), entregado: redondear(x.entregado) }));
}

export function ventasPorMaterial(data: AppData, f: Filtros, r: Rango): FilaGrupoVenta[] {
  const l = agruparVentas(data, ventasEnPeriodo(data, f, r), (v) => v.materialId, (id) => nombreDe.material(data, id));
  return l.sort((a, b) => b.total - a.total);
}

export function ventasPorVendedor(data: AppData, f: Filtros, r: Rango): FilaGrupoVenta[] {
  const l = agruparVentas(data, ventasEnPeriodo(data, f, r), (v) => v.vendedorId, (id) => nombreDe.usuario(data, id));
  return l.sort((a, b) => b.total - a.total);
}

export function ventasPorCliente(data: AppData, f: Filtros, r: Rango): FilaGrupoVenta[] {
  const l = agruparVentas(data, ventasEnPeriodo(data, f, r), (v) => v.clienteId, (id) => nombreDe.cliente(data, id));
  return l.sort((a, b) => b.total - a.total);
}

export interface ActividadVehiculo {
  vehiculoId: string;
  codigo: string;
  tipo: Vehiculo["tipo"];
  medidor: Medidor;
  despachos: number;
  viajes: number;
  volumen: number;
  km: number;
  horas: number;
  litros: number;
  l100km: number | null;
  lh: number | null;
}

export function actividadFlota(data: AppData, f: Filtros, r: Rango): ActividadVehiculo[] {
  const despachos = despachosEnPeriodo(data, f, r);
  const viajes = viajesEnPeriodo(data, f, r);
  return data.vehiculos
    .filter((v) => !f.vehiculoId || v.id === f.vehiculoId)
    .map((v) => {
      const ds = despachos.filter((d) => d.vehiculoId === v.id);
      const vs = viajes.filter((x) => x.vehiculoId === v.id);
      const res = resumenFlota(data, ds);
      return {
        vehiculoId: v.id,
        codigo: v.codigo,
        tipo: v.tipo,
        medidor: v.medidor,
        despachos: ds.length,
        viajes: vs.length,
        volumen: redondear(vs.reduce((s, x) => s + x.cantidadM3, 0)),
        km: res.km,
        horas: res.horas,
        litros: res.litrosConsumidos,
        l100km: res.l100km,
        lh: res.lh,
      };
    });
}

export interface ActividadConductor {
  conductorId: string;
  nombre: string;
  despachos: number;
  viajes: number;
  volumen: number;
}

export function actividadConductores(data: AppData, f: Filtros, r: Rango): ActividadConductor[] {
  const despachos = despachosEnPeriodo(data, f, r);
  const viajes = viajesEnPeriodo(data, f, r);
  return data.usuarios
    .filter((u) => u.rol === "conductor" && (!f.conductorId || u.id === f.conductorId))
    .map((u) => ({
      conductorId: u.id,
      nombre: u.nombre,
      despachos: despachos.filter((d) => d.conductorId === u.id).length,
      viajes: viajes.filter((v) => v.conductorId === u.id).length,
      volumen: redondear(viajes.filter((v) => v.conductorId === u.id).reduce((s, v) => s + v.cantidadM3, 0)),
    }));
}

/* ================================================================== */
/* Cuentas por cobrar                                                   */
/* ================================================================== */

export interface ResumenCobranza {
  facturado: number;
  facturadoNeto: number;
  iva: number;
  pagado: number;
  pendiente: { monto: number; n: number };
  parcial: { monto: number; n: number };
  vencido: { monto: number; n: number };
  pagadasN: number;
  saldoTotal: number;
}

/** El pagado + los saldos por estado suman exactamente el total facturado (con IVA). */
export function cuentasPorCobrar(data: AppData, ventas: Venta[], hoy: ISODate): ResumenCobranza {
  const r: ResumenCobranza = {
    facturado: 0,
    facturadoNeto: 0,
    iva: 0,
    pagado: 0,
    pendiente: { monto: 0, n: 0 },
    parcial: { monto: 0, n: 0 },
    vencido: { monto: 0, n: 0 },
    pagadasN: 0,
    saldoTotal: 0,
  };
  for (const v of ventas) {
    if (!ventaValida(v)) continue;
    const t = totalesVenta(v);
    const cobrado = Math.min(cobradoVenta(data, v.id), t.total);
    const saldo = t.total - cobrado;
    r.facturado += t.total;
    r.facturadoNeto += t.neto;
    r.iva += t.iva;
    r.pagado += cobrado;
    const e = estadoPagoVenta(data, v, hoy);
    if (e === "pagada") r.pagadasN++;
    else if (e === "vencida") {
      r.vencido.monto += saldo;
      r.vencido.n++;
    } else if (e === "parcial") {
      r.parcial.monto += saldo;
      r.parcial.n++;
    } else if (e === "pendiente") {
      r.pendiente.monto += saldo;
      r.pendiente.n++;
    }
    r.saldoTotal += saldo;
  }
  return r;
}

/* ================================================================== */
/* Utilidades                                                           */
/* ================================================================== */

export function redondear(n: number, dec = 2): number {
  const f = 10 ** dec;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function sumar<T>(arr: T[], fn: (x: T) => number): number {
  return arr.reduce((s, x) => s + fn(x), 0);
}

/** Despachos vinculados a un registro diario. */
export function despachosDeRegistro(data: AppData, registroId: string): Despacho[] {
  return data.despachos.filter((d) => d.registroDiarioId === registroId && d.estado !== "anulado");
}

export interface TotalesRegistro {
  viajes: number;
  volumen: number;
  km: number;
  horas: number;
  litrosConsumidos: number;
  litrosCargados: number;
  materiales: string[];
  completo: boolean;
}

/** Totales calculados por el sistema (sin duplicar: cada viaje pertenece a un solo despacho). */
export function totalesRegistro(data: AppData, registroId: string): TotalesRegistro {
  const reg = data.registros.find((x) => x.id === registroId);
  const ds = despachosDeRegistro(data, registroId);
  const viajes = ds.flatMap((d) => viajesDeDespacho(data, d.id));
  const res = resumenFlota(data, ds);
  const cargas = reg
    ? data.cargas.filter((c) => c.vehiculoId === reg.vehiculoId && c.fecha === reg.fecha && (!c.conductorId || c.conductorId === reg.conductorId))
    : [];
  const materiales = [...new Set(viajes.map((v) => nombreDe.material(data, v.materialId)))];
  const completo = ds.length > 0 && ds.every((d) => trabajoDespacho(data, d).valida && d.combustibleConsumidoL != null);
  return {
    viajes: viajes.length,
    volumen: redondear(viajes.reduce((s, v) => s + v.cantidadM3, 0)),
    km: res.km,
    horas: res.horas,
    litrosConsumidos: res.litrosConsumidos,
    litrosCargados: redondear(cargas.reduce((s, c) => s + c.litros, 0)),
    materiales,
    completo,
  };
}
