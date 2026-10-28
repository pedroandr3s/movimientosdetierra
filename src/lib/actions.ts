/**
 * Acciones de negocio (puras): reciben el estado actual y devuelven el nuevo estado
 * o un error comprensible. No tocan el navegador ni el almacenamiento; la capa de
 * `store.ts` las ejecuta y persiste. Esto las hace probables sin interfaz y las deja
 * listas para trasladarse a un backend (ver docs/LIMITACIONES.md).
 */
import type {
  AppData,
  CargaCombustible,
  Cambio,
  CodigoError,
  Config,
  Ctx,
  Despacho,
  EstadoDespacho,
  ISODate,
  ISODateTime,
  InsumoMantenimiento,
  Pago,
  RegistroDiario,
  Resultado,
  TipoDespacho,
  Venta,
  Viaje,
} from "./types";
import {
  idx,
  pagosValidos,
  redondear,
  saldoVenta,
  totalesVenta,
  trabajoDespacho,
  viajesDeDespacho,
  volumenEntregadoDespacho,
  volumenEntregadoVenta,
  volumenProgramadoVenta,
  cobradoVenta,
} from "./calc";
import { can, type Permiso } from "./permisos";
import {
  esNumero,
  lecturaPrevia,
  primerError,
  rolDe,
  textoExceso,
  validarCatalogo,
  validarLecturas,
  validarPagoInput,
  validarVentaInput,
  vencimientoPorDefecto,
  type VentaInput,
} from "./validaciones";
import { clp, m3, num } from "./formato";

/* ================================================================== */
/* Utilidades internas                                                  */
/* ================================================================== */

const pad = (n: number, w = 4) => String(n).padStart(w, "0");

function fallar(error: string, campo?: string, codigo?: CodigoError): { ok: false; error: string; campo?: string; codigo?: CodigoError } {
  return { ok: false, error, campo, codigo };
}

function permiso(data: AppData, ctx: Ctx, p: Permiso): boolean {
  return can(rolDe(data, ctx), p);
}

function tomar(data: AppData, clave: string): [number, AppData] {
  const n = data.seq[clave] ?? 1;
  return [n, { ...data, seq: { ...data.seq, [clave]: n + 1 }, }];
}

function registrar(data: AppData, ctx: Ctx, entidad: string, entidadId: string, accion: string, detalle: string): AppData {
  const [n, d] = tomar(data, "cambio");
  const cambio: Cambio = { id: `cb-${pad(n)}`, fecha: ctx.ahora, userId: ctx.userId, entidad, entidadId, accion, detalle };
  const cambios = [...d.cambios, cambio];
  return { ...d, cambios: cambios.length > 800 ? cambios.slice(cambios.length - 800) : cambios };
}

function reemplazar<T extends { id: string }>(arr: T[], id: string, fn: (x: T) => T): T[] {
  return arr.map((x) => (x.id === id ? fn(x) : x));
}

function motivoValido(m: string | undefined): m is string {
  return !!m && m.trim().length >= 3;
}

const limpiar = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : undefined;
};

/* ================================================================== */
/* Ventas                                                               */
/* ================================================================== */

export function crearVenta(data: AppData, ctx: Ctx, input: VentaInput): Resultado<{ id: string; numero: string }> {
  if (!permiso(data, ctx, "ventas.crear")) return fallar("No tienes permiso para registrar ventas.");
  const rol = rolDe(data, ctx);
  const i = idx(data);
  const vendedorId = rol === "vendedor" ? ctx.userId : input.vendedorId || ctx.userId;
  const vend = i.usuarios.get(vendedorId);
  if (!vend || (vend.rol !== "vendedor" && vend.rol !== "admin")) return fallar("Selecciona un vendedor válido.", "vendedorId");
  const errs = validarVentaInput(data, rol, input, ctx.hoy);
  const pe = primerError(errs);
  if (pe) return fallar(pe.error, pe.campo);

  const material = i.materiales.get(input.materialId)!;
  const [n, d1] = tomar(data, "venta");
  const id = `v-${pad(n)}`;
  const venta: Venta = {
    id,
    numero: `V-${pad(n)}`,
    fecha: ctx.hoy,
    vendedorId,
    clienteId: input.clienteId,
    contactoNombre: limpiar(input.contactoNombre),
    contactoTelefono: limpiar(input.contactoTelefono),
    faenaId: input.faenaId || undefined,
    referenciaFaena: input.faenaId ? undefined : limpiar(input.referenciaFaena),
    materialId: input.materialId,
    cantidadM3: input.cantidadM3,
    precioUnitario: Math.round(input.precioUnitario),
    precioReferencia: material.precioReferencia,
    descuentoPct: input.descuentoPct || 0,
    ivaPct: data.config.ivaPct,
    metodoPago: input.metodoPago,
    fechaEntregaPrevista: input.fechaEntregaPrevista,
    fechaVencimiento: input.fechaVencimiento || vencimientoPorDefecto(data, input.metodoPago, ctx.hoy),
    observaciones: limpiar(input.observaciones),
    estado: input.estado === "borrador" ? "borrador" : "confirmada",
    creadoPor: ctx.userId,
    creadoEn: ctx.ahora,
    modificadoPor: ctx.userId,
    modificadoEn: ctx.ahora,
  };
  const t = totalesVenta(venta);
  const d2 = registrar(
    { ...d1, ventas: [...d1.ventas, venta] },
    ctx,
    "venta",
    id,
    venta.estado === "borrador" ? "Creación (borrador)" : "Creación",
    `${venta.numero}: ${m3(venta.cantidadM3)} de ${material.nombre} · total ${clp(t.total)}.`,
  );
  return { ok: true, data: d2, id, numero: venta.numero };
}

export function puedeEditarVenta(data: AppData, ctx: Ctx, v: Venta): string | null {
  const rol = rolDe(data, ctx);
  if (v.estado === "anulada") return "Una venta anulada no se puede editar.";
  if (rol === "admin") return null;
  if (rol !== "vendedor" || v.vendedorId !== ctx.userId) return "Solo puedes editar tus propias ventas.";
  if (v.estado === "borrador") return null;
  const hayDesp = (idx(data).despachosPorVenta.get(v.id) ?? []).some((d) => d.estado !== "anulado");
  if (hayDesp) return "Esta venta ya tiene despachos. Solo el administrador puede modificarla.";
  if (pagosValidos(data, v.id).length > 0) return "Esta venta ya tiene pagos. Solo el administrador puede modificarla.";
  return null;
}

