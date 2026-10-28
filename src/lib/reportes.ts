/**
 * Motor de reportes (puro y testeable). Cada reporte entrega columnas tipadas, filas con valores
 * crudos (números/textos) y notas con la definición de cada métrica. La interfaz formatea las
 * celdas; el CSV exporta exactamente las filas visibles. `null` significa «Sin dato suficiente».
 */
import type { AppData, ISODate } from "./types";
import { ETIQUETAS } from "./types";
import {
  actividadConductores,
  actividadFlota,
  cobradoVenta,
  cuentasPorCobrar,
  despachosEnPeriodo,
  destinoDespacho,
  destinoVenta,
  estadoComercialVenta,
  estadoPagoVenta,
  excesoVenta,
  idx,
  nombreDe,
  rangoDeFiltros,
  redondear,
  resumenFlota,
  saldoVenta,
  totalesVenta,
  ventasEnPeriodo,
  ventasPorCliente,
  ventasPorMaterial,
  ventasPorVendedor,
  viajesDeDespacho,
  volumenEntregadoDespacho,
  volumenEntregadoVenta,
  volumenPendienteVenta,
  type Filtros,
  type Rango,
} from "./calc";
import { diffDays } from "./fecha";

export type Formato = "txt" | "fecha" | "clp" | "m3" | "litros" | "num" | "pct" | "km" | "horas";
export type Valor = string | number | null;
export type Dimension = "vendedor" | "cliente" | "conductor" | "vehiculo" | "material" | "faena" | "estadoVenta" | "estadoDespacho";

export interface ColumnaReporte {
  /** Encabezado claro, con la unidad cuando corresponde (también se usa en el CSV). */
  titulo: string;
  formato: Formato;
  /** Se suma en la fila de totales. */
  sumar?: boolean;
}

export interface BarraReporte {
  nombre: string;
  valor: number;
}

export interface ResultadoReporte {
  columnas: ColumnaReporte[];
  filas: Valor[][];
  totales?: Valor[];
  resumen: { etiqueta: string; valor: Valor; formato?: Formato }[];
  notas: string[];
  grafico?: { titulo: string; formato: Formato; datos: BarraReporte[]; etiquetaValor: string };
}

export interface DefReporte {
  id: string;
  titulo: string;
  descripcion: string;
  dimensiones: Dimension[];
  construir: (data: AppData, f: Filtros, r: Rango, hoy: ISODate) => ResultadoReporte;
}

const sumaCol = (filas: Valor[][], k: number) => redondear(filas.reduce((s, f) => s + (typeof f[k] === "number" ? (f[k] as number) : 0), 0));
const pctDe = (a: number, b: number): number | null => (b > 0 ? redondear((a / b) * 100, 1) : null);

function conTotales(columnas: ColumnaReporte[], filas: Valor[][], etiqueta = "Total"): Valor[] | undefined {
  if (filas.length === 0 || !columnas.some((c) => c.sumar)) return undefined;
  return columnas.map((c, k) => (k === 0 ? etiqueta : c.sumar ? sumaCol(filas, k) : null));
}

