/**
 * Datos de demostración DETERMINISTAS.
 *
 * - Misma semilla → mismos datos (no hay aleatoriedad por render).
 * - Las fechas son relativas a "hoy" en el momento de crear/restaurar los datos,
 *   así los filtros "Hoy / Últimos 7 días / Mes actual" siempre tienen información.
 * - Todo es ficticio: nombres, RUT, teléfonos, patentes y precios (ver docs).
 */
import type {
  AppData,
  CargaCombustible,
  Cambio,
  Cliente,
  Config,
  Despacho,
  Faena,
  ISODate,
  InsumoMantenimiento,
  Material,
  Pago,
  RegistroDiario,
  TipoInsumo,
  Usuario,
  Vehiculo,
  Venta,
  Viaje,
} from "./types";
import { DATA_VERSION } from "./types";
import { addDays, anteriorHabil, conHora, diffDays, siguienteHabil } from "./fecha";

/* ------------------------------------------------------------------ */
/* PRNG determinista                                                    */
/* ------------------------------------------------------------------ */

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number, w = 4) => String(n).padStart(w, "0");
const r100 = (n: number) => Math.round(n / 100) * 100;
const r1000 = (n: number) => Math.round(n / 1000) * 1000;

export const CONFIG_INICIAL: Config = {
  empresa: {
    nombre: "Movimiento de Tierra CR SPA",
    giro: "Movimiento de tierra, arriendo de maquinarias y transporte de materiales",
    rut: "00.000.000-0 (dato de demostración)",
    direccion: "Dirección de demostración, Ñuble, Chile",
    telefono: "+56 9 5555 0000",
    correo: "contacto@ejemplo.cl",
  },
  ivaPct: 19,
  metodosPago: [
    { id: "efectivo", label: "Efectivo", activo: true },
    { id: "transferencia", label: "Transferencia", activo: true },
    { id: "debito", label: "Débito", activo: true },
    { id: "credito", label: "Crédito", activo: true },
    { id: "otro", label: "Otro", activo: true },
  ],
  descuentoMaxVendedorPct: 5,
  variacionPrecioVendedorPct: 10,
  diasVencimientoCredito: 30,
  umbrales: {
    consumoMaxCamionL100km: 55,
    consumoMaxMaquinaLh: 16,
    maxKmPorRegistro: 450,
    maxHorasPorRegistro: 14,
    diasAvisoRevision: 15,
  },
};

/* ------------------------------------------------------------------ */
/* Catálogos                                                            */
/* ------------------------------------------------------------------ */

const USUARIOS: Usuario[] = [
  { id: "u-admin", nombre: "Carolina Muñoz", demoLabel: "Administrador Demo", rol: "admin", email: "admin@ejemplo.cl", telefono: "+56 9 5555 0101", activo: true },
  { id: "u-vend-1", nombre: "Camila Fuentes", demoLabel: "Vendedor Demo", rol: "vendedor", email: "ventas1@ejemplo.cl", telefono: "+56 9 5555 0102", activo: true },
  { id: "u-vend-2", nombre: "Rodrigo Pizarro", rol: "vendedor", email: "ventas2@ejemplo.cl", telefono: "+56 9 5555 0103", activo: true },
  { id: "u-cond-1", nombre: "Héctor Valdés", demoLabel: "Conductor Demo", rol: "conductor", email: "conductor1@ejemplo.cl", telefono: "+56 9 5555 0111", activo: true },
  { id: "u-cond-2", nombre: "Jaime Contreras", rol: "conductor", email: "conductor2@ejemplo.cl", telefono: "+56 9 5555 0112", activo: true },
  { id: "u-cond-3", nombre: "Óscar Mella", rol: "conductor", email: "conductor3@ejemplo.cl", telefono: "+56 9 5555 0113", activo: true },
  { id: "u-cond-4", nombre: "Pablo Navarro", rol: "conductor", email: "conductor4@ejemplo.cl", telefono: "+56 9 5555 0114", activo: true },
  { id: "u-cond-5", nombre: "Sergio Lagos", rol: "conductor", email: "operador5@ejemplo.cl", telefono: "+56 9 5555 0115", activo: true },
];

const CLIENTES: Cliente[] = [
  { id: "c-1", nombre: "Constructora Los Aromos SpA", rut: "76.000.001-0", telefono: "+56 9 5555 0201", email: "obras@losaromos.ejemplo.cl", direccion: "Av. Ejemplo 120, Ñuble", contacto: "Marcela Torres", observaciones: "Cliente frecuente. Pago por transferencia a 15 días.", activo: true },
  { id: "c-2", nombre: "Inmobiliaria Río Claro Ltda.", rut: "76.000.002-0", telefono: "+56 9 5555 0202", email: "proyectos@rioclaro.ejemplo.cl", direccion: "Calle Los Alerces 45, Ñuble", contacto: "Felipe Araya", activo: true },
  { id: "c-3", nombre: "Servicios Viales Ñuble Ltda.", rut: "76.000.003-0", telefono: "+56 9 5555 0203", email: "contratos@viales.ejemplo.cl", direccion: "Ruta de ejemplo km 8, Ñuble", contacto: "Ignacio Pérez", observaciones: "Trabaja con órdenes de compra.", activo: true },
  { id: "c-4", nombre: "Agrícola Las Camelias SpA", rut: "76.000.004-0", telefono: "+56 9 5555 0204", email: "administracion@camelias.ejemplo.cl", direccion: "Fundo Las Camelias, Ñuble", contacto: "Daniela Rivas", activo: true },
  { id: "c-5", nombre: "Ingeniería y Obras Cordillera Ltda.", rut: "76.000.005-0", telefono: "+56 9 5555 0205", email: "compras@cordillera.ejemplo.cl", direccion: "Camino Interior 900, Ñuble", contacto: "Tomás Vergara", activo: true },
  { id: "c-6", nombre: "Pavimentos del Sur Ltda.", rut: "76.000.006-0", telefono: "+56 9 5555 0206", email: "obras@pavsur.ejemplo.cl", direccion: "Parque industrial de ejemplo, Ñuble", contacto: "Andrea Salazar", activo: true },
  { id: "c-7", nombre: "Cliente particular (demo)", telefono: "+56 9 5555 0207", direccion: "Sector rural, Ñuble", contacto: "Sin contacto registrado", observaciones: "Compra ocasional de áridos para predio.", activo: true },
  { id: "c-8", nombre: "Constructora Antigua (inactivo)", rut: "76.000.008-0", telefono: "+56 9 5555 0208", contacto: "—", observaciones: "Cliente inactivo de demostración.", activo: false },
];