export function editarVenta(data: AppData, ctx: Ctx, id: string, cambios: Partial<VentaInput>): Resultado {
  const v = idx(data).ventas.get(id);
  if (!v) return fallar("La venta no existe.");
  const bloqueo = puedeEditarVenta(data, ctx, v);
  if (bloqueo) return fallar(bloqueo);
  const rol = rolDe(data, ctx);

  const merged: VentaInput = {
    clienteId: cambios.clienteId ?? v.clienteId,
    vendedorId: cambios.vendedorId ?? v.vendedorId,
    contactoNombre: cambios.contactoNombre !== undefined ? cambios.contactoNombre : v.contactoNombre,
    contactoTelefono: cambios.contactoTelefono !== undefined ? cambios.contactoTelefono : v.contactoTelefono,
    faenaId: cambios.faenaId !== undefined ? cambios.faenaId : v.faenaId,
    referenciaFaena: cambios.referenciaFaena !== undefined ? cambios.referenciaFaena : v.referenciaFaena,
    materialId: cambios.materialId ?? v.materialId,
    cantidadM3: cambios.cantidadM3 ?? v.cantidadM3,
    precioUnitario: cambios.precioUnitario ?? v.precioUnitario,
    descuentoPct: cambios.descuentoPct ?? v.descuentoPct,
    metodoPago: cambios.metodoPago ?? v.metodoPago,
    fechaEntregaPrevista: cambios.fechaEntregaPrevista ?? v.fechaEntregaPrevista,
    fechaVencimiento: cambios.fechaVencimiento !== undefined ? cambios.fechaVencimiento : v.fechaVencimiento,
    observaciones: cambios.observaciones !== undefined ? cambios.observaciones : v.observaciones,
  };
  const errs = validarVentaInput(data, rol, merged, v.fecha, { materialId: v.materialId, precioReferencia: v.precioReferencia });
  const pe = primerError(errs);
  if (pe) return fallar(pe.error, pe.campo);

  const i = idx(data);
  const despachosActivos = (i.despachosPorVenta.get(id) ?? []).filter((d) => d.estado !== "anulado");
  if (merged.materialId !== v.materialId && despachosActivos.length > 0) {
    return fallar("No se puede cambiar el material: la venta ya tiene despachos. Anúlalos primero.", "materialId");
  }
  const entregado = volumenEntregadoVenta(data, id);
  const programado = volumenProgramadoVenta(data, id);
  if (merged.cantidadM3 < Math.max(entregado, programado) - 1e-9) {
    return fallar(`La cantidad no puede ser menor que lo ya despachado o programado (${m3(Math.max(entregado, programado))}).`, "cantidadM3");
  }
  const nuevoMaterial = i.materiales.get(merged.materialId)!;
  const precioReferencia = merged.materialId === v.materialId ? v.precioReferencia : nuevoMaterial.precioReferencia;
  const actualizada: Venta = {
    ...v,
    vendedorId: rol === "admin" ? (merged.vendedorId || v.vendedorId) : v.vendedorId,
    clienteId: merged.clienteId,
    contactoNombre: limpiar(merged.contactoNombre),
    contactoTelefono: limpiar(merged.contactoTelefono),
    faenaId: merged.faenaId || undefined,
    referenciaFaena: merged.faenaId ? undefined : limpiar(merged.referenciaFaena),
    materialId: merged.materialId,
    cantidadM3: merged.cantidadM3,
    precioUnitario: Math.round(merged.precioUnitario),
    precioReferencia,
    descuentoPct: merged.descuentoPct || 0,
    metodoPago: merged.metodoPago,
    fechaEntregaPrevista: merged.fechaEntregaPrevista,
    fechaVencimiento: merged.fechaVencimiento || undefined,
    observaciones: limpiar(merged.observaciones),
    modificadoPor: ctx.userId,
    modificadoEn: ctx.ahora,
  };
  const cobrado = cobradoVenta(data, id);
  if (actualizada.estado === "confirmada" && totalesVenta(actualizada).total < cobrado) {
    return fallar(`El nuevo total (${clp(totalesVenta(actualizada).total)}) es menor que lo ya cobrado (${clp(cobrado)}).`, "cantidadM3");
  }

  const dif: string[] = [];
  if (v.cantidadM3 !== actualizada.cantidadM3) dif.push(`cantidad ${num(v.cantidadM3, 1)}→${num(actualizada.cantidadM3, 1)} m³`);
  if (v.precioUnitario !== actualizada.precioUnitario) dif.push(`precio ${clp(v.precioUnitario)}→${clp(actualizada.precioUnitario)}`);
  if (v.descuentoPct !== actualizada.descuentoPct) dif.push(`descuento ${v.descuentoPct}→${actualizada.descuentoPct} %`);
  if (v.materialId !== actualizada.materialId) dif.push("material");
  if (v.clienteId !== actualizada.clienteId) dif.push("cliente");
  if (v.fechaEntregaPrevista !== actualizada.fechaEntregaPrevista) dif.push("fecha de entrega");
  if (v.metodoPago !== actualizada.metodoPago) dif.push("método de pago");
  const d1 = { ...data, ventas: reemplazar(data.ventas, id, () => actualizada) };
  return { ok: true, data: registrar(d1, ctx, "venta", id, "Edición", `${v.numero}: ${dif.length ? dif.join("; ") : "datos de contacto u observaciones"}.`) };
}

export function confirmarVenta(data: AppData, ctx: Ctx, id: string): Resultado {
  const v = idx(data).ventas.get(id);
  if (!v) return fallar("La venta no existe.");
  if (v.estado !== "borrador") return fallar("Solo se pueden confirmar ventas en borrador.");
  const rol = rolDe(data, ctx);
  if (rol !== "admin" && !(rol === "vendedor" && v.vendedorId === ctx.userId)) return fallar("No tienes permiso para confirmar esta venta.");
  const d1 = { ...data, ventas: reemplazar(data.ventas, id, (x) => ({ ...x, estado: "confirmada" as const, modificadoPor: ctx.userId, modificadoEn: ctx.ahora })) };
  return { ok: true, data: registrar(d1, ctx, "venta", id, "Confirmación", `${v.numero} confirmada.`) };
}

export function anularVenta(data: AppData, ctx: Ctx, id: string, motivo: string): Resultado {
  const v = idx(data).ventas.get(id);
  if (!v) return fallar("La venta no existe.");
  if (v.estado === "anulada") return fallar("La venta ya está anulada.");
  const rol = rolDe(data, ctx);
  if (!permiso(data, ctx, "ventas.anular")) return fallar("No tienes permiso para anular ventas.");
  if (rol === "vendedor" && v.vendedorId !== ctx.userId) return fallar("Solo puedes anular tus propias ventas.");
  if (!motivoValido(motivo)) return fallar("Indica el motivo de la anulación.", "motivo");
  const ds = (idx(data).despachosPorVenta.get(id) ?? []).filter((d) => d.estado !== "anulado");
  const entregado = volumenEntregadoVenta(data, id);
  if (entregado > 0) {
    return fallar(`La venta tiene ${m3(entregado)} entregados. Anula primero los despachos o viajes asociados para conservar la trazabilidad.`);
  }
  if (pagosValidos(data, id).length > 0) {
    return fallar("La venta tiene pagos registrados. Un administrador debe anular primero esos pagos.");
  }
  let d1 = data;
  // Despachos aún sin entregas: se anulan junto con la venta
  for (const d of ds) {
    d1 = { ...d1, despachos: reemplazar(d1.despachos, d.id, (x) => ({ ...x, estado: "anulado" as const, motivoAnulacion: `Anulado por anulación de ${v.numero}`, modificadoPor: ctx.userId, modificadoEn: ctx.ahora })) };
    d1 = registrar(d1, ctx, "despacho", d.id, "Anulación", `${d.numero} anulado al anular ${v.numero}.`);
  }
  d1 = { ...d1, ventas: reemplazar(d1.ventas, id, (x) => ({ ...x, estado: "anulada" as const, motivoAnulacion: motivo.trim(), modificadoPor: ctx.userId, modificadoEn: ctx.ahora })) };
  return { ok: true, data: registrar(d1, ctx, "venta", id, "Anulación", `${v.numero} anulada: ${motivo.trim()}`) };
}

/* ================================================================== */
/* Pagos                                                                */
/* ================================================================== */

export function registrarPago(
  data: AppData,
  ctx: Ctx,
  ventaId: string,
  input: { fecha?: ISODate; monto: number; metodo: string; nota?: string },
): Resultado<{ id: string }> {
  const v = idx(data).ventas.get(ventaId);
  if (!v) return fallar("La venta no existe.");
  if (!permiso(data, ctx, "pagos.registrar")) return fallar("No tienes permiso para registrar pagos.");
  const rol = rolDe(data, ctx);
  if (rol === "vendedor" && v.vendedorId !== ctx.userId) return fallar("Solo puedes registrar pagos de tus propias ventas.");
  if (v.estado !== "confirmada") return fallar("Solo se pueden registrar pagos en ventas confirmadas.");
  const fecha = input.fecha || ctx.hoy;
  const errs = validarPagoInput(data, { fecha, monto: input.monto, metodo: input.metodo }, v.fecha, saldoVenta(data, v), ctx.hoy);
  const pe = primerError(errs);
  if (pe) return fallar(pe.error, pe.campo);
  const [n, d1] = tomar(data, "pago");
  const id = `p-${pad(n)}`;
  const pago: Pago = { id, ventaId, fecha, monto: Math.round(input.monto), metodo: input.metodo, nota: limpiar(input.nota), creadoPor: ctx.userId, creadoEn: ctx.ahora };
  const d2 = registrar({ ...d1, pagos: [...d1.pagos, pago] }, ctx, "pago", id, "Abono", `${v.numero}: abono de ${clp(pago.monto)}.`);
  return { ok: true, data: d2, id };
}

export function anularPago(data: AppData, ctx: Ctx, pagoId: string, motivo: string): Resultado {
  if (!permiso(data, ctx, "pagos.anular")) return fallar("Solo el administrador puede anular pagos.");
  const p = data.pagos.find((x) => x.id === pagoId);
  if (!p) return fallar("El pago no existe.");
  if (p.anulado) return fallar("El pago ya está anulado.");
  if (!motivoValido(motivo)) return fallar("Indica el motivo de la anulación.", "motivo");
  const v = idx(data).ventas.get(p.ventaId);
  const d1 = { ...data, pagos: reemplazar(data.pagos, pagoId, (x) => ({ ...x, anulado: true, motivoAnulacion: motivo.trim() })) };
  return { ok: true, data: registrar(d1, ctx, "pago", pagoId, "Anulación de pago", `${v?.numero ?? ""}: pago de ${clp(p.monto)} anulado (${motivo.trim()}).`) };
}

/* ================================================================== */
/* Despachos                                                            */
/* ================================================================== */

export interface DespachoInput {
  tipo?: TipoDespacho;
  ventaId?: string;
  motivoIndependiente?: string;
  clienteId?: string;
  faenaId?: string;
  referenciaDestino?: string;
  materialId?: string;
  fecha: ISODate;
  vehiculoId: string;
  conductorId: string;
  volumenSolicitadoM3: number;
  viajesPlanificados?: number;
  observaciones?: string;
}