/* ---------------------------- 1. Ventas por periodo ---------------------------- */
function ventasPeriodo(data: AppData, f: Filtros, r: Rango, hoy: ISODate): ResultadoReporte {
  const ventas = ventasEnPeriodo(data, f, r).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
  const columnas: ColumnaReporte[] = [
    { titulo: "N° venta", formato: "txt" },
    { titulo: "Fecha", formato: "fecha" },
    { titulo: "Cliente", formato: "txt" },
    { titulo: "Vendedor", formato: "txt" },
    { titulo: "Material", formato: "txt" },
    { titulo: "Volumen vendido (m³)", formato: "m3", sumar: true },
    { titulo: "Neto (CLP)", formato: "clp", sumar: true },
    { titulo: "IVA (CLP)", formato: "clp", sumar: true },
    { titulo: "Total con IVA (CLP)", formato: "clp", sumar: true },
    { titulo: "Cobrado (CLP)", formato: "clp", sumar: true },
    { titulo: "Saldo (CLP)", formato: "clp", sumar: true },
    { titulo: "Estado de entrega", formato: "txt" },
    { titulo: "Estado de pago", formato: "txt" },
  ];
  const filas = ventas.map((v) => {
    const t = totalesVenta(v);
    const pago = estadoPagoVenta(data, v, hoy);
    return [v.numero, v.fecha, nombreDe.cliente(data, v.clienteId), nombreDe.usuario(data, v.vendedorId), nombreDe.material(data, v.materialId), v.cantidadM3, t.neto, t.iva, t.total, Math.min(cobradoVenta(data, v.id), t.total), saldoVenta(data, v), ETIQUETAS.estadoComercial[estadoComercialVenta(data, v)], pago ? ETIQUETAS.estadoPago[pago] : "—"] as Valor[];
  });
  const total = sumaCol(filas, 8);
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [
      { etiqueta: "Ventas", valor: String(filas.length) },
      { etiqueta: "Total con IVA", valor: total, formato: "clp" },
    ],
    notas: ["Incluye solo ventas confirmadas (no borradores ni anuladas), según su fecha de venta.", "El precio de cada venta es el pactado al momento de venderla."],
    grafico: filas.length > 0 ? { titulo: "Total vendido por material", formato: "clp", etiquetaValor: "Total con IVA", datos: ventasPorMaterial(data, f, r).map((x) => ({ nombre: x.nombre, valor: x.total })) } : undefined,
  };
}

/* ---------------------------- Agrupaciones de ventas ---------------------------- */
function agrupado(titulo: string, nombreCol: string, filasBase: ReturnType<typeof ventasPorVendedor>, extraSaldo?: (id: string) => number): ResultadoReporte {
  const columnas: ColumnaReporte[] = [
    { titulo: nombreCol, formato: "txt" },
    { titulo: "N° de ventas", formato: "num", sumar: true },
    { titulo: "Volumen vendido (m³)", formato: "m3", sumar: true },
    { titulo: "Volumen entregado (m³)", formato: "m3", sumar: true },
    { titulo: "Neto (CLP)", formato: "clp", sumar: true },
    { titulo: "Total con IVA (CLP)", formato: "clp", sumar: true },
    { titulo: "Ticket promedio con IVA (CLP)", formato: "clp" },
    ...(extraSaldo ? [{ titulo: "Saldo por cobrar (CLP)", formato: "clp" as Formato, sumar: true }] : []),
  ];
  const filas = filasBase.map((x) => [x.nombre, x.n, x.volumen, x.entregado, x.neto, x.total, x.n > 0 ? Math.round(x.total / x.n) : null, ...(extraSaldo ? [extraSaldo(x.id)] : [])] as Valor[]);
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [{ etiqueta: titulo, valor: String(filas.length) }],
    notas: ["Solo ventas confirmadas del periodo. El ticket promedio es total con IVA ÷ N° de ventas."],
    grafico: filas.length > 0 ? { titulo: `Total con IVA por ${nombreCol.toLowerCase()}`, formato: "clp", etiquetaValor: "Total con IVA", datos: filasBase.slice(0, 10).map((x) => ({ nombre: x.nombre, valor: x.total })) } : undefined,
  };
}

const porVendedor = (data: AppData, f: Filtros, r: Rango) => agrupado("Vendedores con ventas", "Vendedor", ventasPorVendedor(data, f, r));
function porCliente(data: AppData, f: Filtros, r: Rango, hoy: ISODate) {
  void hoy;
  return agrupado("Clientes con ventas", "Cliente", ventasPorCliente(data, f, r), (id) => ventasEnPeriodo(data, f, r).filter((v) => v.clienteId === id).reduce((s, v) => s + saldoVenta(data, v), 0));
}

