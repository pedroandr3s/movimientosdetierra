/**
 * Validaciones puras de formularios y reglas de negocio.
 * Devuelven un mapa campo → mensaje (vacío si todo está bien). Los mensajes están
 * escritos para personas, sin lenguaje técnico.
 */
import type { AppData, Ctx, ISODate, Medidor, Rol } from "./types";
import { idx, ultimaLectura } from "./calc";
import { m3, num } from "./formato";
import { addDays } from "./fecha";

export type Errores = Record<string, string>;

export const esNumero = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function rolDe(data: AppData, ctx: Ctx): Rol | undefined {
  return idx(data).usuarios.get(ctx.userId)?.rol;
}

export function primerError(e: Errores): { campo: string; error: string } | null {
  const k = Object.keys(e)[0];
  return k ? { campo: k, error: e[k] } : null;
}

/* ------------------------------------------------------------------ */
/* Venta                                                                */
/* ------------------------------------------------------------------ */

export interface VentaInput {
  clienteId: string;
  vendedorId?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  faenaId?: string;
  referenciaFaena?: string;
  materialId: string;
  cantidadM3: number;
  precioUnitario: number;
  descuentoPct: number;
  metodoPago: string;
  fechaEntregaPrevista: ISODate;
  fechaVencimiento?: ISODate;
  observaciones?: string;
  estado?: "borrador" | "confirmada";
}

const RE_TELEFONO = /^[+0-9][0-9 ()-]{5,19}$/;

export function validarVentaInput(
  data: AppData,
  rol: Rol | undefined,
  input: Partial<VentaInput>,
  fechaVenta: ISODate,
  existente?: { materialId: string; precioReferencia: number },
): Errores {
  const e: Errores = {};
  const i = idx(data);
  const cliente = input.clienteId ? i.clientes.get(input.clienteId) : undefined;
  if (!input.clienteId) e.clienteId = "Selecciona un cliente.";
  else if (!cliente) e.clienteId = "El cliente seleccionado no existe.";
  else if (!cliente.activo && input.clienteId !== undefined && !existente) e.clienteId = "Este cliente está inactivo.";

  const material = input.materialId ? i.materiales.get(input.materialId) : undefined;
  if (!input.materialId) e.materialId = "Selecciona un material.";
  else if (!material) e.materialId = "El material seleccionado no existe.";
  else if (!material.activo && (!existente || existente.materialId !== input.materialId)) e.materialId = "Este material está inactivo.";

  if (!input.faenaId && !(input.referenciaFaena ?? "").trim()) {
    e.faenaId = "Indica la faena o escribe una referencia del lugar de entrega.";
  } else if (input.faenaId && !i.faenas.get(input.faenaId)) {
    e.faenaId = "La faena seleccionada no existe.";
  }

  if (!esNumero(input.cantidadM3) || input.cantidadM3 <= 0) e.cantidadM3 = "Ingresa una cantidad mayor que 0 m³.";
  else if (input.cantidadM3 > 2000) e.cantidadM3 = "La cantidad parece demasiado grande (máximo 2.000 m³).";

  if (!esNumero(input.precioUnitario) || input.precioUnitario <= 0) e.precioUnitario = "Ingresa un precio por m³ mayor que 0.";
  else if (rol === "vendedor" && material) {
    const ref = existente && existente.materialId === input.materialId ? existente.precioReferencia : material.precioReferencia;
    const max = data.config.variacionPrecioVendedorPct;
    const desvio = (Math.abs(input.precioUnitario - ref) / ref) * 100;
    if (desvio > max + 1e-9) {
      e.precioUnitario = `Tu precio puede variar hasta ±${num(max)} % del precio de referencia (${num(ref)}). Pide autorización al administrador.`;
    }
  }

  const d = input.descuentoPct ?? 0;
  if (!esNumero(d) || d < 0 || d > 100) e.descuentoPct = "El descuento debe estar entre 0 % y 100 %.";
  else if (rol === "vendedor" && d > data.config.descuentoMaxVendedorPct) {
    e.descuentoPct = `Tu descuento máximo es ${num(data.config.descuentoMaxVendedorPct)} %. Pide autorización al administrador.`;
  }

  const metodo = data.config.metodosPago.find((m) => m.id === input.metodoPago);
  if (!input.metodoPago || !metodo) e.metodoPago = "Selecciona un método de pago.";

  if (!input.fechaEntregaPrevista) e.fechaEntregaPrevista = "Indica la fecha prevista de entrega.";
  else if (input.fechaEntregaPrevista < fechaVenta) e.fechaEntregaPrevista = "La entrega no puede ser anterior a la fecha de la venta.";

  if (input.fechaVencimiento && input.fechaVencimiento < fechaVenta) e.fechaVencimiento = "El vencimiento no puede ser anterior a la venta.";

  if (input.contactoTelefono && !RE_TELEFONO.test(input.contactoTelefono.trim())) {
    e.contactoTelefono = "Escribe un teléfono válido (por ejemplo +56 9 1234 5678).";
  }
  return e;
}