export function crearDespacho(
  data: AppData,
  ctx: Ctx,
  input: DespachoInput,
  opciones: { autorizarExceso?: boolean; autorizarVehiculo?: boolean } = {},
): Resultado<{ id: string; numero: string }> {
  if (!permiso(data, ctx, "despachos.crear")) return fallar("No tienes permiso para crear despachos.");
  const rol = rolDe(data, ctx);
  const i = idx(data);
  const tipo: TipoDespacho = input.tipo ?? "transporte";
  const veh = i.vehiculos.get(input.vehiculoId);
  const cond = i.usuarios.get(input.conductorId);
  const venta = input.ventaId ? i.ventas.get(input.ventaId) : undefined;

  if (!veh) return fallar("Selecciona un camión o máquina.", "vehiculoId");
  if (!cond || cond.rol !== "conductor" || !cond.activo) return fallar("Selecciona un conductor activo.", "conductorId");
  if (!input.fecha) return fallar("Indica la fecha del despacho.", "fecha");

  if (tipo === "transporte") {
    if (veh.tipo === "maquinaria") return fallar("Para trabajos de maquinaria crea una operación de tipo «trabajo de maquinaria».", "vehiculoId");
    if (input.ventaId && !venta) return fallar("La venta seleccionada no existe.", "ventaId");
    if (venta) {
      if (rol === "vendedor" && venta.vendedorId !== ctx.userId) return fallar("Solo puedes coordinar despachos de tus propias ventas.", "ventaId");
      if (venta.estado !== "confirmada") return fallar("La venta debe estar confirmada para poder despacharla.", "ventaId");
      if (input.fecha < venta.fecha) return fallar("El despacho no puede ser anterior a la fecha de la venta.", "fecha");
    } else {
      if (rol !== "admin") return fallar("Solo el administrador puede registrar una operación sin venta asociada.", "ventaId");
      if (!motivoValido(input.motivoIndependiente)) return fallar("Indica el motivo de la operación sin venta.", "motivoIndependiente");
      if (!input.materialId) return fallar("Selecciona el material transportado.", "materialId");
    }
    if (!esNumero(input.volumenSolicitadoM3) || input.volumenSolicitadoM3 <= 0) return fallar("Ingresa un volumen mayor que 0 m³.", "volumenSolicitadoM3");
  } else {
    if (veh.tipo !== "maquinaria") return fallar("Selecciona una maquinaria para este tipo de operación.", "vehiculoId");
    if (rol !== "admin") return fallar("Solo el administrador puede programar trabajos de maquinaria.");
    if (!motivoValido(input.motivoIndependiente)) return fallar("Indica el motivo del trabajo de maquinaria.", "motivoIndependiente");
  }

  if (veh.estado === "fuera_de_servicio" || veh.estado === "en_mantenimiento") {
    const permitido = opciones.autorizarVehiculo && rol === "admin";
    if (!permitido) {
      return fallar(
        `${veh.codigo} está ${veh.estado === "en_mantenimiento" ? "en mantenimiento" : "fuera de servicio"}. Solo el administrador puede autorizar una excepción.`,
        "vehiculoId",
        "vehiculo",
      );
    }
  }

  if (venta) {
    const pendientePorProgramar = redondear(venta.cantidadM3 - volumenProgramadoVenta(data, venta.id));
    if (input.volumenSolicitadoM3 > pendientePorProgramar + 1e-9) {
      const permitido = opciones.autorizarExceso && rol === "admin";
      if (!permitido) return fallar(textoExceso(pendientePorProgramar), "volumenSolicitadoM3", "exceso");
    }
  }

  const cap = veh.capacidadM3 ?? 0;
  const vol = tipo === "transporte" ? input.volumenSolicitadoM3 : 0;
  const planificados = tipo === "transporte" ? input.viajesPlanificados ?? (cap > 0 ? Math.max(1, Math.ceil(vol / cap - 1e-9)) : 1) : 0;
  const [n, d1] = tomar(data, "despacho");
  const id = `d-${pad(n)}`;
  const despacho: Despacho = {
    id,
    numero: `D-${pad(n)}`,
    tipo,
    ventaId: venta?.id,
    motivoIndependiente: venta ? undefined : limpiar(input.motivoIndependiente),
    clienteId: input.clienteId ?? venta?.clienteId,
    faenaId: input.faenaId ?? venta?.faenaId,
    referenciaDestino: input.faenaId || venta?.faenaId ? undefined : limpiar(input.referenciaDestino) ?? venta?.referenciaFaena,
    fecha: input.fecha,
    materialId: tipo === "transporte" ? venta?.materialId ?? input.materialId : undefined,
    vehiculoId: veh.id,
    conductorId: cond.id,
    volumenSolicitadoM3: vol,
    viajesPlanificados: planificados,
    estado: "programado",
    observaciones: limpiar(input.observaciones),
    creadoPor: ctx.userId,
    creadoEn: ctx.ahora,
    modificadoPor: ctx.userId,
    modificadoEn: ctx.ahora,
  };
  const detalle = `${despacho.numero}${venta ? ` para ${venta.numero}` : " (sin venta)"}: ${veh.codigo} con ${cond.nombre}, ${tipo === "transporte" ? m3(vol) : "trabajo de maquinaria"} el ${input.fecha}.`;
  const d2 = registrar({ ...d1, despachos: [...d1.despachos, despacho] }, ctx, "despacho", id, "Creación", detalle);
  return { ok: true, data: d2, id, numero: despacho.numero };
}

function liberarVehiculo(data: AppData, vehiculoId: string): AppData {
  const veh = idx(data).vehiculos.get(vehiculoId);
  if (!veh || veh.estado !== "en_operacion") return data;
  const sigueEnCurso = data.despachos.some((d) => d.vehiculoId === vehiculoId && d.estado === "en_curso");
  if (sigueEnCurso) return data;
  return { ...data, vehiculos: reemplazar(data.vehiculos, vehiculoId, (v) => ({ ...v, estado: "disponible" as const })) };
}

function ocuparVehiculo(data: AppData, vehiculoId: string): AppData {
  const veh = idx(data).vehiculos.get(vehiculoId);
  if (!veh || veh.estado !== "disponible") return data;
  return { ...data, vehiculos: reemplazar(data.vehiculos, vehiculoId, (v) => ({ ...v, estado: "en_operacion" as const })) };
}

/** Busca o crea el registro diario del conductor/vehículo/fecha y lo deja pendiente de validar. */
function asegurarRegistro(data: AppData, ctx: Ctx, d: Despacho, motivo?: string): { data: AppData; registro: RegistroDiario } {
  const existente = data.registros.find((r) => r.fecha === d.fecha && r.vehiculoId === d.vehiculoId && r.conductorId === d.conductorId);
  if (existente) {
    if (existente.estado === "pendiente") return { data, registro: existente };
    const [nv, d1] = tomar(data, "validacion");
    const accion = existente.estado === "validado" ? ("reabierto" as const) : ("corregido" as const);
    const actualizado: RegistroDiario = {
      ...existente,
      estado: "pendiente",
      modificadoEn: ctx.ahora,
      validaciones: [
        ...existente.validaciones,
        { id: `val-${pad(nv)}`, fecha: ctx.ahora, userId: ctx.userId, accion, comentario: motivo ?? (accion === "reabierto" ? "Se modificó una operación ya validada." : "Corrección del conductor.") },
      ],
    };
    const d2 = { ...d1, registros: reemplazar(d1.registros, existente.id, () => actualizado) };
    return { data: registrar(d2, ctx, "registro", existente.id, accion === "reabierto" ? "Reapertura" : "Corrección", `${existente.numero} vuelve a pendiente de validar.${motivo ? ` Motivo: ${motivo}` : ""}`), registro: actualizado };
  }
  const [n, d1] = tomar(data, "registro");
  const registro: RegistroDiario = {
    id: `r-${pad(n)}`,
    numero: `R-${pad(n)}`,
    fecha: d.fecha,
    conductorId: d.conductorId,
    vehiculoId: d.vehiculoId,
    estado: "pendiente",
    validaciones: [],
    creadoEn: ctx.ahora,
    modificadoEn: ctx.ahora,
  };
  return { data: { ...d1, registros: [...d1.registros, registro] }, registro };
}

/* ---------------- Flujo del conductor ---------------- */

export interface AvancePayload {
  lecturaInicial?: number | null;
  lecturaFinal?: number | null;
  combustibleConsumidoL?: number | null;
  combustibleCargadoL?: number | null;
  /** Lista COMPLETA de viajes del despacho: los existentes llevan `id`, los nuevos no. */
  viajes?: { id?: string; cantidadM3: number; observaciones?: string }[];
  observaciones?: string;
  incidencia?: string;
  /** Nombre del conductor que confirma al finalizar. */
  confirmaNombre?: string;
}

type ModoAvance = "avance" | "finalizar" | "incidencia";

function obtenerDespachoConductor(data: AppData, ctx: Ctx, id: string): { d: Despacho } | { error: ReturnType<typeof fallar> } {
  const d = idx(data).despachos.get(id);
  if (!d) return { error: fallar("La entrega no existe.") };
  const rol = rolDe(data, ctx);
  if (rol === "conductor" && d.conductorId !== ctx.userId) return { error: fallar("Esta entrega no está asignada a ti.") };
  if (rol === "vendedor") return { error: fallar("No tienes permiso para registrar operaciones.") };
  if (d.estado === "finalizado") return { error: fallar("Esta entrega ya fue finalizada. Si necesitas corregirla, avisa al administrador.") };
  if (d.estado === "anulado") return { error: fallar("Esta entrega fue anulada.") };
  return { d };
}