/* ---------------------------- 4. Volumen por material ---------------------------- */
function volumenMaterial(data: AppData, f: Filtros, r: Rango): ResultadoReporte {
  const base = ventasPorMaterial(data, f, r);
  const columnas: ColumnaReporte[] = [
    { titulo: "Material", formato: "txt" },
    { titulo: "N° de ventas", formato: "num", sumar: true },
    { titulo: "Volumen vendido (m³)", formato: "m3", sumar: true },
    { titulo: "Volumen entregado (m³)", formato: "m3", sumar: true },
    { titulo: "Pendiente de entrega (m³)", formato: "m3", sumar: true },
    { titulo: "Neto (CLP)", formato: "clp", sumar: true },
    { titulo: "Precio neto promedio (CLP/m³)", formato: "clp" },
  ];
  const filas = base.map((x) => [x.nombre, x.n, x.volumen, x.entregado, Math.max(0, redondear(x.volumen - x.entregado)), x.neto, x.volumen > 0 ? Math.round(x.neto / x.volumen) : null] as Valor[]);
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [{ etiqueta: "Materiales vendidos", valor: String(filas.length) }],
    notas: ["Precio neto promedio = neto ÷ volumen vendido (sin IVA, después de descuentos).", "El pendiente nunca es negativo: un exceso autorizado se informa en el reporte «Vendido vs entregado»."],
    grafico: filas.length > 0 ? { titulo: "Volumen vendido por material", formato: "m3", etiquetaValor: "Volumen vendido", datos: base.map((x) => ({ nombre: x.nombre, valor: x.volumen })) } : undefined,
  };
}

/* ---------------------------- 5. Entregas ---------------------------- */
function entregas(data: AppData, f: Filtros, r: Rango): ResultadoReporte {
  const i = idx(data);
  const ds = despachosEnPeriodo(data, f, r).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
  const columnas: ColumnaReporte[] = [
    { titulo: "N° despacho", formato: "txt" },
    { titulo: "Fecha", formato: "fecha" },
    { titulo: "Venta", formato: "txt" },
    { titulo: "Cliente", formato: "txt" },
    { titulo: "Destino", formato: "txt" },
    { titulo: "Camión o máquina", formato: "txt" },
    { titulo: "Conductor", formato: "txt" },
    { titulo: "Volumen programado (m³)", formato: "m3", sumar: true },
    { titulo: "Volumen entregado (m³)", formato: "m3", sumar: true },
    { titulo: "Viajes válidos", formato: "num", sumar: true },
    { titulo: "Estado", formato: "txt" },
  ];
  const filas = ds.map((d) => {
    const v = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
    return [d.numero, d.fecha, v?.numero ?? "Sin venta", nombreDe.cliente(data, d.clienteId ?? v?.clienteId), destinoDespacho(data, d), nombreDe.vehiculo(data, d.vehiculoId), nombreDe.usuario(data, d.conductorId), d.tipo === "transporte" ? d.volumenSolicitadoM3 : 0, d.tipo === "transporte" ? volumenEntregadoDespacho(data, d.id) : 0, viajesDeDespacho(data, d.id).length, ETIQUETAS.estadoDespacho[d.estado]] as Valor[];
  });
  const fin = ds.filter((d) => d.estado === "finalizado").length;
  const pend = ds.filter((d) => d.estado === "programado" || d.estado === "en_curso" || d.estado === "incidencia").length;
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [
      { etiqueta: "Finalizados", valor: String(fin) },
      { etiqueta: "Pendientes o en curso", valor: String(pend) },
    ],
    notas: ["Los despachos anulados no se cuentan. El volumen entregado suma solo viajes válidos.", "Los trabajos de maquinaria no tienen volumen de material."],
  };
}

/* ---------------------------- 6. Viajes por camión ---------------------------- */
function viajesCamion(data: AppData, f: Filtros, r: Rango): ResultadoReporte {
  const act = actividadFlota(data, f, r).filter((a) => a.tipo !== "maquinaria");
  const columnas: ColumnaReporte[] = [
    { titulo: "Camión", formato: "txt" },
    { titulo: "Despachos", formato: "num", sumar: true },
    { titulo: "Viajes válidos", formato: "num", sumar: true },
    { titulo: "Volumen transportado (m³)", formato: "m3", sumar: true },
    { titulo: "Volumen promedio por viaje (m³)", formato: "m3" },
    { titulo: "Km recorridos válidos", formato: "km", sumar: true },
  ];
  const filas = act.filter((a) => a.despachos > 0 || a.viajes > 0).map((a) => [a.codigo, a.despachos, a.viajes, a.volumen, a.viajes > 0 ? redondear(a.volumen / a.viajes, 1) : null, a.km > 0 ? a.km : null] as Valor[]);
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [{ etiqueta: "Camiones con actividad", valor: String(filas.length) }],
    notas: ["Solo viajes válidos (no anulados). Los km solo suman lecturas válidas; «Sin dato» indica que no hay lecturas válidas."],
    grafico: filas.length > 0 ? { titulo: "Viajes por camión", formato: "num", etiquetaValor: "Viajes", datos: act.filter((a) => a.viajes > 0).map((a) => ({ nombre: a.codigo, valor: a.viajes })) } : undefined,
  };
}

