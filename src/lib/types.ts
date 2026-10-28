/**
 * Modelo de datos de la demo. Todas las relaciones usan identificadores estables
 * (nunca nombres escritos a mano). Pensado para migrar 1:1 a tablas de una base
 * de datos real en una fase posterior.
 */

export type Rol = "admin" | "vendedor" | "conductor";

/** Fecha local en formato YYYY-MM-DD. */
export type ISODate = string;
/** Fecha y hora local en formato YYYY-MM-DDTHH:mm. */
export type ISODateTime = string;

export interface Usuario {
  id: string;
  nombre: string;
  /** Etiqueta de los tres usuarios principales de la demo. */
  demoLabel?: string;
  rol: Rol;
  email: string;
  telefono?: string;
  activo: boolean;
}

export interface Cliente {
  id: string;
  nombre: string;
  rut?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  contacto?: string;
  observaciones?: string;
  activo: boolean;
}

export interface Faena {
  id: string;
  nombre: string;
  clienteId?: string;
  referencia: string;
  contacto?: string;
  observaciones?: string;
  activo: boolean;
}

export type TipoVehiculo = "camion" | "maquinaria" | "otro";
export type Medidor = "km" | "horas";
export type EstadoVehiculo =
  | "disponible"
  | "en_operacion"
  | "en_mantenimiento"
  | "fuera_de_servicio";

export interface Vehiculo {
  id: string;
  /** Identificador interno visible (CAM-01, MAQ-01…). */
  codigo: string;
  tipo: TipoVehiculo;
  patente?: string;
  marca?: string;
  modelo?: string;
  capacidadM3?: number;
  conductorHabitualId?: string;
  /** Un camión se mide en kilómetros; la maquinaria en horas (horómetro). */
  medidor: Medidor;
  lecturaActual: number;
  estado: EstadoVehiculo;
  proximaRevision?: ISODate;
  observaciones?: string;
}

export interface Material {
  id: string;
  nombre: string;
  unidad: string;
  /** Precio de referencia NETO (sin IVA) por m³. Dato ficticio de demostración. */
  precioReferencia: number;
  activo: boolean;
  descripcion?: string;
}

export type EstadoVentaGuardado = "borrador" | "confirmada" | "anulada";
/** Estado comercial derivado del progreso real de las entregas. */
export type EstadoComercial =
  | "borrador"
  | "confirmada"
  | "en_despacho"
  | "parcial"
  | "entregada"
  | "anulada";
export type EstadoPago = "pendiente" | "parcial" | "pagada" | "vencida";

export interface Venta {
  id: string;
  numero: string;
  fecha: ISODate;
  vendedorId: string;
  clienteId: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  faenaId?: string;
  referenciaFaena?: string;
  materialId: string;
  cantidadM3: number;
  /** Precio neto por m³ efectivamente pactado (snapshot: no cambia si cambia el catálogo). */
  precioUnitario: number;
  /** Precio de referencia vigente al momento de la venta (snapshot). */
  precioReferencia: number;
  descuentoPct: number;
  /** IVA aplicado en esa venta (snapshot). */
  ivaPct: number;
  metodoPago: string;
  fechaEntregaPrevista: ISODate;
  fechaVencimiento?: ISODate;
  observaciones?: string;
  estado: EstadoVentaGuardado;
  motivoAnulacion?: string;
  creadoPor: string;
  creadoEn: ISODateTime;
  modificadoPor: string;
  modificadoEn: ISODateTime;
}

export interface Pago {
  id: string;
  ventaId: string;
  fecha: ISODate;
  monto: number;
  metodo: string;
  nota?: string;
  anulado?: boolean;
  motivoAnulacion?: string;
  creadoPor: string;
  creadoEn: ISODateTime;
}

export type TipoDespacho = "transporte" | "trabajo_maquinaria";
export type EstadoDespacho =
  | "programado"
  | "en_curso"
  | "finalizado"
  | "incidencia"
  | "anulado";

export interface Despacho {
  id: string;
  numero: string;
  tipo: TipoDespacho;
  ventaId?: string;
  /** Obligatorio cuando no hay venta asociada. */
  motivoIndependiente?: string;
  clienteId?: string;
  faenaId?: string;
  referenciaDestino?: string;
  fecha: ISODate;
  materialId?: string;
  vehiculoId: string;
  conductorId: string;
  volumenSolicitadoM3: number;
  viajesPlanificados: number;
  estado: EstadoDespacho;
  horaInicio?: ISODateTime;
  horaFin?: ISODateTime;
  /** Kilómetros (camión) u horas del horómetro (maquinaria), según el vehículo. */
  lecturaInicial?: number;
  lecturaFinal?: number;
  /** Combustible CONSUMIDO observado en la operación (distinto del cargado). */
  combustibleConsumidoL?: number;
  observaciones?: string;
  incidencia?: string;
  conformidad?: { nombre: string; fecha: ISODateTime };
  registroDiarioId?: string;
  motivoAnulacion?: string;
  creadoPor: string;
  creadoEn: ISODateTime;
  modificadoPor: string;
  modificadoEn: ISODateTime;
}

export type EstadoViaje = "valido" | "anulado";

export interface Viaje {
  id: string;
  despachoId: string;
  secuencia: number;
  fechaHora: ISODateTime;
  vehiculoId: string;
  conductorId: string;
  materialId?: string;
  destino: string;
  cantidadM3: number;
  estado: EstadoViaje;
  observaciones?: string;
  /** Marca cuando el viaje supera el saldo de la venta con autorización explícita. */
  autorizadoExceso?: boolean;
  motivoAnulacion?: string;
}