function aplicarAvance(data: AppData, ctx: Ctx, d0: Despacho, p: AvancePayload, modo: ModoAvance): Resultado<{ numeroRegistro?: string }> {
  const i = idx(data);
  const veh = i.vehiculos.get(d0.vehiculoId);
  if (!veh) return fallar("El vehículo de esta entrega ya no existe.");
  if ((veh.estado === "fuera_de_servicio" || veh.estado === "en_mantenimiento") && d0.estado === "programado") {
    return fallar(`${veh.codigo} está ${veh.estado === "en_mantenimiento" ? "en mantenimiento" : "fuera de servicio"}. Avisa al administrador.`);
  }
  const esKm = veh.medidor === "km";
  const nombreMedidor = esKm ? "kilometraje" : "horómetro";
  const transporte = d0.tipo === "transporte";

  const pick = <K extends keyof AvancePayload>(k: K, actual: number | undefined) => (p[k] === undefined ? actual : (p[k] as number | null) ?? undefined);
  const lecturaInicial = pick("lecturaInicial", d0.lecturaInicial);
  const lecturaFinal = pick("lecturaFinal", d0.lecturaFinal);
  const consumo = pick("combustibleConsumidoL", d0.combustibleConsumidoL);
  const cargado = p.combustibleCargadoL === undefined ? undefined : p.combustibleCargadoL ?? 0;

  const errL = validarLecturas(
    data,
    d0.vehiculoId,
    d0.id,
    { lecturaInicial: lecturaInicial ?? null, lecturaFinal: lecturaFinal ?? null, combustibleConsumidoL: consumo ?? null, combustibleCargadoL: cargado ?? null },
    { exigirInicialMayorAUltima: true },
  );
  const peL = primerError(errL);
  if (peL) return fallar(peL.error, peL.campo);

  // Viajes
  let d1 = data;
  let totalViajes = volumenEntregadoDespacho(data, d0.id);
  let hayViajes = viajesDeDespacho(data, d0.id).length > 0;
  if (transporte && p.viajes) {
    const cap = veh.capacidadM3 ?? Infinity;
    for (let k = 0; k < p.viajes.length; k++) {
      const c = p.viajes[k].cantidadM3;
      if (!esNumero(c) || c <= 0) return fallar(`El viaje ${k + 1} debe tener un volumen mayor que 0 m³.`, "viajes");
      if (c > cap + 1e-9) return fallar(`El viaje ${k + 1} (${m3(c)}) supera la capacidad del camión (${m3(cap)}).`, "viajes");
    }
    totalViajes = redondear(p.viajes.reduce((s, v) => s + v.cantidadM3, 0));
    hayViajes = p.viajes.length > 0;
    if (d0.ventaId) {
      const venta = i.ventas.get(d0.ventaId);
      if (venta) {
        const otros = volumenEntregadoVenta(data, venta.id) - volumenEntregadoDespacho(data, d0.id);
        const restante = redondear(venta.cantidadM3 - otros);
        if (totalViajes > restante + 1e-9) {
          return fallar(
            `Con estos viajes (${m3(totalViajes)}) se superaría lo vendido: quedan ${m3(restante)} por entregar. Pide autorización al administrador o informa una incidencia.`,
            "viajes",
            "exceso",
          );
        }
      }
    }
    // Reconciliación de viajes: actualiza, crea y anula (sin borrar evidencia)
    const existentes = viajesDeDespacho(data, d0.id);
    const idsRecibidos = new Set(p.viajes.filter((v) => v.id).map((v) => v.id as string));
    let viajesNuevos = [...d1.viajes];
    for (const e of existentes) {
      if (!idsRecibidos.has(e.id)) {
        viajesNuevos = reemplazar(viajesNuevos, e.id, (x) => ({ ...x, estado: "anulado" as const, motivoAnulacion: "Corregido por el conductor" }));
      }
    }
    let maxSec = Math.max(0, ...d1.viajes.filter((v) => v.despachoId === d0.id).map((v) => v.secuencia));
    const destinoTxt = d0.faenaId ? i.faenas.get(d0.faenaId)?.nombre : d0.referenciaDestino;
    for (const row of p.viajes) {
      if (row.id) {
        viajesNuevos = reemplazar(viajesNuevos, row.id, (x) => ({ ...x, cantidadM3: row.cantidadM3, observaciones: limpiar(row.observaciones) }));
      } else {
        const [nv, dTmp] = tomar(d1, "viaje");
        d1 = dTmp;
        maxSec++;
        const nuevo: Viaje = {
          id: `via-${pad(nv, 5)}`,
          despachoId: d0.id,
          secuencia: maxSec,
          fechaHora: ctx.ahora,
          vehiculoId: d0.vehiculoId,
          conductorId: d0.conductorId,
          materialId: d0.materialId,
          destino: destinoTxt ?? "Destino sin especificar",
          cantidadM3: row.cantidadM3,
          estado: "valido",
          observaciones: limpiar(row.observaciones),
        };
        viajesNuevos.push(nuevo);
      }
    }
    d1 = { ...d1, viajes: viajesNuevos };
  }

  // Datos obligatorios al finalizar (se informa el dato exacto que falta)
  if (modo === "finalizar") {
    if (transporte && !hayViajes) return fallar("Falta anotar los viajes realizados (al menos uno).", "viajes");
    if (transporte && totalViajes <= 0) return fallar("Falta el volumen entregado.", "viajes");
    if (lecturaInicial == null) return fallar(`Falta el ${nombreMedidor} inicial.`, "lecturaInicial");
    if (lecturaFinal == null) return fallar(`Falta el ${nombreMedidor} final.`, "lecturaFinal");
    if (lecturaFinal <= lecturaInicial) return fallar(`El ${nombreMedidor} final debe ser mayor que el inicial.`, "lecturaFinal");
    if (consumo == null) return fallar("Falta anotar los litros de combustible consumidos (puede ser 0).", "combustibleConsumidoL");
    if (!limpiar(p.confirmaNombre)) return fallar("Falta confirmar que los datos son correctos.", "confirma");
  }
  if (modo === "incidencia" && !limpiar(p.incidencia)) return fallar("Cuéntanos brevemente qué pasó.", "incidencia");

  // Carga de combustible sincronizada con la entrega (no se confunde con el consumo)
  if (cargado !== undefined) {
    const previa = d1.cargas.find((c) => c.despachoId === d0.id);
    if (cargado > 0) {
      if (previa) {
        d1 = { ...d1, cargas: reemplazar(d1.cargas, previa.id, (c) => ({ ...c, litros: cargado })) };
      } else {
        const [nc, dTmp] = tomar(d1, "carga");
        d1 = dTmp;
        const carga: CargaCombustible = { id: `cg-${pad(nc)}`, fecha: d0.fecha, vehiculoId: d0.vehiculoId, conductorId: d0.conductorId, litros: cargado, despachoId: d0.id, creadoPor: ctx.userId };
        d1 = { ...d1, cargas: [...d1.cargas, carga] };
      }
    } else if (previa) {
      d1 = { ...d1, cargas: d1.cargas.filter((c) => c.id !== previa.id) };
    }
  }

  // Estado
  let estado: EstadoDespacho = d0.estado === "programado" ? "en_curso" : d0.estado;
  if (modo === "finalizar") estado = "finalizado";
  if (modo === "incidencia") estado = "incidencia";
  if (modo === "avance" && d0.estado === "incidencia") estado = "en_curso";

  const actualizado: Despacho = {
    ...d0,
    estado,
    lecturaInicial,
    lecturaFinal,
    combustibleConsumidoL: consumo,
    observaciones: p.observaciones !== undefined ? limpiar(p.observaciones) : d0.observaciones,
    incidencia: modo === "incidencia" ? limpiar(p.incidencia) : d0.incidencia,
    horaInicio: d0.horaInicio ?? ctx.ahora,
    horaFin: modo === "finalizar" ? ctx.ahora : d0.horaFin,
    conformidad: modo === "finalizar" ? { nombre: limpiar(p.confirmaNombre) as string, fecha: ctx.ahora } : d0.conformidad,
    modificadoPor: ctx.userId,
    modificadoEn: ctx.ahora,
  };
  d1 = { ...d1, despachos: reemplazar(d1.despachos, d0.id, () => actualizado) };

  let numeroRegistro: string | undefined;
  if (modo === "finalizar" || (modo === "incidencia" && (hayViajes || lecturaInicial != null))) {
    const r = asegurarRegistro(d1, ctx, actualizado);
    d1 = r.data;
    d1 = { ...d1, despachos: reemplazar(d1.despachos, d0.id, (x) => ({ ...x, registroDiarioId: r.registro.id })) };
    numeroRegistro = r.registro.numero;
  }
  d1 = estado === "en_curso" ? ocuparVehiculo(d1, d0.vehiculoId) : estado === "finalizado" ? liberarVehiculo(d1, d0.vehiculoId) : d1;

  const accion = modo === "finalizar" ? "Finalización" : modo === "incidencia" ? "Incidencia" : d0.estado === "programado" ? "Inicio" : "Avance guardado";
  const detalle =
    modo === "finalizar"
      ? `${d0.numero} finalizado por ${i.usuarios.get(ctx.userId)?.nombre ?? "conductor"}: ${transporte ? `${m3(totalViajes)} en ${p.viajes?.length ?? viajesDeDespacho(d1, d0.id).length} viaje(s)` : "trabajo de maquinaria"}.`
      : modo === "incidencia"
        ? `${d0.numero}: ${limpiar(p.incidencia)}`
        : `${d0.numero}: avance guardado.`;
  return { ok: true, data: registrar(d1, ctx, "despacho", d0.id, accion, detalle), numeroRegistro };
}