/* ---------------------------- 7. Actividad por conductor ---------------------------- */
function conductores(data: AppData, f: Filtros, r: Rango): ResultadoReporte {
  const act = actividadConductores(data, f, r);
  const ds = despachosEnPeriodo(data, f, r);
  const columnas: ColumnaReporte[] = [
    { titulo: "Conductor", formato: "txt" },
    { titulo: "Despachos", formato: "num", sumar: true },
    { titulo: "Despachos finalizados", formato: "num", sumar: true },
    { titulo: "Viajes válidos", formato: "num", sumar: true },
    { titulo: "Volumen entregado (m³)", formato: "m3", sumar: true },
    { titulo: "Despachos con incidencia", formato: "num", sumar: true },
  ];
  const filas = act.filter((a) => a.despachos > 0).map((a) => [a.nombre, a.despachos, ds.filter((d) => d.conductorId === a.conductorId && d.estado === "finalizado").length, a.viajes, a.volumen, ds.filter((d) => d.conductorId === a.conductorId && d.estado === "incidencia").length] as Valor[]);
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [{ etiqueta: "Conductores con actividad", valor: String(filas.length) }],
    notas: ["Cuenta despachos vigentes del periodo y viajes válidos. No es una evaluación de desempeño."],
    grafico: filas.length > 0 ? { titulo: "Volumen entregado por conductor", formato: "m3", etiquetaValor: "Volumen entregado", datos: act.filter((a) => a.volumen > 0).map((a) => ({ nombre: a.nombre, valor: a.volumen })) } : undefined,
  };
}

/* ---------------------------- 8. Combustible por vehículo ---------------------------- */
function combustible(data: AppData, f: Filtros, r: Rango): ResultadoReporte {
  const ds = despachosEnPeriodo(data, f, r);
  const columnas: ColumnaReporte[] = [
    { titulo: "Camión o máquina", formato: "txt" },
    { titulo: "Operaciones con consumo informado", formato: "num", sumar: true },
    { titulo: "Combustible consumido (L)", formato: "litros", sumar: true },
    { titulo: "Combustible cargado (L)", formato: "litros", sumar: true },
    { titulo: "Cargado − consumido (L)", formato: "litros", sumar: true },
    { titulo: "Costo de cargas (CLP)", formato: "clp", sumar: true },
  ];
  const filas: Valor[][] = [];
  for (const v of data.vehiculos) {
    if (f.vehiculoId && v.id !== f.vehiculoId) continue;
    const dv = ds.filter((d) => d.vehiculoId === v.id);
    const res = resumenFlota(data, dv);
    const cargas = data.cargas.filter((c) => c.vehiculoId === v.id && c.fecha >= r.desde && c.fecha <= r.hasta);
    const cargado = redondear(cargas.reduce((s, c) => s + c.litros, 0));
    if (res.despachosConCombustible === 0 && cargas.length === 0) continue;
    const costo = cargas.some((c) => c.precioPorLitro != null) ? Math.round(cargas.reduce((s, c) => s + (c.precioPorLitro != null ? c.litros * c.precioPorLitro : 0), 0)) : null;
    filas.push([v.codigo, res.despachosConCombustible, res.despachosConCombustible > 0 ? redondear(res.litrosConsumidos) : null, cargado > 0 ? cargado : null, res.despachosConCombustible > 0 && cargado > 0 ? redondear(cargado - res.litrosConsumidos) : null, costo]);
  }
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [{ etiqueta: "Vehículos con datos", valor: String(filas.length) }],
    notas: ["Consumido = litros que informa el conductor en cada operación. Cargado = compras o abastecimientos registrados. Son datos distintos y no se deducen entre sí.", "«Cargado − consumido» es solo una diferencia informativa del periodo: el estanque puede tener existencias previas.", "El costo solo suma cargas con precio por litro informado."],
    grafico: filas.length > 0 ? { titulo: "Combustible consumido por vehículo", formato: "litros", etiquetaValor: "Consumido", datos: filas.filter((x) => typeof x[2] === "number").map((x) => ({ nombre: x[0] as string, valor: x[2] as number })) } : undefined,
  };
}