/** distKm = kilómetros por viaje (ida y vuelta) usados solo para generar datos de ejemplo. */
const FAENAS: (Faena & { distKm: number })[] = [
  { id: "f-1", nombre: "Condominio Los Aromos – Etapa 2", clienteId: "c-1", referencia: "Acceso por calle lateral, portón azul", contacto: "Marcela Torres", activo: true, distKm: 14 },
  { id: "f-2", nombre: "Loteo Río Claro – Sector Norte", clienteId: "c-2", referencia: "Camino interior, 2 km desde la ruta principal", activo: true, distKm: 22 },
  { id: "f-3", nombre: "Camino rural Ruta N-31, tramo km 12", clienteId: "c-3", referencia: "Faena de mejoramiento de camino, señalizada", observaciones: "Camino de ripio: avanzar con precaución.", activo: true, distKm: 31 },
  { id: "f-4", nombre: "Planta de hormigón Las Camelias", clienteId: "c-4", referencia: "Patio de acopio, costado oriente", activo: true, distKm: 9 },
  { id: "f-5", nombre: "Pavimentación calle Los Boldos", clienteId: "c-6", referencia: "Zona urbana, horario de entrega 08:00 a 17:00", activo: true, distKm: 18 },
  { id: "f-6", nombre: "Parcelación Cordillera Sur", clienteId: "c-5", referencia: "Portería principal, preguntar por jefe de obra", activo: true, distKm: 40 },
  { id: "f-7", nombre: "Relleno predio El Peumo", clienteId: "c-4", referencia: "Camino de tierra, cruzar el puente de madera", activo: true, distKm: 26 },
  { id: "f-8", nombre: "Escuela rural La Quinta (obras de acceso)", clienteId: "c-6", referencia: "Frente a la sede social", activo: true, distKm: 35 },
];

interface VehSeed extends Vehiculo {
  rate: number; // L/100 km o L/h, solo para generar datos
  base: number;
}

const VEHICULOS: VehSeed[] = [
  { id: "veh-cam-01", codigo: "CAM-01", tipo: "camion", patente: "DEMO-11", marca: "Volvo", modelo: "FMX 440 (tolva)", capacidadM3: 12, conductorHabitualId: "u-cond-1", medidor: "km", lecturaActual: 0, estado: "disponible", proximaRevision: "+40", rate: 36, base: 148200 },
  { id: "veh-cam-02", codigo: "CAM-02", tipo: "camion", patente: "DEMO-12", marca: "Mack", modelo: "Granite (tolva)", capacidadM3: 14, conductorHabitualId: "u-cond-2", medidor: "km", lecturaActual: 0, estado: "disponible", proximaRevision: "+9", rate: 41, base: 212900 },
  { id: "veh-cam-03", codigo: "CAM-03", tipo: "camion", patente: "DEMO-13", marca: "Freightliner", modelo: "M2 106 (tolva)", capacidadM3: 10, conductorHabitualId: "u-cond-3", medidor: "km", lecturaActual: 0, estado: "disponible", proximaRevision: "+75", rate: 33, base: 96450 },
  { id: "veh-cam-04", codigo: "CAM-04", tipo: "camion", patente: "DEMO-14", marca: "Scania", modelo: "P360 (tolva)", capacidadM3: 16, conductorHabitualId: "u-cond-4", medidor: "km", lecturaActual: 0, estado: "en_mantenimiento", proximaRevision: "-12", observaciones: "En taller por consumo sobre lo esperado (dato de demostración).", rate: 56, base: 301300 },
  { id: "veh-maq-01", codigo: "MAQ-01", tipo: "maquinaria", marca: "Caterpillar", modelo: "420 retroexcavadora", conductorHabitualId: "u-cond-5", medidor: "horas", lecturaActual: 0, estado: "disponible", proximaRevision: "+20", rate: 9.5, base: 3820.5 },
  { id: "veh-maq-02", codigo: "MAQ-02", tipo: "maquinaria", marca: "Caterpillar", modelo: "950 cargador frontal", medidor: "horas", lecturaActual: 0, estado: "disponible", proximaRevision: "+5", rate: 14, base: 5104 },
  { id: "veh-otro-01", codigo: "SUP-01", tipo: "otro", patente: "DEMO-15", marca: "Toyota", modelo: "Hilux (supervisión)", medidor: "km", lecturaActual: 54000, estado: "disponible", proximaRevision: "+120", rate: 11, base: 54000 },
];

const MATERIALES: Material[] = [
  { id: "m-arena", nombre: "Arena", unidad: "m³", precioReferencia: 14000, activo: true, descripcion: "Arena de relleno y construcción. Precio de demostración." },
  { id: "m-grava", nombre: "Grava", unidad: "m³", precioReferencia: 17500, activo: true, descripcion: "Grava clasificada. Precio de demostración." },
  { id: "m-estab", nombre: "Estabilizado", unidad: "m³", precioReferencia: 15500, activo: true, descripcion: "Base estabilizada para caminos y plataformas. Precio de demostración." },
  { id: "m-otro", nombre: "Otro material", unidad: "m³", precioReferencia: 12000, activo: true, descripcion: "Material no clasificado. Precio de demostración." },
];

const CONTACTO_CLIENTE: Record<string, string> = Object.fromEntries(CLIENTES.map((c) => [c.id, c.contacto ?? ""]));

/* ------------------------------------------------------------------ */
/* Generador                                                            */
/* ------------------------------------------------------------------ */

interface PlanVenta {
  off: number;
  escenario?: string;
}

type Escenarios = Record<string, string>;