export function iniciarEntrega(data: AppData, ctx: Ctx, despachoId: string): Resultado {
  const r = obtenerDespachoConductor(data, ctx, despachoId);
  if ("error" in r) return r.error;
  const d = r.d;
  if (d.estado !== "programado") return { ok: true, data };
  const veh = idx(data).vehiculos.get(d.vehiculoId);
  if (veh && (veh.estado === "fuera_de_servicio" || veh.estado === "en_mantenimiento")) {
    return fallar(`${veh.codigo} está ${veh.estado === "en_mantenimiento" ? "en mantenimiento" : "fuera de servicio"}. Avisa al administrador.`);
  }
  const lecturaInicial = d.lecturaInicial ?? lecturaPrevia(data, d.vehiculoId, d.id);
  let d1 = { ...data, despachos: reemplazar(data.despachos, d.id, (x) => ({ ...x, estado: "en_curso" as const, horaInicio: ctx.ahora, lecturaInicial, modificadoPor: ctx.userId, modificadoEn: ctx.ahora })) };
  d1 = ocuparVehiculo(d1, d.vehiculoId);
  return { ok: true, data: registrar(d1, ctx, "despacho", d.id, "Inicio", `${d.numero} iniciado.`) };
}

export function guardarAvanceConductor(data: AppData, ctx: Ctx, despachoId: string, p: AvancePayload): Resultado {
  const r = obtenerDespachoConductor(data, ctx, despachoId);
  if ("error" in r) return r.error;
  return aplicarAvance(data, ctx, r.d, p, "avance");
}

export function finalizarEntregaConductor(data: AppData, ctx: Ctx, despachoId: string, p: AvancePayload): Resultado<{ numeroRegistro?: string }> {
  const r = obtenerDespachoConductor(data, ctx, despachoId);
  if ("error" in r) return r.error;
  return aplicarAvance(data, ctx, r.d, p, "finalizar");
}

export function informarIncidencia(data: AppData, ctx: Ctx, despachoId: string, p: AvancePayload): Resultado {
  const r = obtenerDespachoConductor(data, ctx, despachoId);
  if ("error" in r) return r.error;
  return aplicarAvance(data, ctx, r.d, p, "incidencia");
}

/* ---------------- Gestión por el administrador ---------------- */

export function registrarViajeAdmin(
  data: AppData,
  ctx: Ctx,
  despachoId: string,
  input: { cantidadM3: number; fechaHora?: ISODateTime; observaciones?: string },
  opciones: { autorizarExceso?: boolean } = {},
): Resultado<{ id: string }> {
  if (!permiso(data, ctx, "despachos.registrar_viajes")) return fallar("Solo el administrador puede agregar viajes manualmente.");
  const i = idx(data);
  const d = i.despachos.get(despachoId);
  if (!d) return fallar("El despacho no existe.");
  if (d.tipo !== "transporte") return fallar("Este despacho es un trabajo de maquinaria y no tiene viajes de material.");
  if (d.estado === "anulado") return fallar("No se pueden agregar viajes a un despacho anulado.");
  if (!esNumero(input.cantidadM3) || input.cantidadM3 <= 0) return fallar("Ingresa un volumen mayor que 0 m³.", "cantidadM3");
  const veh = i.vehiculos.get(d.vehiculoId);
  const cap = veh?.capacidadM3 ?? Infinity;
  if (input.cantidadM3 > cap + 1e-9) return fallar(`El viaje (${m3(input.cantidadM3)}) supera la capacidad de ${veh?.codigo} (${m3(cap)}).`, "cantidadM3");
  let excede = false;
  if (d.ventaId) {
    const venta = i.ventas.get(d.ventaId);
    if (venta) {
      const restante = redondear(venta.cantidadM3 - volumenEntregadoVenta(data, venta.id));
      if (input.cantidadM3 > restante + 1e-9) {
        if (!opciones.autorizarExceso) return fallar(textoExceso(restante), "cantidadM3", "exceso");
        excede = true;
      }
    }
  }
  const [nv, d1] = tomar(data, "viaje");
  const sec = Math.max(0, ...d1.viajes.filter((v) => v.despachoId === d.id).map((v) => v.secuencia)) + 1;
  const viaje: Viaje = {
    id: `via-${pad(nv, 5)}`,
    despachoId: d.id,
    secuencia: sec,
    fechaHora: input.fechaHora ?? ctx.ahora,
    vehiculoId: d.vehiculoId,
    conductorId: d.conductorId,
    materialId: d.materialId,
    destino: (d.faenaId ? i.faenas.get(d.faenaId)?.nombre : d.referenciaDestino) ?? "Destino sin especificar",
    cantidadM3: input.cantidadM3,
    estado: "valido",
    observaciones: limpiar(input.observaciones),
    autorizadoExceso: excede || undefined,
  };
  const d2 = registrar({ ...d1, viajes: [...d1.viajes, viaje] }, ctx, "viaje", viaje.id, excede ? "Viaje con exceso autorizado" : "Viaje agregado", `${d.numero}: viaje ${sec} de ${m3(viaje.cantidadM3)}${excede ? " (exceso autorizado explícitamente)" : ""}.`);
  return { ok: true, data: d2, id: viaje.id };
}

export function anularViaje(data: AppData, ctx: Ctx, viajeId: string, motivo: string): Resultado {
  if (!permiso(data, ctx, "despachos.anular")) return fallar("Solo el administrador puede anular viajes.");
  const v = data.viajes.find((x) => x.id === viajeId);
  if (!v) return fallar("El viaje no existe.");
  if (v.estado === "anulado") return fallar("El viaje ya está anulado.");
  if (!motivoValido(motivo)) return fallar("Indica el motivo de la anulación.", "motivo");
  const d = idx(data).despachos.get(v.despachoId);
  let d1 = { ...data, viajes: reemplazar(data.viajes, viajeId, (x) => ({ ...x, estado: "anulado" as const, motivoAnulacion: motivo.trim() })) };
  d1 = registrar(d1, ctx, "viaje", viajeId, "Anulación de viaje", `${d?.numero ?? ""}: viaje ${v.secuencia} (${m3(v.cantidadM3)}) anulado: ${motivo.trim()}`);
  if (d?.registroDiarioId) d1 = reabrirRegistroSiValidado(d1, ctx, d.registroDiarioId, `Viaje ${v.secuencia} anulado: ${motivo.trim()}`);
  return { ok: true, data: d1 };
}

function reabrirRegistroSiValidado(data: AppData, ctx: Ctx, registroId: string, motivo: string): AppData {
  const r = data.registros.find((x) => x.id === registroId);
  if (!r || r.estado !== "validado") return data;
  const [nv, d1] = tomar(data, "validacion");
  const act: RegistroDiario = {
    ...r,
    estado: "pendiente",
    modificadoEn: ctx.ahora,
    validaciones: [...r.validaciones, { id: `val-${pad(nv)}`, fecha: ctx.ahora, userId: ctx.userId, accion: "reabierto", comentario: motivo }],
  };
  return registrar({ ...d1, registros: reemplazar(d1.registros, registroId, () => act) }, ctx, "registro", registroId, "Reapertura", `${r.numero} vuelve a pendiente: ${motivo}`);
}

export interface DespachoPatch {
  fecha?: ISODate;
  vehiculoId?: string;
  conductorId?: string;
  volumenSolicitadoM3?: number;
  viajesPlanificados?: number;
  lecturaInicial?: number | null;
  lecturaFinal?: number | null;
  combustibleConsumidoL?: number | null;
  observaciones?: string;
}