/* ---------------------------- 9. Rendimiento ---------------------------- */
function rendimiento(data: AppData, f: Filtros, r: Rango): ResultadoReporte {
  const ds = despachosEnPeriodo(data, f, r);
  const columnas: ColumnaReporte[] = [
    { titulo: "Camión o máquina", formato: "txt" },
    { titulo: "Se mide en", formato: "txt" },
    { titulo: "Uso válido con consumo informado (km u h)", formato: "num" },
    { titulo: "Rendimiento (L/100 km o L/h)", formato: "num" },
    { titulo: "Unidad del rendimiento", formato: "txt" },
    { titulo: "Operaciones excluidas por datos incompletos", formato: "num", sumar: true },
  ];
  const filas: Valor[][] = [];
  const grafico: BarraReporte[] = [];
  for (const v of data.vehiculos) {
    if (f.vehiculoId && v.id !== f.vehiculoId) continue;
    const dv = ds.filter((d) => d.vehiculoId === v.id);
    if (dv.length === 0) continue;
    const res = resumenFlota(data, dv);
    const km = v.medidor === "km";
    const uso = km ? res.kmParaRendimiento : res.horasParaRendimiento;
    const rend = km ? res.l100km : res.lh;
    filas.push([v.codigo, km ? "Kilómetros" : "Horas", uso > 0 ? redondear(uso, 1) : null, rend, km ? "L/100 km" : "L/h", res.registrosExcluidos]);
    if (rend != null && km) grafico.push({ nombre: v.codigo, valor: rend });
  }
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [{ etiqueta: "Vehículos analizados", valor: String(filas.length) }],
    notas: ["Camiones: L/100 km = litros consumidos ÷ km válidos × 100. Maquinaria: L/h = litros ÷ horas válidas. Nunca se mezclan.", "Solo entran operaciones con lecturas válidas Y consumo informado; el resto se excluye y se muestra «Sin dato» en vez de un 0 engañoso.", "Los umbrales de alerta de consumo son parámetros de demostración."],
    grafico: grafico.length > 0 ? { titulo: "Rendimiento de camiones (L/100 km)", formato: "num", etiquetaValor: "L/100 km", datos: grafico } : undefined,
  };
}

/* ---------------------------- 10. Gastos e insumos ---------------------------- */
function gastos(data: AppData, f: Filtros, r: Rango): ResultadoReporte {
  const columnas: ColumnaReporte[] = [
    { titulo: "Fecha", formato: "fecha" },
    { titulo: "Tipo de registro", formato: "txt" },
    { titulo: "Camión o máquina", formato: "txt" },
    { titulo: "Detalle", formato: "txt" },
    { titulo: "Cantidad", formato: "num" },
    { titulo: "Unidad", formato: "txt" },
    { titulo: "Costo (CLP)", formato: "clp", sumar: true },
  ];
  const filas: Valor[][] = [];
  for (const c of data.cargas) {
    if (c.fecha < r.desde || c.fecha > r.hasta || (f.vehiculoId && c.vehiculoId !== f.vehiculoId)) continue;
    filas.push([c.fecha, "Carga de combustible", nombreDe.vehiculo(data, c.vehiculoId), c.estacion ?? "Sin estación", c.litros, "L", c.precioPorLitro != null ? Math.round(c.litros * c.precioPorLitro) : null]);
  }
  for (const x of data.insumos) {
    if (x.fecha < r.desde || x.fecha > r.hasta || (f.vehiculoId && x.vehiculoId !== f.vehiculoId)) continue;
    filas.push([x.fecha, "Insumo de mantenimiento", nombreDe.vehiculo(data, x.vehiculoId), `${ETIQUETAS.tipoInsumo[x.tipo]}${x.nota ? ` · ${x.nota}` : ""}`, x.cantidad, x.unidad, x.costo ?? null]);
  }
  filas.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const sinCosto = filas.filter((x) => x[6] == null).length;
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [{ etiqueta: "Registros", valor: String(filas.length) }, { etiqueta: "Sin costo informado", valor: String(sinCosto) }],
    notas: ["El total de costos solo suma registros con costo informado; los demás se muestran como «Sin dato».", "Los insumos son registros opcionales de los conductores o del administrador."],
  };
}