export type EstadoRegistro = "pendiente" | "validado" | "devuelto";

export interface Validacion {
  id: string;
  fecha: ISODateTime;
  userId: string;
  accion: "aprobado" | "devuelto" | "reabierto" | "corregido";
  comentario?: string;
}

/** Registro operacional diario por conductor + vehículo + fecha. Sus totales se calculan desde los despachos vinculados. */
export interface RegistroDiario {
  id: string;
  numero: string;
  fecha: ISODate;
  conductorId: string;
  vehiculoId: string;
  estado: EstadoRegistro;
  observaciones?: string;
  validaciones: Validacion[];
  creadoEn: ISODateTime;
  modificadoEn: ISODateTime;
}

export interface CargaCombustible {
  id: string;
  fecha: ISODate;
  vehiculoId: string;
  conductorId?: string;
  litros: number;
  precioPorLitro?: number;
  estacion?: string;
  despachoId?: string;
  creadoPor: string;
}

export type TipoInsumo =
  | "aceite_motor"
  | "aceite_transmision"
  | "aceite_hidraulico"
  | "grasa"
  | "filtros"
  | "otros";

export interface InsumoMantenimiento {
  id: string;
  fecha: ISODate;
  vehiculoId: string;
  registroDiarioId?: string;
  tipo: TipoInsumo;
  cantidad: number;
  unidad: "L" | "kg" | "un";
  costo?: number;
  nota?: string;
  creadoPor: string;
}

export interface Cambio {
  id: string;
  fecha: ISODateTime;
  userId: string;
  entidad: string;
  entidadId: string;
  accion: string;
  detalle: string;
}

export interface MetodoPagoConfig {
  id: string;
  label: string;
  activo: boolean;
}

export interface Config {
  empresa: {
    nombre: string;
    giro: string;
    rut: string;
    direccion: string;
    telefono: string;
    correo: string;
  };
  ivaPct: number;
  metodosPago: MetodoPagoConfig[];
  descuentoMaxVendedorPct: number;
  variacionPrecioVendedorPct: number;
  /** Plazo (días) para ventas a crédito / transferencia diferida. */
  diasVencimientoCredito: number;
  /** Parámetros de demostración configurables (no son recomendaciones oficiales). */
  umbrales: {
    consumoMaxCamionL100km: number;
    consumoMaxMaquinaLh: number;
    maxKmPorRegistro: number;
    maxHorasPorRegistro: number;
    diasAvisoRevision: number;
  };
}

export interface AppData {
  version: number;
  usuarios: Usuario[];
  clientes: Cliente[];
  faenas: Faena[];
  vehiculos: Vehiculo[];
  materiales: Material[];
  ventas: Venta[];
  pagos: Pago[];
  despachos: Despacho[];
  viajes: Viaje[];
  registros: RegistroDiario[];
  cargas: CargaCombustible[];
  insumos: InsumoMantenimiento[];
  cambios: Cambio[];
  config: Config;
  /** Contadores para identificadores y numeración correlativa. */
  seq: Record<string, number>;
}

export const DATA_VERSION = 1;

/** Contexto de ejecución de una acción (quién y cuándo). */
export interface Ctx {
  userId: string;
  hoy: ISODate;
  ahora: ISODateTime;
}

/**
 * `codigo` permite a la interfaz ofrecer una confirmación explícita:
 * - "exceso": supera el volumen pendiente (requiere autorización del administrador)
 * - "vehiculo": vehículo fuera de servicio / en mantenimiento (excepción del administrador)
 * - "incompleto": el registro tiene datos incompletos (validar de todas formas)
 */
export type CodigoError = "exceso" | "vehiculo" | "incompleto";

export type Resultado<T extends object = object> =
  | ({ ok: true; data: AppData } & T)
  | { ok: false; error: string; campo?: string; codigo?: CodigoError };

export const ETIQUETAS = {
  rol: { admin: "Administrador", vendedor: "Vendedor", conductor: "Conductor" } as Record<Rol, string>,
  tipoVehiculo: { camion: "Camión", maquinaria: "Maquinaria", otro: "Otro equipo" } as Record<TipoVehiculo, string>,
  estadoVehiculo: {
    disponible: "Disponible",
    en_operacion: "En operación",
    en_mantenimiento: "En mantenimiento",
    fuera_de_servicio: "Fuera de servicio",
  } as Record<EstadoVehiculo, string>,
  estadoComercial: {
    borrador: "Borrador",
    confirmada: "Confirmada",
    en_despacho: "En despacho",
    parcial: "Parcialmente entregada",
    entregada: "Entregada",
    anulada: "Anulada",
  } as Record<EstadoComercial, string>,
  estadoPago: {
    pendiente: "Pendiente de pago",
    parcial: "Pago parcial",
    pagada: "Pagada",
    vencida: "Vencida",
  } as Record<EstadoPago, string>,
  estadoDespacho: {
    programado: "Programado",
    en_curso: "En curso",
    finalizado: "Finalizado",
    incidencia: "Con incidencia",
    anulado: "Anulado",
  } as Record<EstadoDespacho, string>,
  estadoRegistro: {
    pendiente: "Pendiente de validar",
    validado: "Validado",
    devuelto: "Devuelto para corrección",
  } as Record<EstadoRegistro, string>,
  tipoInsumo: {
    aceite_motor: "Aceite de motor",
    aceite_transmision: "Aceite de transmisión",
    aceite_hidraulico: "Aceite hidráulico",
    grasa: "Grasa",
    filtros: "Filtros",
    otros: "Otros insumos",
  } as Record<TipoInsumo, string>,
};