export function editarDespacho(
  data: AppData,
  ctx: Ctx,
  id: string,
  patch: DespachoPatch,
  opciones: { motivo?: string; autorizarExceso?: boolean; autorizarVehiculo?: boolean } = {},
): Resultado {
  if (!permiso(data, ctx, "despachos.editar")) return fallar("No tienes permiso para editar despachos.");
  const i = idx(data);
  const d = i.despachos.get(id);
  if (!d) return fallar("El despacho no existe.");
  if (d.estado === "anulado") return fallar("Un despacho anulado no se puede editar.");
  const reg = d.registroDiarioId ? data.registros.find((r) => r.id === d.registroDiarioId) : undefined;
  if (reg?.estado === "validado" && !motivoValido(opciones.motivo)) {
    return fallar("Este despacho pertenece a un registro ya validado. Indica el motivo de la corrección.", "motivo");
  }
  const vehiculoId = patch.vehiculoId ?? d.vehiculoId;
  const veh = i.vehiculos.get(vehiculoId);
  if (!veh) return fallar("Selecciona un camión o máquina.", "vehiculoId");
  const cambiaVeh = vehiculoId !== d.vehiculoId;
  if (cambiaVeh && (veh.estado === "fuera_de_servicio" || veh.estado === "en_mantenimiento") && !opciones.autorizarVehiculo) {
    return fallar(`${veh.codigo} está ${veh.estado === "en_mantenimiento" ? "en mantenimiento" : "fuera de servicio"}. Autoriza la excepción para asignarlo.`, "vehiculoId", "vehiculo");
  }
  if (cambiaVeh && d.tipo === "transporte" && veh.tipo === "maquinaria") return fallar("Un despacho de material necesita un camión.", "vehiculoId");
  const conductorId = patch.conductorId ?? d.conductorId;
  const cond = i.usuarios.get(conductorId);
  if (!cond || cond.rol !== "conductor") return fallar("Selecciona un conductor.", "conductorId");

  const lecturaInicial = patch.lecturaInicial === undefined ? d.lecturaInicial : patch.lecturaInicial ?? undefined;
  const lecturaFinal = patch.lecturaFinal === undefined ? d.lecturaFinal : patch.lecturaFinal ?? undefined;
  const consumo = patch.combustibleConsumidoL === undefined ? d.combustibleConsumidoL : patch.combustibleConsumidoL ?? undefined;
  const errL = validarLecturas(data, vehiculoId, id, { lecturaInicial: lecturaInicial ?? null, lecturaFinal: lecturaFinal ?? null, combustibleConsumidoL: consumo ?? null });
  const peL = primerError(errL);
  if (peL) return fallar(peL.error, peL.campo);

  let volumen = d.volumenSolicitadoM3;
  if (patch.volumenSolicitadoM3 !== undefined && d.tipo === "transporte") {
    if (!esNumero(patch.volumenSolicitadoM3) || patch.volumenSolicitadoM3 <= 0) return fallar("Ingresa un volumen mayor que 0 m³.", "volumenSolicitadoM3");
    volumen = patch.volumenSolicitadoM3;
    if (volumen < volumenEntregadoDespacho(data, id) - 1e-9) return fallar(`El volumen no puede ser menor que lo ya entregado (${m3(volumenEntregadoDespacho(data, id))}).`, "volumenSolicitadoM3");
    const venta = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
    if (venta) {
      const disponible = redondear(venta.cantidadM3 - volumenProgramadoVenta(data, venta.id, id));
      if (volumen > disponible + 1e-9 && !opciones.autorizarExceso) return fallar(textoExceso(disponible), "volumenSolicitadoM3", "exceso");
    }
  }
  if (patch.fecha !== undefined) {
    const venta = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
    if (!patch.fecha) return fallar("Indica la fecha.", "fecha");
    if (venta && patch.fecha < venta.fecha) return fallar("El despacho no puede ser anterior a la venta.", "fecha");
  }
  const actualizado: Despacho = {
    ...d,
    fecha: patch.fecha ?? d.fecha,
    vehiculoId,
    conductorId,
    volumenSolicitadoM3: volumen,
    viajesPlanificados: patch.viajesPlanificados ?? d.viajesPlanificados,
    lecturaInicial,
    lecturaFinal,
    combustibleConsumidoL: consumo,
    observaciones: patch.observaciones !== undefined ? limpiar(patch.observaciones) : d.observaciones,
    modificadoPor: ctx.userId,
    modificadoEn: ctx.ahora,
  };
  let d1 = { ...data, despachos: reemplazar(data.despachos, id, () => actualizado) };
  // Si cambia vehículo o conductor los viajes ya registrados siguen el despacho
  if (cambiaVeh || conductorId !== d.conductorId) {
    d1 = { ...d1, viajes: d1.viajes.map((v) => (v.despachoId === id ? { ...v, vehiculoId, conductorId } : v)) };
  }
  d1 = registrar(d1, ctx, "despacho", id, reg?.estado === "validado" ? "Corrección de registro validado" : "Edición", `${d.numero} editado${opciones.motivo ? `. Motivo: ${opciones.motivo.trim()}` : "."}`);
  if (reg?.estado === "validado" && opciones.motivo) d1 = reabrirRegistroSiValidado(d1, ctx, reg.id, opciones.motivo.trim());
  return { ok: true, data: d1 };
}

export function anularDespacho(data: AppData, ctx: Ctx, id: string, motivo: string): Resultado {
  const i = idx(data);
  const d = i.despachos.get(id);
  if (!d) return fallar("El despacho no existe.");
  if (d.estado === "anulado") return fallar("El despacho ya está anulado.");
  const rol = rolDe(data, ctx);
  const venta = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
  const tieneViajes = viajesDeDespacho(data, id).length > 0;
  if (rol === "vendedor") {
    if (!venta || venta.vendedorId !== ctx.userId) return fallar("Solo puedes anular despachos de tus ventas.");
    if (d.estado !== "programado" || tieneViajes) return fallar("Solo el administrador puede anular un despacho que ya se inició.");
  } else if (!permiso(data, ctx, "despachos.anular")) {
    return fallar("No tienes permiso para anular despachos.");
  }
  if (!motivoValido(motivo)) return fallar("Indica el motivo de la anulación.", "motivo");
  const actualizado: Despacho = { ...d, estado: "anulado", motivoAnulacion: motivo.trim(), modificadoPor: ctx.userId, modificadoEn: ctx.ahora };
  let d1 = { ...data, despachos: reemplazar(data.despachos, id, () => actualizado) };
  d1 = liberarVehiculo(d1, d.vehiculoId);
  d1 = registrar(d1, ctx, "despacho", id, "Anulación", `${d.numero} anulado${tieneViajes ? ` (${m3(volumenEntregadoDespacho(data, id))} dejan de contarse como entregados)` : ""}: ${motivo.trim()}`);
  if (d.registroDiarioId) d1 = reabrirRegistroSiValidado(d1, ctx, d.registroDiarioId, `${d.numero} anulado: ${motivo.trim()}`);
  return { ok: true, data: d1 };
}

export function reabrirDespacho(data: AppData, ctx: Ctx, id: string, motivo: string): Resultado {
  if (!permiso(data, ctx, "despachos.editar")) return fallar("Solo el administrador puede reabrir un despacho.");
  const d = idx(data).despachos.get(id);
  if (!d) return fallar("El despacho no existe.");
  if (d.estado !== "incidencia" && d.estado !== "finalizado") return fallar("Solo se puede reabrir un despacho finalizado o con incidencia.");
  if (!motivoValido(motivo)) return fallar("Indica el motivo de la reapertura.", "motivo");
  let d1 = { ...data, despachos: reemplazar(data.despachos, id, (x) => ({ ...x, estado: "en_curso" as const, horaFin: undefined, modificadoPor: ctx.userId, modificadoEn: ctx.ahora })) };
  d1 = ocuparVehiculo(d1, d.vehiculoId);
  d1 = registrar(d1, ctx, "despacho", id, "Reapertura", `${d.numero} reabierto: ${motivo.trim()}`);
  if (d.registroDiarioId) d1 = reabrirRegistroSiValidado(d1, ctx, d.registroDiarioId, `${d.numero} reabierto: ${motivo.trim()}`);
  return { ok: true, data: d1 };
}

/* ================================================================== */
/* Registros diarios                                                    */
/* ================================================================== */

export function validarRegistro(data: AppData, ctx: Ctx, id: string, opciones: { comentario?: string; aceptarIncompleto?: boolean } = {}): Resultado {
  if (!permiso(data, ctx, "registros.validar")) return fallar("Solo el administrador o supervisor puede validar registros.");
  const r = data.registros.find((x) => x.id === id);
  if (!r) return fallar("El registro no existe.");
  if (r.estado === "validado") return fallar("El registro ya está validado.");
  const ds = data.despachos.filter((d) => d.registroDiarioId === id && d.estado !== "anulado");
  if (ds.length === 0) return fallar("El registro no tiene operaciones activas para validar.");
  const abiertos = ds.filter((d) => d.estado === "en_curso" || d.estado === "programado");
  if (abiertos.length > 0) return fallar(`Hay operaciones sin finalizar (${abiertos.map((d) => d.numero).join(", ")}).`);
  const incompleto = ds.some((d) => !trabajoDespacho(data, d).valida || d.combustibleConsumidoL == null);
  if (incompleto && !opciones.aceptarIncompleto) {
    return fallar("Este registro tiene datos incompletos o inconsistentes (lectura o combustible). Se excluirán de los rendimientos. ¿Validar de todas formas?", undefined, "incompleto");
  }
  const [nv, d1] = tomar(data, "validacion");
  const reg: RegistroDiario = {
    ...r,
    estado: "validado",
    modificadoEn: ctx.ahora,
    validaciones: [...r.validaciones, { id: `val-${pad(nv)}`, fecha: ctx.ahora, userId: ctx.userId, accion: "aprobado", comentario: limpiar(opciones.comentario) }],
  };
  // Lectura del vehículo: solo lecturas válidas y nunca retrocede
  let vehiculos = d1.vehiculos;
  const veh = idx(d1).vehiculos.get(r.vehiculoId);
  if (veh) {
    const finales = ds.filter((d) => trabajoDespacho(data, d).valida && d.lecturaFinal != null).map((d) => d.lecturaFinal as number);
    const max = Math.max(veh.lecturaActual, ...finales);
    if (max > veh.lecturaActual) vehiculos = reemplazar(vehiculos, veh.id, (v) => ({ ...v, lecturaActual: max }));
  }
  const d2 = { ...d1, vehiculos, registros: reemplazar(d1.registros, id, () => reg) };
  return { ok: true, data: registrar(d2, ctx, "registro", id, "Validación", `${r.numero} aprobado${opciones.comentario ? `: ${opciones.comentario.trim()}` : "."}`) };
}