/* ---------------------------- 11. Cuentas por cobrar ---------------------------- */
function cobranza(data: AppData, f: Filtros, r: Rango, hoy: ISODate): ResultadoReporte {
  const ventas = ventasEnPeriodo(data, f, r);
  const conSaldo = ventas.filter((v) => saldoVenta(data, v) > 0).sort((a, b) => (a.fechaVencimiento ?? "9999").localeCompare(b.fechaVencimiento ?? "9999"));
  const cob = cuentasPorCobrar(data, ventas, hoy);
  const columnas: ColumnaReporte[] = [
    { titulo: "N° venta", formato: "txt" },
    { titulo: "Fecha de venta", formato: "fecha" },
    { titulo: "Cliente", formato: "txt" },
    { titulo: "Vendedor", formato: "txt" },
    { titulo: "Vencimiento", formato: "fecha" },
    { titulo: "Días de atraso", formato: "num" },
    { titulo: "Total con IVA (CLP)", formato: "clp", sumar: true },
    { titulo: "Cobrado (CLP)", formato: "clp", sumar: true },
    { titulo: "Saldo (CLP)", formato: "clp", sumar: true },
    { titulo: "Estado de pago", formato: "txt" },
  ];
  const filas = conSaldo.map((v) => {
    const t = totalesVenta(v);
    const pago = estadoPagoVenta(data, v, hoy);
    const atraso = v.fechaVencimiento && v.fechaVencimiento < hoy ? diffDays(v.fechaVencimiento, hoy) : 0;
    return [v.numero, v.fecha, nombreDe.cliente(data, v.clienteId), nombreDe.usuario(data, v.vendedorId), v.fechaVencimiento ?? null, v.fechaVencimiento ? atraso : null, t.total, Math.min(cobradoVenta(data, v.id), t.total), saldoVenta(data, v), pago ? ETIQUETAS.estadoPago[pago] : "—"] as Valor[];
  });
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [
      { etiqueta: "Saldo total por cobrar", valor: cob.saldoTotal, formato: "clp" },
      { etiqueta: "Vencido", valor: cob.vencido.monto, formato: "clp" },
      { etiqueta: "Ventas con saldo", valor: String(filas.length) },
    ],
    notas: ["Ventas confirmadas del periodo con saldo pendiente. Cada pago es un movimiento independiente; los pagos anulados no cuentan.", "Una venta sin fecha de vencimiento nunca figura como vencida."],
    grafico: filas.length > 0 ? { titulo: "Saldo por cobrar por estado", formato: "clp", etiquetaValor: "Saldo", datos: [{ nombre: "Pendiente de pago", valor: cob.pendiente.monto }, { nombre: "Pago parcial", valor: cob.parcial.monto }, { nombre: "Vencido", valor: cob.vencido.monto }].filter((x) => x.valor > 0) } : undefined,
  };
}

