/**
 * Persistencia local (localStorage) con validación estructural al importar.
 * La demo NO se conecta a ningún servidor: todo vive en este navegador.
 */
import type { AppData } from "./types";
import { DATA_VERSION } from "./types";

export const STORAGE_KEY = "cr-erp-demo:datos:v1";
export const SESSION_KEY = "cr-erp-demo:sesion:v1";
export const FORMATO_EXPORTACION = "movimiento-de-tierra-cr-demo";

const LISTAS = [
  "usuarios",
  "clientes",
  "faenas",
  "vehiculos",
  "materiales",
  "ventas",
  "pagos",
  "despachos",
  "viajes",
  "registros",
  "cargas",
  "insumos",
  "cambios",
] as const;

export type ResultadoValidacion = { ok: true; data: AppData } | { ok: false; error: string };

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** Valida estructura, identificadores únicos y referencias entre entidades. */
export function validarEstructura(obj: unknown): ResultadoValidacion {
  if (!esObjeto(obj)) return { ok: false, error: "El archivo no contiene un objeto de datos válido." };
  const d = obj as Record<string, unknown>;
  if (typeof d.version !== "number") return { ok: false, error: "Falta el número de versión de los datos." };
  if (d.version > DATA_VERSION) return { ok: false, error: `Los datos son de una versión más nueva (${d.version}) que la que soporta esta demo (${DATA_VERSION}).` };
  for (const k of LISTAS) {
    if (!Array.isArray(d[k])) return { ok: false, error: `Falta la lista «${k}» o no tiene el formato esperado.` };
    const ids = new Set<string>();
    for (const item of d[k] as unknown[]) {
      if (!esObjeto(item) || typeof item.id !== "string" || !item.id) return { ok: false, error: `Hay un registro sin identificador en «${k}».` };
      if (ids.has(item.id)) return { ok: false, error: `Hay identificadores repetidos en «${k}» (${item.id}).` };
      ids.add(item.id);
    }
  }
  if (!esObjeto(d.config) || !esObjeto(d.config.empresa) || !esObjeto(d.config.umbrales) || !Array.isArray(d.config.metodosPago)) {
    return { ok: false, error: "La configuración de la empresa está incompleta." };
  }
  if (typeof d.config.ivaPct !== "number") return { ok: false, error: "Falta el IVA en la configuración." };
  if (!esObjeto(d.seq)) return { ok: false, error: "Faltan los contadores de numeración." };

  const data = d as unknown as AppData;
  const ids = (l: { id: string }[]) => new Set(l.map((x) => x.id));
  const us = ids(data.usuarios);
  const cl = ids(data.clientes);
  const fa = ids(data.faenas);
  const ve = ids(data.vehiculos);
  const ma = ids(data.materiales);
  const vt = ids(data.ventas);
  const de = ids(data.despachos);
  const re = ids(data.registros);
  const falla = (txt: string): ResultadoValidacion => ({ ok: false, error: `Datos inconsistentes: ${txt}` });

  for (const v of data.ventas) {
    if (!cl.has(v.clienteId)) return falla(`la venta ${v.numero} apunta a un cliente que no existe.`);
    if (!ma.has(v.materialId)) return falla(`la venta ${v.numero} apunta a un material que no existe.`);
    if (!us.has(v.vendedorId)) return falla(`la venta ${v.numero} apunta a un vendedor que no existe.`);
    if (v.faenaId && !fa.has(v.faenaId)) return falla(`la venta ${v.numero} apunta a una faena que no existe.`);
    if (typeof v.cantidadM3 !== "number" || typeof v.precioUnitario !== "number") return falla(`la venta ${v.numero} tiene cantidad o precio inválidos.`);
  }
  for (const p of data.pagos) if (!vt.has(p.ventaId)) return falla("hay un pago asociado a una venta que no existe.");
  for (const x of data.despachos) {
    if (!ve.has(x.vehiculoId)) return falla(`el despacho ${x.numero} apunta a un vehículo que no existe.`);
    if (!us.has(x.conductorId)) return falla(`el despacho ${x.numero} apunta a un conductor que no existe.`);
    if (x.ventaId && !vt.has(x.ventaId)) return falla(`el despacho ${x.numero} apunta a una venta que no existe.`);
    if (x.registroDiarioId && !re.has(x.registroDiarioId)) return falla(`el despacho ${x.numero} apunta a un registro diario que no existe.`);
  }
  for (const v of data.viajes) {
    if (!de.has(v.despachoId)) return falla("hay un viaje asociado a un despacho que no existe.");
    if (typeof v.cantidadM3 !== "number" || v.cantidadM3 < 0) return falla("hay un viaje con volumen inválido.");
  }
  for (const r of data.registros) {
    if (!ve.has(r.vehiculoId) || !us.has(r.conductorId)) return falla(`el registro ${r.numero} apunta a un vehículo o conductor que no existe.`);
  }
  for (const c of data.cargas) if (!ve.has(c.vehiculoId)) return falla("hay una carga de combustible de un vehículo que no existe.");
  for (const c of data.insumos) if (!ve.has(c.vehiculoId)) return falla("hay un insumo de un vehículo que no existe.");
  return { ok: true, data };
}

export function cargarDatos(): { data: AppData | null; aviso?: string } {
  try {
    const txt = window.localStorage.getItem(STORAGE_KEY);
    if (!txt) return { data: null };
    const r = validarEstructura(JSON.parse(txt));
    if (!r.ok) return { data: null, aviso: `Los datos guardados no eran válidos (${r.error}). Se restauraron los datos de demostración.` };
    return { data: r.data };
  } catch (e) {
    return { data: null, aviso: `No se pudieron leer los datos guardados (${e instanceof Error ? e.message : "error desconocido"}). Se restauraron los datos de demostración.` };
  }
}

/** Devuelve un mensaje de error o null si se guardó bien. */
export function guardarDatos(data: AppData): string | null {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return null;
  } catch (e) {
    const cuota = e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22);
    return cuota
      ? "El navegador no tiene espacio para guardar más cambios. Los cambios siguen visibles en esta pestaña, pero podrían perderse al recargar. Exporta una copia JSON."
      : "No se pudo guardar en el navegador (¿modo privado o almacenamiento bloqueado?). Los cambios siguen visibles en esta pestaña, pero podrían perderse al recargar.";
  }
}

export function leerSesion(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function guardarSesion(userId: string | null) {
  try {
    if (userId) window.localStorage.setItem(SESSION_KEY, userId);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* sin almacenamiento: la sesión vive solo en memoria */
  }
}

export function exportarJSON(data: AppData, ahoraISO: string): string {
  return JSON.stringify({ formato: FORMATO_EXPORTACION, exportadoEn: ahoraISO, ...data }, null, 2);
}

export function importarJSON(texto: string): ResultadoValidacion {
  let obj: unknown;
  try {
    obj = JSON.parse(texto);
  } catch {
    return { ok: false, error: "El archivo no es un JSON válido." };
  }
  if (esObjeto(obj) && obj.formato !== undefined && obj.formato !== FORMATO_EXPORTACION) {
    return { ok: false, error: "El archivo no corresponde a una copia de esta demostración." };
  }
  if (esObjeto(obj) && obj.formato === undefined) {
    return { ok: false, error: "El archivo no parece una copia exportada desde esta demostración." };
  }
  return validarEstructura(obj);
}