export function devolverRegistro(data: AppData, ctx: Ctx, id: string, comentario: string): Resultado {
  if (!permiso(data, ctx, "registros.validar")) return fallar("Solo el administrador o supervisor puede devolver registros.");
  const r = data.registros.find((x) => x.id === id);
  if (!r) return fallar("El registro no existe.");
  if (r.estado === "validado") return fallar("Un registro validado no se devuelve: reábrelo corrigiendo la operación con su motivo.");
  if (!motivoValido(comentario)) return fallar("Indica qué debe corregir el conductor.", "comentario");
  const [nv, d1] = tomar(data, "validacion");
  const reg: RegistroDiario = {
    ...r,
    estado: "devuelto",
    modificadoEn: ctx.ahora,
    validaciones: [...r.validaciones, { id: `val-${pad(nv)}`, fecha: ctx.ahora, userId: ctx.userId, accion: "devuelto", comentario: comentario.trim() }],
  };
  const d2 = { ...d1, registros: reemplazar(d1.registros, id, () => reg) };
  return { ok: true, data: registrar(d2, ctx, "registro", id, "Devolución", `${r.numero} devuelto: ${comentario.trim()}`) };
}

export function guardarObservacionRegistro(data: AppData, ctx: Ctx, id: string, observaciones: string, motivo?: string): Resultado {
  if (!permiso(data, ctx, "registros.validar")) return fallar("No tienes permiso para editar registros.");
  const r = data.registros.find((x) => x.id === id);
  if (!r) return fallar("El registro no existe.");
  if (r.estado === "validado" && !motivoValido(motivo)) return fallar("El registro ya está validado: indica el motivo del cambio.", "motivo");
  let d1 = { ...data, registros: reemplazar(data.registros, id, (x) => ({ ...x, observaciones: limpiar(observaciones), modificadoEn: ctx.ahora })) };
  d1 = registrar(d1, ctx, "registro", id, "Edición", `${r.numero}: observaciones actualizadas${motivo ? ` (${motivo.trim()})` : ""}.`);
  if (r.estado === "validado") d1 = reabrirRegistroSiValidado(d1, ctx, id, motivo as string);
  return { ok: true, data: d1 };
}

/* ================================================================== */
/* Combustible e insumos                                                */
/* ================================================================== */

export function guardarCarga(data: AppData, ctx: Ctx, c: Omit<CargaCombustible, "id" | "creadoPor"> & { id?: string }): Resultado<{ id: string }> {
  if (!permiso(data, ctx, "combustible.editar")) return fallar("Solo el administrador puede registrar cargas de combustible.");
  const veh = idx(data).vehiculos.get(c.vehiculoId);
  if (!veh) return fallar("Selecciona un vehículo.", "vehiculoId");
  if (!esNumero(c.litros) || c.litros <= 0) return fallar("Ingresa litros cargados mayores que 0.", "litros");
  if (c.litros > 1500) return fallar("Los litros cargados parecen demasiados (máximo 1.500 L).", "litros");
  if (c.precioPorLitro != null && (!esNumero(c.precioPorLitro) || c.precioPorLitro < 0)) return fallar("El precio por litro no es válido.", "precioPorLitro");
  if (!c.fecha) return fallar("Indica la fecha de la carga.", "fecha");
  if (c.fecha > ctx.hoy) return fallar("La carga no puede tener fecha futura.", "fecha");
  if (c.id) {
    const previa = data.cargas.find((x) => x.id === c.id);
    if (!previa) return fallar("La carga no existe.");
    const d1 = { ...data, cargas: reemplazar(data.cargas, c.id, (x) => ({ ...x, ...c, id: x.id, creadoPor: x.creadoPor })) };
    return { ok: true, data: registrar(d1, ctx, "carga", c.id, "Edición", `Carga de ${veh.codigo} editada: ${num(c.litros)} L.`), id: c.id };
  }
  const [n, d1] = tomar(data, "carga");
  const id = `cg-${pad(n)}`;
  const nueva: CargaCombustible = { ...c, id, creadoPor: ctx.userId };
  return { ok: true, data: registrar({ ...d1, cargas: [...d1.cargas, nueva] }, ctx, "carga", id, "Carga de combustible", `${veh.codigo}: ${num(c.litros)} L cargados (no es consumo).`), id };
}

export function eliminarCarga(data: AppData, ctx: Ctx, id: string): Resultado {
  if (!permiso(data, ctx, "combustible.editar")) return fallar("Solo el administrador puede eliminar cargas.");
  const c = data.cargas.find((x) => x.id === id);
  if (!c) return fallar("La carga no existe.");
  const d1 = { ...data, cargas: data.cargas.filter((x) => x.id !== id) };
  return { ok: true, data: registrar(d1, ctx, "carga", id, "Eliminación", `Carga de ${num(c.litros)} L eliminada.`) };
}

export function guardarInsumo(data: AppData, ctx: Ctx, x: Omit<InsumoMantenimiento, "id" | "creadoPor">): Resultado<{ id: string }> {
  if (!permiso(data, ctx, "combustible.editar")) return fallar("Solo el administrador puede registrar insumos.");
  if (!idx(data).vehiculos.get(x.vehiculoId)) return fallar("Selecciona un vehículo.", "vehiculoId");
  if (!esNumero(x.cantidad) || x.cantidad <= 0) return fallar("Ingresa una cantidad mayor que 0.", "cantidad");
  if (x.costo != null && (!esNumero(x.costo) || x.costo < 0)) return fallar("El costo no es válido.", "costo");
  if (!x.fecha) return fallar("Indica la fecha.", "fecha");
  const [n, d1] = tomar(data, "insumo");
  const id = `ins-${pad(n)}`;
  const nuevo: InsumoMantenimiento = { ...x, id, creadoPor: ctx.userId };
  return { ok: true, data: registrar({ ...d1, insumos: [...d1.insumos, nuevo] }, ctx, "insumo", id, "Insumo registrado", `${idx(data).vehiculos.get(x.vehiculoId)?.codigo}: ${x.tipo} (${num(x.cantidad)} ${x.unidad}).`), id };
}

/** El conductor informa un insumo de mantenimiento (aceite, grasa, filtros) usado durante su entrega. Es opcional. */
export function registrarInsumoConductor(
  data: AppData,
  ctx: Ctx,
  despachoId: string,
  x: { tipo: InsumoMantenimiento["tipo"]; cantidad: number; unidad: InsumoMantenimiento["unidad"]; nota?: string },
): Resultado<{ id: string }> {
  const r = obtenerDespachoConductor(data, ctx, despachoId);
  if ("error" in r) return r.error;
  const d = r.d;
  if (!esNumero(x.cantidad) || x.cantidad <= 0) return fallar("Ingresa una cantidad mayor que 0.", "cantidad");
  if (x.cantidad > 500) return fallar("La cantidad parece demasiado alta. Revisa el dato.", "cantidad");
  const [n, d1] = tomar(data, "insumo");
  const id = `ins-${pad(n)}`;
  const nuevo: InsumoMantenimiento = { id, fecha: d.fecha, vehiculoId: d.vehiculoId, registroDiarioId: d.registroDiarioId, tipo: x.tipo, cantidad: x.cantidad, unidad: x.unidad, nota: limpiar(x.nota), creadoPor: ctx.userId };
  const veh = idx(data).vehiculos.get(d.vehiculoId);
  return { ok: true, data: registrar({ ...d1, insumos: [...d1.insumos, nuevo] }, ctx, "insumo", id, "Insumo informado", `${veh?.codigo ?? ""} (${d.numero}): ${x.tipo} ${num(x.cantidad)} ${x.unidad}.`), id };
}

export function eliminarInsumoConductor(data: AppData, ctx: Ctx, insumoId: string): Resultado {
  const ins = data.insumos.find((x) => x.id === insumoId);
  if (!ins) return fallar("El insumo no existe.");
  if (rolDe(data, ctx) !== "conductor" || ins.creadoPor !== ctx.userId) return fallar("Solo puedes quitar insumos que informaste tú.");
  const reg = ins.registroDiarioId ? data.registros.find((r) => r.id === ins.registroDiarioId) : undefined;
  if (reg?.estado === "validado") return fallar("El registro ya fue validado; avisa al administrador.");
  return { ok: true, data: registrar({ ...data, insumos: data.insumos.filter((x) => x.id !== insumoId) }, ctx, "insumo", insumoId, "Eliminación", "Insumo quitado por el conductor.") };
}