/* ---------------------------- 12. Vendido vs entregado ---------------------------- */
function vendidoEntregado(data: AppData, f: Filtros, r: Rango): ResultadoReporte {
  const ventas = ventasEnPeriodo(data, f, r);
  const columnas: ColumnaReporte[] = [
    { titulo: "N° venta", formato: "txt" },
    { titulo: "Fecha", formato: "fecha" },
    { titulo: "Cliente", formato: "txt" },
    { titulo: "Destino", formato: "txt" },
    { titulo: "Material", formato: "txt" },
    { titulo: "Vendido (m³)", formato: "m3", sumar: true },
    { titulo: "Entregado (m³)", formato: "m3", sumar: true },
    { titulo: "Pendiente (m³)", formato: "m3", sumar: true },
    { titulo: "Exceso autorizado (m³)", formato: "m3", sumar: true },
    { titulo: "Avance de entrega (%)", formato: "pct" },
  ];
  const filas = ventas
    .map((v) => {
      const ent = volumenEntregadoVenta(data, v.id);
      return [v.numero, v.fecha, nombreDe.cliente(data, v.clienteId), destinoVenta(data, v), nombreDe.material(data, v.materialId), v.cantidadM3, ent, volumenPendienteVenta(data, v), excesoVenta(data, v), pctDe(ent, v.cantidadM3)] as Valor[];
    })
    .sort((a, b) => (b[7] as number) - (a[7] as number) || String(a[0]).localeCompare(String(b[0])));
  const vendido = sumaCol(filas, 5);
  const entregado = sumaCol(filas, 6);
  return {
    columnas,
    filas,
    totales: conTotales(columnas, filas),
    resumen: [
      { etiqueta: "Avance global de entrega", valor: pctDe(entregado, vendido) != null ? `${String(pctDe(entregado, vendido)).replace(".", ",")} %` : "Sin datos suficientes" },
      { etiqueta: "Ventas con pendiente", valor: String(filas.filter((x) => (x[7] as number) > 0).length) },
    ],
    notas: ["Entregado = suma de viajes válidos de los despachos vigentes. Pendiente = vendido − entregado (mínimo 0).", "Un exceso solo existe si el administrador lo autorizó explícitamente."],
  };
}

export const REPORTES: DefReporte[] = [
  { id: "ventas-periodo", titulo: "Ventas por periodo", descripcion: "Detalle de ventas confirmadas con importes, cobros y estados.", dimensiones: ["vendedor", "cliente", "material", "faena", "estadoVenta"], construir: ventasPeriodo },
  { id: "ventas-vendedor", titulo: "Ventas por vendedor", descripcion: "Volumen e ingresos por vendedor.", dimensiones: ["cliente", "material", "faena"], construir: porVendedor },
  { id: "ventas-cliente", titulo: "Ventas por cliente", descripcion: "Compras, volumen y saldo por cliente.", dimensiones: ["vendedor", "material", "faena"], construir: porCliente },
  { id: "volumen-material", titulo: "Volumen por material", descripcion: "Vendido, entregado y pendiente por material.", dimensiones: ["vendedor", "cliente", "faena"], construir: volumenMaterial },
  { id: "entregas", titulo: "Entregas pendientes y finalizadas", descripcion: "Despachos del periodo con su avance y estado.", dimensiones: ["vendedor", "cliente", "conductor", "vehiculo", "material", "estadoDespacho"], construir: entregas },
  { id: "viajes-camion", titulo: "Viajes por camión", descripcion: "Viajes, volumen transportado y km por camión.", dimensiones: ["vehiculo", "conductor", "cliente", "material"], construir: viajesCamion },
  { id: "conductores", titulo: "Actividad por conductor", descripcion: "Despachos, viajes y volumen por conductor.", dimensiones: ["conductor", "vehiculo", "cliente"], construir: conductores },
  { id: "combustible", titulo: "Consumo de combustible por vehículo", descripcion: "Litros consumidos y cargados, por separado.", dimensiones: ["vehiculo", "conductor"], construir: combustible },
  { id: "rendimiento", titulo: "Rendimiento por km u hora", descripcion: "L/100 km de camiones y L/h de maquinaria con datos válidos.", dimensiones: ["vehiculo", "conductor"], construir: rendimiento },
  { id: "gastos", titulo: "Gastos e insumos registrados", descripcion: "Cargas de combustible e insumos de mantenimiento.", dimensiones: ["vehiculo"], construir: gastos },
  { id: "cobranza", titulo: "Cuentas por cobrar", descripcion: "Ventas con saldo pendiente y su antigüedad.", dimensiones: ["vendedor", "cliente", "material"], construir: cobranza },
  { id: "vendido-entregado", titulo: "Vendido vs entregado", descripcion: "Diferencia entre el volumen vendido y el entregado.", dimensiones: ["vendedor", "cliente", "material", "faena"], construir: vendidoEntregado },
];

export function generarReporte(data: AppData, id: string, f: Filtros, hoy: ISODate): ResultadoReporte | null {
  const def = REPORTES.find((x) => x.id === id);
  if (!def) return null;
  return def.construir(data, f, rangoDeFiltros(f, hoy), hoy);
}