export function generarDatosDemo(hoy: ISODate): AppData {
  const rnd = mulberry32(20261027);
  const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const elegir = <T,>(arr: T[], pesos?: number[]): T => {
    if (!pesos) return arr[Math.floor(rnd() * arr.length)];
    const total = pesos.reduce((s, x) => s + x, 0);
    let x = rnd() * total;
    for (let i = 0; i < arr.length; i++) {
      x -= pesos[i];
      if (x < 0) return arr[i];
    }
    return arr[arr.length - 1];
  };

  const vehiculos: Vehiculo[] = VEHICULOS.map((v) => {
    const { rate: _r, base: _b, proximaRevision, ...resto } = v;
    void _r;
    void _b;
    return {
      ...resto,
      proximaRevision: proximaRevision ? addDays(hoy, Number(proximaRevision)) : undefined,
    };
  });
  const vehInfo = new Map(VEHICULOS.map((v) => [v.id, v]));
  const faenaInfo = new Map(FAENAS.map((f) => [f.id, f]));
  const faenas: Faena[] = FAENAS.map(({ distKm: _d, ...f }) => {
    void _d;
    return f;
  });

  /* ---------------- Plan de ventas ---------------- */
  const planViejo: PlanVenta[] = [];
  const N_OLD = 58;
  for (let i = 0; i < N_OLD; i++) {
    const t = (i + 0.5) / N_OLD;
    const off = 12 + Math.round(138 * (1 - Math.pow(t, 0.85))) + entre(-1, 1);
    planViejo.push({ off: Math.max(12, Math.min(150, off)) });
  }
  const cercano = (objetivo: number, excluir: Set<number>) => {
    let mejor = -1;
    let dist = 1e9;
    planViejo.forEach((p, i) => {
      if (excluir.has(i)) return;
      const d = Math.abs(p.off - objetivo);
      if (d < dist) {
        dist = d;
        mejor = i;
      }
    });
    return mejor;
  };
  const usados = new Set<number>();
  const iA = cercano(22, usados);
  usados.add(iA);
  planViejo[iA].escenario = "parcial_antigua";
  const iB = cercano(17, usados);
  usados.add(iB);
  planViejo[iB].escenario = "sin_despacho_antigua";
  const iC = cercano(36, usados);
  usados.add(iC);
  planViejo[iC].escenario = "anulada";
  const iD = cercano(60, usados);
  usados.add(iD);
  planViejo[iD].escenario = "precio_negociado";

  const planReciente: PlanVenta[] = [
    { off: 10, escenario: "lectura_inconsistente" },
    { off: 9 },
    { off: 8 },
    { off: 7, escenario: "incompleto" },
    { off: 6, escenario: "devuelto" },
    { off: 5 },
    { off: 4 },
    { off: 3, escenario: "pendiente_total" },
    { off: 2, escenario: "incidencia" },
    { off: 2 },
    { off: 1, escenario: "en_curso_hoy" },
    { off: 1, escenario: "finalizado_hoy" },
    { off: 1, escenario: "borrador" },
    { off: 0, escenario: "programado_hoy" },
    { off: 0, escenario: "programado_manana" },
    { off: 0, escenario: "borrador" },
  ];
  const plan = [...planViejo, ...planReciente].sort((a, b) => b.off - a.off);

  /* ---------------- Ventas ---------------- */
  const CANTIDADES = [10, 12, 14, 20, 24, 28, 30, 36, 42, 48, 56, 60];
  const PESOS_C = [3, 4, 3, 6, 6, 5, 4, 6, 3, 3, 1, 1];
  const CANT_RECIENTES = [12, 14, 20, 24, 28, 30, 36];
  const CLIENTES_ACT = ["c-1", "c-2", "c-3", "c-4", "c-5", "c-6", "c-7"];
  const PESOS_CLI = [25, 20, 18, 15, 10, 8, 4];
  const FAENAS_DE: Record<string, string[]> = { "c-1": ["f-1"], "c-2": ["f-2"], "c-3": ["f-3"], "c-4": ["f-4", "f-7"], "c-5": ["f-6"], "c-6": ["f-5", "f-8"], "c-7": [] };
  const MET = ["m-arena", "m-grava", "m-estab", "m-otro"];
  const PESOS_MAT = [32, 28, 30, 10];
  const METODOS = ["transferencia", "efectivo", "credito", "debito", "otro"];
  const PESOS_MET = [45, 20, 15, 10, 10];
  const refMat = new Map(MATERIALES.map((m) => [m.id, m.precioReferencia]));

  const ventas: Venta[] = [];
  const escenarioVenta: Record<string, string> = {};
  plan.forEach((p, i) => {
    const id = `v-${pad(i + 1)}`;
    const esReciente = p.off <= 10 && planReciente.includes(p);
    const fechaBase = addDays(hoy, -p.off);
    const fecha = esReciente ? fechaBase : anteriorHabil(fechaBase);
    const clienteId = p.escenario === "programado_hoy" ? "c-1" : elegir(CLIENTES_ACT, PESOS_CLI);
    const faenasCliente = FAENAS_DE[clienteId];
    const faenaId = faenasCliente.length ? elegir(faenasCliente) : undefined;
    const materialId = elegir(MET, PESOS_MAT);
    let cantidad = esReciente ? elegir(CANT_RECIENTES) : elegir(CANTIDADES, PESOS_C);
    if (p.escenario === "parcial_antigua") cantidad = 36;
    if (p.escenario === "en_curso_hoy") cantidad = 36;
    if (p.escenario === "finalizado_hoy") cantidad = 28;
    if (p.escenario === "incidencia") cantidad = 30;
    if (p.escenario === "programado_hoy") cantidad = 24;
    if (p.escenario === "programado_manana") cantidad = 20;
    const factorPrecio = 1 - 0.06 * (p.off / 150);
    const refSnap = r100((refMat.get(materialId) ?? 0) * factorPrecio);
    const variacion = p.escenario === "precio_negociado" ? -0.05 : elegir([-0.02, 0, 0, 0.03]);
    const precio = r100(refSnap * (1 + variacion));
    let descuento = 0;
    if (cantidad >= 42 && rnd() < 0.5) descuento = 3;
    if (p.escenario === "precio_negociado") descuento = 5;
    const metodo = elegir(METODOS, PESOS_MET);
    const plazo = metodo === "credito" ? 30 : metodo === "transferencia" || metodo === "otro" ? 15 : 0;
    const vendedorId = elegir(["u-vend-1", "u-vend-2"], [55, 45]);
    const estado: Venta["estado"] = p.escenario === "borrador" ? "borrador" : p.escenario === "anulada" ? "anulada" : "confirmada";
    const hora = 8 + (i % 8);
    const creadoEn = conHora(fecha, hora * 60 + ((i * 7) % 50));
    const venta: Venta = {
      id,
      numero: `V-${pad(i + 1)}`,
      fecha,
      vendedorId,
      clienteId,
      contactoNombre: CONTACTO_CLIENTE[clienteId] || undefined,
      contactoTelefono: CLIENTES.find((c) => c.id === clienteId)?.telefono,
      faenaId,
      referenciaFaena: faenaId ? undefined : "Predio particular, camino rural (referencia por teléfono)",
      materialId,
      cantidadM3: cantidad,
      precioUnitario: precio,
      precioReferencia: refSnap,
      descuentoPct: descuento,
      ivaPct: 19,
      metodoPago: metodo,
      fechaEntregaPrevista: p.escenario === "pendiente_total" ? addDays(hoy, -1) : siguienteHabil(addDays(fecha, entre(1, 3))),
      fechaVencimiento: plazo ? addDays(fecha, plazo) : undefined,
      observaciones: p.escenario === "precio_negociado" ? "Precio negociado por volumen recurrente (demo)." : p.escenario === "anulada" ? undefined : undefined,
      estado,
      motivoAnulacion: p.escenario === "anulada" ? "Cliente desistió de la compra antes del despacho." : undefined,
      creadoPor: vendedorId,
      creadoEn,
      modificadoPor: vendedorId,
      modificadoEn: creadoEn,
    };
    if (p.escenario === "pendiente_total") venta.fechaEntregaPrevista = addDays(hoy, -1);
    if (p.escenario === "sin_despacho_antigua") venta.fechaEntregaPrevista = addDays(fecha, 3);
    ventas.push(venta);
    if (p.escenario) escenarioVenta[id] = p.escenario;
  });
  // La venta "en curso hoy" y la "finalizada hoy" deben tener vendedor demo para la demostración
  ventas.forEach((v) => {
    const e = escenarioVenta[v.id];
    if (e === "programado_hoy" || e === "en_curso_hoy" || e === "programado_manana") {
      v.vendedorId = "u-vend-1";
      v.creadoPor = "u-vend-1";
      v.modificadoPor = "u-vend-1";
    }
  });

  /* ---------------- Despachos y viajes ---------------- */
  const despachos: Despacho[] = [];
  const viajes: Viaje[] = [];
  const escenarioDespacho: Escenarios = {};
  const ocupado = new Set<string>();
  let nDesp = 0;
  let nViaje = 0;
  let rot = 0;

  const camionesElegibles = (off: number) =>
    off >= 21 ? ["veh-cam-01", "veh-cam-02", "veh-cam-03", "veh-cam-04"] : off >= 4 ? ["veh-cam-01", "veh-cam-02", "veh-cam-03"] : ["veh-cam-01", "veh-cam-02"];

  function crearDespacho(opts: {
    venta?: Venta;
    fecha: ISODate;
    vehiculoId: string;
    volumen: number;
    estado: Despacho["estado"];
    viajesHechos?: number;
    escenario?: string;
    creadoPor?: string;
    tipo?: Despacho["tipo"];
    clienteId?: string;
    faenaId?: string;
    motivo?: string;
  }): Despacho {
    const veh = vehInfo.get(opts.vehiculoId)!;
    nDesp++;
    const id = `d-${pad(nDesp)}`;
    const cap = veh.capacidadM3 ?? 0;
    const tipo = opts.tipo ?? "transporte";
    const planificados = tipo === "transporte" && cap > 0 ? Math.ceil(opts.volumen / cap - 1e-9) : 0;
    const faenaId = opts.faenaId ?? opts.venta?.faenaId;
    const dist = faenaId ? faenaInfo.get(faenaId)!.distKm : 20;
    const destino = faenaId ? faenaInfo.get(faenaId)!.nombre : opts.venta?.referenciaFaena ?? "Destino de demostración";
    const creadoEn = conHora(addDays(opts.fecha, -1), 16 * 60 + 10);
    const hechos = opts.viajesHechos ?? (opts.estado === "finalizado" || opts.estado === "incidencia" ? planificados : 0);
    const d: Despacho = {
      id,
      numero: "",
      tipo,
      ventaId: opts.venta?.id,
      motivoIndependiente: opts.venta ? undefined : opts.motivo,
      clienteId: opts.clienteId ?? opts.venta?.clienteId,
      faenaId,
      referenciaDestino: faenaId ? undefined : opts.venta?.referenciaFaena,
      fecha: opts.fecha,
      materialId: opts.venta?.materialId,
      vehiculoId: opts.vehiculoId,
      conductorId: veh.conductorHabitualId ?? "u-cond-5",
      volumenSolicitadoM3: opts.volumen,
      viajesPlanificados: planificados,
      estado: opts.estado,
      creadoPor: opts.creadoPor ?? (opts.venta?.vendedorId ?? "u-admin"),
      creadoEn,
      modificadoPor: veh.conductorHabitualId ?? "u-cond-5",
      modificadoEn: creadoEn,
    };
    despachos.push(d);
    if (opts.escenario) escenarioDespacho[id] = opts.escenario;

    // Viajes
    if (tipo === "transporte" && hechos > 0) {
      const ini = 7 * 60 + 20 + entre(0, 40);
      const intervalo = Math.round(45 + dist * 2.4);
      let restante = opts.volumen;
      for (let k = 0; k < hechos; k++) {
        const cantidad = k < planificados - 1 ? cap : Math.round((opts.volumen - cap * (planificados - 1)) * 10) / 10;
        const real = Math.min(cantidad, restante);
        restante -= real;
        nViaje++;
        viajes.push({
          id: `via-${pad(nViaje, 5)}`,
          despachoId: id,
          secuencia: k + 1,
          fechaHora: conHora(opts.fecha, ini + k * intervalo),
          vehiculoId: opts.vehiculoId,
          conductorId: d.conductorId,
          materialId: opts.venta?.materialId,
          destino,
          cantidadM3: real,
          estado: "valido",
        });
      }
      d.horaInicio = conHora(opts.fecha, ini - 20);
      if (opts.estado === "finalizado" || opts.estado === "incidencia") {
        d.horaFin = conHora(opts.fecha, ini + (hechos - 1) * intervalo + 35);
      }
    }
    return d;
  }

  function elegirCamion(off: number, fecha: ISODate): { vehiculoId: string; fecha: ISODate } {
    const lista = camionesElegibles(off);
    let f = fecha;
    for (let intento = 0; intento < 8; intento++) {
      for (let k = 0; k < lista.length; k++) {
        const veh = lista[(rot + k) % lista.length];
        if (!ocupado.has(`${veh}|${f}`)) {
          rot++;
          ocupado.add(`${veh}|${f}`);
          return { vehiculoId: veh, fecha: f };
        }
      }
      f = f >= hoy ? hoy : siguienteHabil(addDays(f, 1));
      if (f >= hoy) {
        f = hoy;
        rot++;
        return { vehiculoId: lista[rot % lista.length], fecha: f };
      }
    }
    return { vehiculoId: lista[0], fecha: f };
  }

  const fechaDespachoNormal = (v: Venta) => {
    const f = siguienteHabil(addDays(v.fecha, entre(0, 2)));
    return f > hoy ? hoy : f;
  };

  for (const v of ventas) {
    if (v.estado !== "confirmada") continue;
    const e = escenarioVenta[v.id];
    const off = diffDays(v.fecha, hoy);
    if (e === "sin_despacho_antigua" || e === "pendiente_total") continue;

    if (e === "parcial_antigua") {
      const f = fechaDespachoNormal(v);
      ocupado.add(`veh-cam-01|${f}`);
      crearDespacho({ venta: v, fecha: f, vehiculoId: "veh-cam-01", volumen: 36, estado: "finalizado", viajesHechos: 2, escenario: "parcial_antigua" });
      continue;
    }
    if (e === "en_curso_hoy") {
      crearDespacho({ venta: v, fecha: hoy, vehiculoId: "veh-cam-01", volumen: 36, estado: "en_curso", viajesHechos: 1, escenario: "en_curso_hoy", creadoPor: "u-vend-1" });
      continue;
    }
    if (e === "finalizado_hoy") {
      crearDespacho({ venta: v, fecha: hoy, vehiculoId: "veh-cam-02", volumen: 28, estado: "finalizado", escenario: "finalizado_hoy" });
      continue;
    }
    if (e === "incidencia") {
      crearDespacho({ venta: v, fecha: addDays(hoy, -1), vehiculoId: "veh-cam-03", volumen: 30, estado: "incidencia", viajesHechos: 1, escenario: "incidencia" });
      continue;
    }
    if (e === "programado_hoy") {
      crearDespacho({ venta: v, fecha: hoy, vehiculoId: "veh-cam-01", volumen: 24, estado: "programado", escenario: "programado_hoy", creadoPor: "u-vend-1" });
      continue;
    }
    if (e === "programado_manana") {
      crearDespacho({ venta: v, fecha: addDays(hoy, 1), vehiculoId: "veh-cam-01", volumen: 20, estado: "programado", escenario: "programado_manana", creadoPor: "u-vend-1" });
      continue;
    }

    // Venta normal: se entrega completa en uno o dos despachos
    const f1 = fechaDespachoNormal(v);
    const sel = elegirCamion(off, f1);
    const cap = vehInfo.get(sel.vehiculoId)!.capacidadM3!;
    const n = Math.ceil(v.cantidadM3 / cap - 1e-9);
    const esc = e === "lectura_inconsistente" || e === "incompleto" || e === "devuelto" ? e : undefined;
    if (n > 5) {
      const primero = Math.ceil(n / 2) * cap;
      const segundo = Math.round((v.cantidadM3 - primero) * 10) / 10;
      crearDespacho({ venta: v, fecha: sel.fecha, vehiculoId: sel.vehiculoId, volumen: primero, estado: "finalizado" });
      let f2 = siguienteHabil(addDays(sel.fecha, 1));
      if (f2 > hoy) f2 = hoy;
      const sel2 = elegirCamion(off, f2);
      crearDespacho({ venta: v, fecha: sel2.fecha, vehiculoId: sel2.vehiculoId, volumen: segundo, estado: "finalizado" });
    } else {
      crearDespacho({ venta: v, fecha: sel.fecha, vehiculoId: sel.vehiculoId, volumen: v.cantidadM3, estado: "finalizado", escenario: esc });
    }
  }

  // Trabajos de maquinaria (operaciones independientes, por horas)
  const trabajosMaq: { off: number; veh: string; faena: string }[] = [
    { off: 118, veh: "veh-maq-01", faena: "f-4" },
    { off: 96, veh: "veh-maq-01", faena: "f-7" },
    { off: 83, veh: "veh-maq-02", faena: "f-4" },
    { off: 61, veh: "veh-maq-01", faena: "f-3" },
    { off: 47, veh: "veh-maq-01", faena: "f-6" },
    { off: 33, veh: "veh-maq-02", faena: "f-3" },
    { off: 24, veh: "veh-maq-01", faena: "f-2" },
    { off: 15, veh: "veh-maq-01", faena: "f-5" },
    { off: 6, veh: "veh-maq-02", faena: "f-8" },
  ];
  for (const t of trabajosMaq) {
    const f = anteriorHabil(addDays(hoy, -t.off));
    crearDespacho({
      fecha: f,
      vehiculoId: t.veh,
      volumen: 0,
      estado: "finalizado",
      tipo: "trabajo_maquinaria",
      clienteId: FAENAS.find((x) => x.id === t.faena)!.clienteId,
      faenaId: t.faena,
      motivo: "Arriendo de maquinaria por jornada (operación sin venta de material)",
      creadoPor: "u-admin",
    });
  }
  crearDespacho({
    fecha: addDays(hoy, 1),
    vehiculoId: "veh-maq-01",
    volumen: 0,
    estado: "programado",
    tipo: "trabajo_maquinaria",
    clienteId: "c-2",
    faenaId: "f-2",
    motivo: "Arriendo de maquinaria por jornada (operación sin venta de material)",
    creadoPor: "u-admin",
  });

  // Numeración correlativa por fecha
  const ordenDesp = [...despachos].sort((a, b) => (a.fecha === b.fecha ? a.id.localeCompare(b.id) : a.fecha.localeCompare(b.fecha)));
  ordenDesp.forEach((d, i) => {
    d.numero = `D-${pad(i + 1)}`;
  });

  /* ---------------- Lecturas, combustible, registros ---------------- */
  const lectura = new Map<string, number>(VEHICULOS.map((v) => [v.id, v.base]));
  const viajesPorD = new Map<string, Viaje[]>();
  for (const v of viajes) {
    viajesPorD.set(v.despachoId, [...(viajesPorD.get(v.despachoId) ?? []), v]);
  }
  for (const d of ordenDesp) {
    if (d.estado === "programado") continue;
    const info = vehInfo.get(d.vehiculoId)!;
    const esc = escenarioDespacho[d.id];
    const inicio = lectura.get(d.vehiculoId)!;
    d.lecturaInicial = info.medidor === "km" ? Math.round(inicio) : Math.round(inicio * 10) / 10;
    if (d.estado === "en_curso") continue; // sigue trabajando: sin lectura final ni consumo todavía
    let trabajo: number;
    if (info.medidor === "km") {
      const nV = (viajesPorD.get(d.id) ?? []).length;
      const dist = d.faenaId ? faenaInfo.get(d.faenaId)!.distKm : 20;
      trabajo = Math.round(nV * dist + 8 + entre(0, 10));
    } else {
      trabajo = (entre(55, 90) / 10);
    }
    const fin = inicio + trabajo;
    d.lecturaFinal = info.medidor === "km" ? Math.round(fin) : Math.round(fin * 10) / 10;
    lectura.set(d.vehiculoId, fin);
    const factor = 0.93 + rnd() * 0.14;
    d.combustibleConsumidoL = Math.round(info.medidor === "km" ? ((trabajo * info.rate) / 100) * factor : trabajo * info.rate * factor);
    if (esc === "lectura_inconsistente") {
      // Error de tipeo: el conductor anotó una lectura final menor que la inicial
      d.lecturaFinal = (d.lecturaInicial ?? 0) - 290;
    }
    if (esc === "incompleto") {
      d.combustibleConsumidoL = undefined;
    }
  }

  // Conformidad del conductor para despachos cerrados
  const nombreUsuario = new Map(USUARIOS.map((u) => [u.id, u.nombre]));
  for (const d of ordenDesp) {
    if (d.estado === "finalizado" && d.horaFin) {
      d.conformidad = { nombre: nombreUsuario.get(d.conductorId) ?? "Conductor", fecha: d.horaFin };
    }
    if (d.estado === "finalizado") {
      d.modificadoEn = d.horaFin ?? d.modificadoEn;
    }
  }
  const incid = despachos.find((d) => d.estado === "incidencia");
  if (incid) {
    incid.incidencia = "Neumático dañado en ruta. Camión detenido a la espera de repuesto; se reprograma el saldo.";
    incid.observaciones = "Se alcanzó a entregar 1 viaje antes de la falla.";
  }
  const incompleto = despachos.find((d) => escenarioDespacho[d.id] === "incompleto");
  if (incompleto) incompleto.observaciones = "El conductor no anotó el combustible consumido.";
  const inconsistente = despachos.find((d) => escenarioDespacho[d.id] === "lectura_inconsistente");
  if (inconsistente) inconsistente.observaciones = "Revisar lectura final del camión (posible error de digitación).";
  const parcial = despachos.find((d) => escenarioDespacho[d.id] === "parcial_antigua");
  if (parcial) parcial.observaciones = "Se detuvo la entrega por lluvia; el cliente pidió retomar más adelante.";

  // Registros diarios
  const registros: RegistroDiario[] = [];
  const grupos = new Map<string, Despacho[]>();
  for (const d of ordenDesp) {
    if (d.estado !== "finalizado" && d.estado !== "incidencia") continue;
    const k = `${d.fecha}|${d.vehiculoId}|${d.conductorId}`;
    grupos.set(k, [...(grupos.get(k) ?? []), d]);
  }
  let nReg = 0;
  const cambios: Cambio[] = [];
  let nCamb = 0;
  const cambio = (fecha: string, userId: string, entidad: string, entidadId: string, accion: string, detalle: string) => {
    nCamb++;
    cambios.push({ id: `cb-${pad(nCamb)}`, fecha, userId, entidad, entidadId, accion, detalle });
  };
  cambio(conHora(addDays(hoy, -150), 9 * 60), "u-admin", "sistema", "demo", "Carga inicial", "Datos de demostración cargados (ficticios).");
  for (const [k, ds] of grupos) {
    nReg++;
    const [fechaReg, vehiculoId, conductorId] = k.split("|");
    const escs = ds.map((d) => escenarioDespacho[d.id]);
    const antiguo = diffDays(fechaReg, hoy) >= 4;
    let estado: RegistroDiario["estado"] = antiguo ? "validado" : "pendiente";
    if (escs.includes("lectura_inconsistente") || escs.includes("incompleto") || escs.includes("incidencia")) estado = "pendiente";
    if (escs.includes("devuelto")) estado = "devuelto";
    const id = `r-${pad(nReg)}`;
    const creado = conHora(fechaReg, 18 * 60);
    const reg: RegistroDiario = {
      id,
      numero: `R-${pad(nReg)}`,
      fecha: fechaReg,
      conductorId,
      vehiculoId,
      estado,
      observaciones: escs.includes("devuelto") ? "Falta confirmar los litros de combustible." : undefined,
      validaciones: [],
      creadoEn: creado,
      modificadoEn: creado,
    };
    if (estado === "validado") {
      const fv = conHora(addDays(fechaReg, 1), 17 * 60 + 30);
      reg.validaciones.push({ id: `val-${pad(nReg)}`, fecha: fv, userId: "u-admin", accion: "aprobado" });
      reg.modificadoEn = fv;
      cambio(fv, "u-admin", "registro", id, "Validación", `Registro ${reg.numero} aprobado.`);
    } else if (estado === "devuelto") {
      const fv = conHora(addDays(fechaReg, 1), 9 * 60 + 15);
      reg.validaciones.push({ id: `val-${pad(nReg)}`, fecha: fv, userId: "u-admin", accion: "devuelto", comentario: "Falta confirmar los litros de combustible." });
      reg.modificadoEn = fv;
      cambio(fv, "u-admin", "registro", id, "Devolución", `Registro ${reg.numero} devuelto al conductor para corrección.`);
    }
    registros.push(reg);
    for (const d of ds) d.registroDiarioId = id;
  }

  // Lectura actual de cada vehículo = última lectura de registros VALIDADOS (nunca retrocede)
  for (const veh of vehiculos) {
    const info = vehInfo.get(veh.id)!;
    let max = info.base;
    for (const d of despachos) {
      if (d.vehiculoId !== veh.id || d.lecturaFinal == null || !d.registroDiarioId) continue;
      const reg = registros.find((r) => r.id === d.registroDiarioId);
      if (reg?.estado === "validado" && d.lecturaFinal > max) max = d.lecturaFinal;
    }
    veh.lecturaActual = info.medidor === "km" ? Math.round(max) : Math.round(max * 10) / 10;
  }
  // Estados de vehículo coherentes con los despachos en curso / incidencia
  const cam01 = vehiculos.find((v) => v.id === "veh-cam-01")!;
  cam01.estado = "en_operacion";
  const cam03 = vehiculos.find((v) => v.id === "veh-cam-03")!;
  cam03.estado = "fuera_de_servicio";
  cam03.observaciones = "Neumático dañado, a la espera de repuesto (dato de demostración).";

  // Cambios de ejemplo para ventas anuladas / precio
  for (const v of ventas) {
    if (v.estado === "anulada") cambio(conHora(addDays(v.fecha, 1), 10 * 60), "u-admin", "venta", v.id, "Anulación", `${v.numero} anulada: ${v.motivoAnulacion}`);
  }

  /* ---------------- Pagos ---------------- */
  const pagos: Pago[] = [];
  let nPago = 0;
  for (const v of ventas) {
    if (v.estado !== "confirmada") continue;
    const off = diffDays(v.fecha, hoy);
    const x = rnd();
    const cat = off >= 45 ? (x < 0.82 ? "pagada" : x < 0.9 ? "parcial" : "ninguno") : off >= 20 ? (x < 0.6 ? "pagada" : x < 0.8 ? "parcial" : "ninguno") : x < 0.35 ? "pagada" : x < 0.5 ? "parcial" : "ninguno";
    const escV = escenarioVenta[v.id];
    const forzarSinPago = escV === "sin_despacho_antigua" || escV === "pendiente_total" || escV === "programado_manana" || escV === "programado_hoy";
    const esquema = forzarSinPago ? "ninguno" : cat;
    const tot = totalesVentaSeed(v);
    const agregar = (fecha: ISODate, monto: number, metodo: string, nota?: string) => {
      if (monto <= 0 || fecha > hoy) return;
      nPago++;
      pagos.push({ id: `p-${pad(nPago)}`, ventaId: v.id, fecha, monto, metodo, nota, creadoPor: v.vendedorId, creadoEn: conHora(fecha, 11 * 60 + 20) });
    };
    if (esquema === "pagada") {
      let f1 = addDays(v.fecha, entre(1, 18));
      if (v.fechaVencimiento && f1 > v.fechaVencimiento) f1 = v.fechaVencimiento;
      if (f1 > hoy) f1 = hoy;
      if (rnd() < 0.4 && tot.total >= 300000) {
        const mitad = r1000(tot.total * 0.5);
        agregar(f1, mitad, v.metodoPago, "Anticipo");
        const f2 = addDays(f1, entre(3, 10));
        agregar(f2 > hoy ? hoy : f2, tot.total - mitad, "transferencia", "Saldo");
      } else {
        agregar(f1, tot.total, v.metodoPago);
      }
    } else if (esquema === "parcial") {
      const frac = elegir([0.3, 0.5, 0.6]);
      let f1 = addDays(v.fecha, entre(1, 12));
      if (f1 > hoy) f1 = hoy;
      agregar(f1, Math.min(tot.total - 1000, r1000(tot.total * frac)), v.metodoPago, "Abono");
    }
  }
  // Todo pago de "pagada" debe cerrar exactamente en el total (evita descuadres por redondeo previo)
  for (const v of ventas) {
    if (v.estado !== "confirmada") continue;
    const ps = pagos.filter((p) => p.ventaId === v.id);
    if (ps.length === 0) continue;
    const suma = ps.reduce((s, p) => s + p.monto, 0);
    const total = totalesVentaSeed(v).total;
    if (suma > total) ps[ps.length - 1].monto -= suma - total;
  }

  /* ---------------- Combustible e insumos ---------------- */
  const cargas: CargaCombustible[] = [];
  let nCarga = 0;
  const estaciones = ["Estación de servicio Ruta (demo)", "Depósito propio (demo)"];
  // Las cargas se derivan del consumo observado de cada vehículo: se abastece cuando lo consumido
  // acumulado alcanza un umbral y se carga algo más de lo consumido (margen de seguridad).
  for (const info of VEHICULOS) {
    const esMaq = info.medidor === "horas";
    const umbral = esMaq ? 70 : info.id === "veh-otro-01" ? 25 : 110;
    const propios = despachos
      .filter((d) => d.vehiculoId === info.id && d.estado !== "anulado" && (d.combustibleConsumidoL ?? 0) > 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    let acumulado = 0;
    const emitir = (fecha: string, base: number) => {
      nCarga++;
      cargas.push({
        id: `cg-${pad(nCarga)}`,
        fecha,
        vehiculoId: info.id,
        conductorId: info.conductorHabitualId,
        litros: Math.max(10, Math.round((base * (1.04 + entre(0, 12) / 100)) / 5) * 5),
        precioPorLitro: Math.round(1040 + (150 - diffDays(fecha, hoy)) * 0.35 + entre(-8, 8)),
        estacion: estaciones[(nCarga + (esMaq ? 1 : 0)) % 2],
        creadoPor: info.conductorHabitualId ?? "u-admin",
      });
      acumulado = 0;
    };
    let ultimaFecha = "";
    for (const d of propios) {
      acumulado += d.combustibleConsumidoL ?? 0;
      ultimaFecha = d.fecha;
      if (acumulado >= umbral) emitir(d.fecha, acumulado);
    }
    if (ultimaFecha && acumulado >= umbral * 0.4) emitir(ultimaFecha, acumulado);
  }
  cargas.sort((a, b) => a.fecha.localeCompare(b.fecha));
  cargas.forEach((c, i) => (c.id = `cg-${pad(i + 1)}`));

  const insumos: InsumoMantenimiento[] = [];
  const tiposInsumo: { tipo: TipoInsumo; cantidad: number; unidad: "L" | "kg" | "un"; costo: number }[] = [
    { tipo: "aceite_motor", cantidad: 20, unidad: "L", costo: 78000 },
    { tipo: "filtros", cantidad: 2, unidad: "un", costo: 64000 },
    { tipo: "grasa", cantidad: 3, unidad: "kg", costo: 18000 },
    { tipo: "aceite_hidraulico", cantidad: 35, unidad: "L", costo: 120000 },
    { tipo: "aceite_transmision", cantidad: 12, unidad: "L", costo: 52000 },
    { tipo: "otros", cantidad: 1, unidad: "un", costo: 25000 },
  ];
  const vehsInsumo = ["veh-cam-01", "veh-cam-02", "veh-maq-01", "veh-cam-03", "veh-maq-02", "veh-cam-04"];
  for (let k = 0; k < 14; k++) {
    const veh = vehsInsumo[k % vehsInsumo.length];
    const esMaq = veh.startsWith("veh-maq");
    const base = tiposInsumo[(k + (esMaq ? 3 : 0)) % tiposInsumo.length];
    const f = anteriorHabil(addDays(hoy, -(126 - k * 9)));
    const reg = registros.find((r) => r.vehiculoId === veh && r.fecha === f);
    insumos.push({
      id: `ins-${pad(k + 1)}`,
      fecha: f,
      vehiculoId: veh,
      registroDiarioId: reg?.id,
      tipo: base.tipo,
      cantidad: base.cantidad,
      unidad: base.unidad,
      costo: base.costo + entre(-4, 4) * 1000,
      nota: k % 4 === 0 ? "Mantención preventiva (dato de demostración)" : undefined,
      creadoPor: "u-admin",
    });
  }

  /* ---------------- Anulaciones de ejemplo (trazabilidad) ---------------- */
  // Un pago duplicado por error y un viaje duplicado, ambos anulados con motivo: no cuentan en ningún total.
  {
    const base = pagos[Math.min(10, pagos.length - 1)];
    if (base) {
      const dup: Pago = {
        ...base,
        id: `p-${pad(pagos.length + 1)}`,
        nota: "Registrado dos veces por error",
        anulado: true,
        motivoAnulacion: "Pago duplicado: ya estaba registrado el mismo monto",
        creadoEn: conHora(base.fecha, 11 * 60 + 40),
      };
      pagos.push(dup);
      cambio(conHora(base.fecha, 12 * 60), base.creadoPor, "pago", dup.id, "Anulación", `Pago anulado: ${dup.motivoAnulacion}`);
    }
    const dViaje = ordenDesp.find((d, i) => i > ordenDesp.length / 2 && d.estado === "finalizado" && viajes.some((x) => x.despachoId === d.id));
    const vBase = dViaje ? viajes.filter((x) => x.despachoId === dViaje.id).at(-1) : undefined;
    if (dViaje && vBase) {
      const dupV: Viaje = {
        ...vBase,
        id: `via-${pad(viajes.length + 1, 5)}`,
        secuencia: vBase.secuencia + 1,
        fechaHora: conHora(dViaje.fecha, 15 * 60 + 5),
        estado: "anulado",
        observaciones: "Viaje ingresado dos veces",
        motivoAnulacion: "Viaje duplicado por error de registro",
      };
      viajes.push(dupV);
      cambio(conHora(dViaje.fecha, 16 * 60), "u-admin", "viaje", dupV.id, "Anulación", `Viaje anulado en ${dViaje.numero}: ${dupV.motivoAnulacion}`);
    }
  }

  /* ---------------- Cambios de ejemplo (validaciones ya registradas arriba) ---------------- */
  cambios.sort((a, b) => a.fecha.localeCompare(b.fecha));
  cambios.forEach((c, i) => (c.id = `cb-${pad(i + 1)}`));

  const seq: Record<string, number> = {
    usuario: USUARIOS.length + 1,
    cliente: CLIENTES.length + 1,
    faena: FAENAS.length + 1,
    vehiculo: VEHICULOS.length + 1,
    material: MATERIALES.length + 1,
    venta: ventas.length + 1,
    pago: pagos.length + 1,
    despacho: despachos.length + 1,
    viaje: viajes.length + 1,
    registro: registros.length + 1,
    carga: cargas.length + 1,
    insumo: insumos.length + 1,
    cambio: cambios.length + 1,
    validacion: registros.length + 1,
  };

  return {
    version: DATA_VERSION,
    usuarios: USUARIOS.map((u) => ({ ...u })),
    clientes: CLIENTES.map((c) => ({ ...c })),
    faenas,
    vehiculos,
    materiales: MATERIALES.map((m) => ({ ...m })),
    ventas,
    pagos,
    despachos: ordenDesp,
    viajes,
    registros,
    cargas,
    insumos,
    cambios,
    config: JSON.parse(JSON.stringify(CONFIG_INICIAL)) as Config,
    seq,
  };
}

function totalesVentaSeed(v: Venta) {
  const bruto = Math.round(v.cantidadM3 * v.precioUnitario);
  const desc = Math.round((bruto * v.descuentoPct) / 100);
  const neto = bruto - desc;
  const iva = Math.round((neto * v.ivaPct) / 100);
  return { neto, iva, total: neto + iva };
}