export function eliminarInsumo(data: AppData, ctx: Ctx, id: string): Resultado {
  if (!permiso(data, ctx, "combustible.editar")) return fallar("Solo el administrador puede eliminar insumos.");
  if (!data.insumos.some((x) => x.id === id)) return fallar("El insumo no existe.");
  return { ok: true, data: registrar({ ...data, insumos: data.insumos.filter((x) => x.id !== id) }, ctx, "insumo", id, "Eliminación", "Insumo eliminado.") };
}

/* ================================================================== */
/* Catálogos                                                            */
/* ================================================================== */

export type Catalogo = "clientes" | "faenas" | "vehiculos" | "materiales" | "usuarios";

const CAT: Record<Catalogo, { seq: string; prefijo: string; etiqueta: string }> = {
  clientes: { seq: "cliente", prefijo: "c-", etiqueta: "Cliente" },
  faenas: { seq: "faena", prefijo: "f-", etiqueta: "Faena" },
  vehiculos: { seq: "vehiculo", prefijo: "veh-", etiqueta: "Vehículo" },
  materiales: { seq: "material", prefijo: "m-", etiqueta: "Material" },
  usuarios: { seq: "usuario", prefijo: "u-", etiqueta: "Usuario" },
};

function permisoCatalogo(data: AppData, ctx: Ctx, cat: Catalogo): boolean {
  if (permiso(data, ctx, "catalogos.administrar")) return true;
  return cat === "clientes" && permiso(data, ctx, "catalogos.editar_clientes");
}

export function guardarEntidad(data: AppData, ctx: Ctx, cat: Catalogo, registro: Record<string, unknown> & { id?: string }): Resultado<{ id: string }> {
  if (!permisoCatalogo(data, ctx, cat)) return fallar("No tienes permiso para modificar este catálogo.");
  const errs = validarCatalogo(data, cat, registro);
  const pe = primerError(errs);
  if (pe) return fallar(pe.error, pe.campo);
  const lista = data[cat] as unknown as { id: string }[];
  const meta = CAT[cat];
  const limpio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(registro)) {
    limpio[k] = typeof v === "string" ? v.trim() || undefined : v;
  }
  const nombre = String(limpio.nombre ?? limpio.codigo ?? "");
  if (registro.id) {
    const previa = lista.find((x) => x.id === registro.id);
    if (!previa) return fallar(`${meta.etiqueta} no existe.`);
    if (cat === "usuarios" && registro.id === ctx.userId && limpio.activo === false) return fallar("No puedes desactivar tu propio usuario mientras lo usas.");
    const mezclada = { ...previa, ...limpio };
    // Precios: el cambio de catálogo no altera ventas históricas (guardan su propio precio).
    const d1 = { ...data, [cat]: lista.map((x) => (x.id === registro.id ? mezclada : x)) } as AppData;
    let extra = "";
    if (cat === "materiales" && (previa as { precioReferencia?: number }).precioReferencia !== limpio.precioReferencia) {
      extra = ` Precio de referencia ${clp((previa as { precioReferencia?: number }).precioReferencia)}→${clp(limpio.precioReferencia as number)} (las ventas anteriores conservan su precio).`;
    }
    return { ok: true, data: registrar(d1, ctx, cat, registro.id, "Edición", `${meta.etiqueta} «${nombre}» actualizado.${extra}`), id: registro.id };
  }
  const [n, d0] = tomar(data, meta.seq);
  const id = `${meta.prefijo}${n}`;
  const nuevo = { ...limpio, id };
  if (cat === "clientes" || cat === "faenas" || cat === "materiales" || cat === "usuarios") (nuevo as Record<string, unknown>).activo = limpio.activo !== false;
  const d1 = { ...d0, [cat]: [...(d0[cat] as unknown[]), nuevo] } as AppData;
  return { ok: true, data: registrar(d1, ctx, cat, id, "Creación", `${meta.etiqueta} «${nombre}» creado.`), id };
}

function referencias(data: AppData, cat: Catalogo, id: string): string | null {
  switch (cat) {
    case "clientes": {
      const n = data.ventas.filter((v) => v.clienteId === id).length + data.despachos.filter((d) => d.clienteId === id).length + data.faenas.filter((f) => f.clienteId === id).length;
      return n > 0 ? "tiene ventas, despachos o faenas asociadas" : null;
    }
    case "faenas": {
      const n = data.ventas.filter((v) => v.faenaId === id).length + data.despachos.filter((d) => d.faenaId === id).length;
      return n > 0 ? "tiene ventas o despachos asociados" : null;
    }
    case "vehiculos": {
      const n = data.despachos.filter((d) => d.vehiculoId === id).length + data.cargas.filter((c) => c.vehiculoId === id).length + data.insumos.filter((x) => x.vehiculoId === id).length;
      return n > 0 ? "tiene despachos, cargas o insumos registrados" : null;
    }
    case "materiales": {
      const n = data.ventas.filter((v) => v.materialId === id).length + data.despachos.filter((d) => d.materialId === id).length;
      return n > 0 ? "tiene ventas o despachos asociados" : null;
    }
    case "usuarios": {
      const n = data.ventas.filter((v) => v.vendedorId === id || v.creadoPor === id).length + data.despachos.filter((d) => d.conductorId === id || d.creadoPor === id).length + data.registros.filter((r) => r.conductorId === id).length;
      return n > 0 ? "tiene ventas, despachos o registros asociados" : null;
    }
  }
}

export function eliminarEntidad(data: AppData, ctx: Ctx, cat: Catalogo, id: string): Resultado {
  if (!permiso(data, ctx, "catalogos.administrar")) return fallar("Solo el administrador puede eliminar registros de catálogo.");
  const lista = data[cat] as unknown as { id: string }[];
  const item = lista.find((x) => x.id === id) as unknown as Record<string, unknown> | undefined;
  if (!item) return fallar("El registro no existe.");
  if (cat === "usuarios" && id === ctx.userId) return fallar("No puedes eliminar tu propio usuario.");
  const ref = referencias(data, cat, id);
  if (ref) return fallar(`No se puede eliminar: ${ref}. Desactívalo para conservar el historial.`);
  const d1 = { ...data, [cat]: lista.filter((x) => x.id !== id) } as AppData;
  return { ok: true, data: registrar(d1, ctx, cat, id, "Eliminación", `${CAT[cat].etiqueta} «${String(item.nombre ?? item.codigo)}» eliminado.`) };
}

/* ================================================================== */
/* Configuración                                                        */
/* ================================================================== */

export function actualizarConfig(data: AppData, ctx: Ctx, patch: Partial<Omit<Config, "umbrales">> & { umbrales?: Partial<Config["umbrales"]> }): Resultado {
  if (!permiso(data, ctx, "config.editar")) return fallar("Solo el administrador puede cambiar la configuración.");
  const c = data.config;
  const nueva: Config = {
    ...c,
    ...patch,
    empresa: { ...c.empresa, ...(patch.empresa ?? {}) },
    umbrales: { ...c.umbrales, ...(patch.umbrales ?? {}) },
    metodosPago: patch.metodosPago ?? c.metodosPago,
  };
  if (!esNumero(nueva.ivaPct) || nueva.ivaPct < 0 || nueva.ivaPct > 100) return fallar("El IVA debe estar entre 0 % y 100 %.", "ivaPct");
  if (!esNumero(nueva.descuentoMaxVendedorPct) || nueva.descuentoMaxVendedorPct < 0 || nueva.descuentoMaxVendedorPct > 100) return fallar("El descuento máximo debe estar entre 0 % y 100 %.", "descuentoMaxVendedorPct");
  if (!esNumero(nueva.variacionPrecioVendedorPct) || nueva.variacionPrecioVendedorPct < 0 || nueva.variacionPrecioVendedorPct > 100) return fallar("La variación de precio debe estar entre 0 % y 100 %.", "variacionPrecioVendedorPct");
  if (!esNumero(nueva.diasVencimientoCredito) || nueva.diasVencimientoCredito < 0 || nueva.diasVencimientoCredito > 365) return fallar("El plazo de crédito debe estar entre 0 y 365 días.", "diasVencimientoCredito");
  for (const [k, v] of Object.entries(nueva.umbrales)) {
    if (!esNumero(v) || v <= 0) return fallar("Todos los umbrales deben ser mayores que 0.", k);
  }
  if (!nueva.empresa.nombre.trim()) return fallar("El nombre de la empresa es obligatorio.", "empresa.nombre");
  if (!nueva.metodosPago.some((m) => m.activo)) return fallar("Debe haber al menos un método de pago activo.", "metodosPago");
  return { ok: true, data: registrar({ ...data, config: nueva }, ctx, "configuracion", "config", "Edición", "Configuración actualizada.") };
}