/** Vencimiento por defecto: crédito a N días, transferencia/otro a 15 días, efectivo/débito sin vencimiento. */
export function vencimientoPorDefecto(data: AppData, metodoPago: string, fecha: ISODate): ISODate | undefined {
  if (metodoPago === "credito") return addDays(fecha, data.config.diasVencimientoCredito);
  if (metodoPago === "transferencia" || metodoPago === "otro") return addDays(fecha, 15);
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Pagos                                                                */
/* ------------------------------------------------------------------ */

export function validarPagoInput(
  data: AppData,
  input: { fecha: ISODate; monto: number; metodo: string },
  ventaFecha: ISODate,
  saldo: number,
  hoy: ISODate,
): Errores {
  const e: Errores = {};
  if (!esNumero(input.monto) || input.monto <= 0) e.monto = "Ingresa un monto mayor que $0.";
  else if (!Number.isInteger(input.monto)) e.monto = "El monto debe ser en pesos enteros.";
  else if (input.monto > saldo) e.monto = `El abono supera el saldo pendiente (${num(saldo)} pesos).`;
  if (!input.fecha) e.fecha = "Indica la fecha del pago.";
  else if (input.fecha < ventaFecha) e.fecha = "El pago no puede ser anterior a la venta.";
  else if (input.fecha > hoy) e.fecha = "El pago no puede tener fecha futura.";
  if (!data.config.metodosPago.some((m) => m.id === input.metodo)) e.metodo = "Selecciona un método de pago.";
  return e;
}

/* ------------------------------------------------------------------ */
/* Lecturas y combustible                                               */
/* ------------------------------------------------------------------ */

export interface LecturasInput {
  lecturaInicial?: number | null;
  lecturaFinal?: number | null;
  combustibleConsumidoL?: number | null;
  combustibleCargadoL?: number | null;
}

export function validarLecturas(
  data: AppData,
  vehiculoId: string,
  despachoId: string | undefined,
  l: LecturasInput,
  opciones: { exigirInicialMayorAUltima?: boolean } = {},
): Errores {
  const e: Errores = {};
  const veh = idx(data).vehiculos.get(vehiculoId);
  const medidor: Medidor = veh?.medidor ?? "km";
  const unidad = medidor === "km" ? "kilometraje" : "horómetro";
  const u = data.config.umbrales;

  for (const [campo, valor] of [
    ["lecturaInicial", l.lecturaInicial],
    ["lecturaFinal", l.lecturaFinal],
  ] as const) {
    if (valor != null && (!esNumero(valor) || valor < 0)) e[campo] = `El ${unidad} no puede ser negativo.`;
  }
  if (!e.lecturaInicial && !e.lecturaFinal && l.lecturaInicial != null && l.lecturaFinal != null) {
    if (l.lecturaFinal < l.lecturaInicial) {
      e.lecturaFinal = `El ${unidad} final no puede ser menor que el inicial.`;
    } else {
      const delta = l.lecturaFinal - l.lecturaInicial;
      const max = medidor === "km" ? u.maxKmPorRegistro : u.maxHorasPorRegistro;
      if (delta > max) {
        e.lecturaFinal = `Son ${num(delta, 1)} ${medidor === "km" ? "km" : "horas"} en un solo registro (máximo configurado: ${num(max)}). Revisa las lecturas.`;
      }
    }
  }
  if (opciones.exigirInicialMayorAUltima && !e.lecturaInicial && l.lecturaInicial != null && veh) {
    const previa = lecturaPrevia(data, vehiculoId, despachoId);
    if (l.lecturaInicial < previa - 1e-9) {
      e.lecturaInicial = `El ${unidad} inicial no puede ser menor que la última lectura registrada (${num(previa, 1)}).`;
    }
  }
  for (const [campo, valor, etq] of [
    ["combustibleConsumidoL", l.combustibleConsumidoL, "consumido"],
    ["combustibleCargadoL", l.combustibleCargadoL, "cargado"],
  ] as const) {
    if (valor != null) {
      if (!esNumero(valor) || valor < 0) e[campo] = `Los litros ${etq}s no pueden ser negativos.`;
      else if (valor > 1500) e[campo] = `Los litros ${etq}s parecen demasiados (máximo 1.500 L). Revisa el dato.`;
    }
  }
  return e;
}

/** Última lectura conocida del vehículo sin contar el propio despacho. */
export function lecturaPrevia(data: AppData, vehiculoId: string, excluirDespachoId?: string): number {
  const veh = idx(data).vehiculos.get(vehiculoId);
  let max = veh?.lecturaActual ?? 0;
  for (const d of data.despachos) {
    if (d.vehiculoId !== vehiculoId || d.estado === "anulado" || d.id === excluirDespachoId) continue;
    if (d.lecturaFinal != null && d.lecturaFinal > max && d.lecturaInicial != null && d.lecturaFinal >= d.lecturaInicial) max = d.lecturaFinal;
  }
  return max;
}

export { ultimaLectura };

/* ------------------------------------------------------------------ */
/* Catálogos                                                            */
/* ------------------------------------------------------------------ */

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarCatalogo(data: AppData, cat: string, r: Record<string, unknown>): Errores {
  const e: Errores = {};
  const txt = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  const id = typeof r.id === "string" ? r.id : undefined;
  if (!txt("nombre") && cat !== "vehiculos") e.nombre = "El nombre es obligatorio.";
  switch (cat) {
    case "clientes":
      if (txt("email") && !RE_EMAIL.test(txt("email"))) e.email = "Escribe un correo válido.";
      if (txt("telefono") && !RE_TELEFONO.test(txt("telefono"))) e.telefono = "Escribe un teléfono válido.";
      break;
    case "faenas":
      if (!txt("referencia")) e.referencia = "Indica una referencia del lugar (no necesita ser una dirección exacta).";
      break;
    case "materiales": {
      const p = r.precioReferencia;
      if (!esNumero(p) || p <= 0) e.precioReferencia = "Ingresa un precio de referencia mayor que 0.";
      if (data.materiales.some((m) => m.id !== id && m.nombre.toLowerCase() === txt("nombre").toLowerCase())) {
        e.nombre = "Ya existe un material con ese nombre.";
      }
      break;
    }
    case "usuarios":
      if (!RE_EMAIL.test(txt("email"))) e.email = "Escribe un correo válido.";
      if (!["admin", "vendedor", "conductor"].includes(String(r.rol))) e.rol = "Selecciona un rol.";
      break;
    case "vehiculos": {
      if (!txt("codigo")) e.codigo = "El identificador interno es obligatorio (por ejemplo CAM-05).";
      else if (data.vehiculos.some((v) => v.id !== id && v.codigo.toLowerCase() === txt("codigo").toLowerCase())) {
        e.codigo = "Ya existe un vehículo con ese identificador.";
      }
      if (!["camion", "maquinaria", "otro"].includes(String(r.tipo))) e.tipo = "Selecciona el tipo de equipo.";
      if (!["km", "horas"].includes(String(r.medidor))) e.medidor = "Selecciona cómo se mide el uso.";
      if (r.tipo === "camion" && (!esNumero(r.capacidadM3) || (r.capacidadM3 as number) <= 0)) {
        e.capacidadM3 = "Indica la capacidad de carga en m³.";
      }
      if (!esNumero(r.lecturaActual) || (r.lecturaActual as number) < 0) e.lecturaActual = "Ingresa una lectura válida (0 o más).";
      else if (id) {
        const previa = lecturaPrevia(data, id);
        if ((r.lecturaActual as number) < previa - 1e-9) {
          e.lecturaActual = `La lectura no puede ser menor que la última registrada (${num(previa, 1)}).`;
        }
      }
      break;
    }
  }
  return e;
}

export function textoExceso(pendiente: number): string {
  return `Supera el volumen pendiente (${m3(Math.max(0, pendiente))}). Requiere autorización explícita del administrador.`;
}
