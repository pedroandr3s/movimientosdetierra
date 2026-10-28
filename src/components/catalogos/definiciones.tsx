import type { Catalogo } from "@/lib/actions";
import { cobradoVenta, nombreDe, totalesVenta, ultimaLectura, ventaValida } from "@/lib/calc";
import { clp, fecha, horas, km, m3 } from "@/lib/formato";
import { ETIQUETAS, type AppData, type EstadoVehiculo, type Rol, type TipoVehiculo } from "@/lib/types";
import type { Columna } from "@/components/ui/datos";
import { Insignia } from "@/components/ui/base";
import { BadgeVehiculo } from "@/components/Estados";

export type Valores = Record<string, string | boolean>;

export interface CampoDef {
  clave: string;
  etiqueta: string;
  tipo: "texto" | "numero" | "select" | "largo" | "fecha" | "bool";
  obligatorio?: boolean;
  unidad?: string;
  ayuda?: string;
  opciones?: { valor: string; etiqueta: string }[];
  /** Ancho completo en el formulario. */
  ancho?: boolean;
  visible?: (v: Valores) => boolean;
}

export interface DefCatalogo<T extends { id: string }> {
  cat: Catalogo;
  titulo: string;
  singular: string;
  descripcion: string;
  columnas: (data: AppData) => Columna<T>[];
  campos: (data: AppData, valores: Valores) => CampoDef[];
  inicial: () => Valores;
  texto: (data: AppData, x: T) => string;
  activo?: (x: T) => boolean;
  /** Ruta a la ficha propia del registro (solo clientes). */
  ficha?: (x: T) => string;
}

const estadoActivo = (a?: boolean) => (a === false ? <Insignia tono="gris">Inactivo</Insignia> : <Insignia tono="verde">Activo</Insignia>);

export const DEF_CLIENTES: DefCatalogo<AppData["clientes"][number]> = {
  cat: "clientes",
  titulo: "Clientes",
  singular: "cliente",
  descripcion: "Contactos comerciales. Cada cliente reúne sus ventas, despachos y saldo pendiente.",
  columnas: (data) => [
    { clave: "n", titulo: "Cliente", celda: (c) => <span className="font-medium text-slate-900">{c.nombre}</span>, orden: (c) => c.nombre },
    { clave: "r", titulo: "RUT", celda: (c) => c.rut ?? "—", ocultarEnMovil: true },
    { clave: "ct", titulo: "Contacto", celda: (c) => [c.contacto, c.telefono].filter(Boolean).join(" · ") || "—", ocultarEnMovil: true },
    { clave: "v", titulo: "Ventas", alinear: "der", celda: (c) => data.ventas.filter((v) => v.clienteId === c.id && ventaValida(v)).length, orden: (c) => data.ventas.filter((v) => v.clienteId === c.id && ventaValida(v)).length },
    { clave: "s", titulo: "Saldo por cobrar", alinear: "der", celda: (c) => { const s = saldoCliente(data, c.id); return s > 0 ? clp(s) : "—"; }, orden: (c) => saldoCliente(data, c.id) },
    { clave: "a", titulo: "Estado", celda: (c) => estadoActivo(c.activo) },
  ],
  campos: () => [
    { clave: "nombre", etiqueta: "Nombre o razón social", tipo: "texto", obligatorio: true, ancho: true },
    { clave: "rut", etiqueta: "RUT (opcional)", tipo: "texto", ayuda: "Dato ficticio de demostración." },
    { clave: "contacto", etiqueta: "Persona de contacto", tipo: "texto" },
    { clave: "telefono", etiqueta: "Teléfono", tipo: "texto" },
    { clave: "email", etiqueta: "Correo", tipo: "texto" },
    { clave: "direccion", etiqueta: "Dirección", tipo: "texto", ancho: true },
    { clave: "observaciones", etiqueta: "Observaciones", tipo: "largo", ancho: true },
    { clave: "activo", etiqueta: "Cliente activo", tipo: "bool" },
  ],
  inicial: () => ({ nombre: "", rut: "", contacto: "", telefono: "", email: "", direccion: "", observaciones: "", activo: true }),
  texto: (_d, c) => `${c.nombre} ${c.rut ?? ""} ${c.contacto ?? ""} ${c.email ?? ""}`,
  activo: (c) => c.activo,
  ficha: (c) => `/clientes/${c.id}`,
};

export function saldoCliente(data: AppData, clienteId: string): number {
  return data.ventas.filter((v) => v.clienteId === clienteId && v.estado === "confirmada").reduce((s, v) => s + Math.max(0, totalesVenta(v).total - cobradoVenta(data, v.id)), 0);
}

export const DEF_FAENAS: DefCatalogo<AppData["faenas"][number]> = {
  cat: "faenas",
  titulo: "Faenas y destinos",
  singular: "faena",
  descripcion: "Lugares de entrega. Basta una referencia del lugar; no se necesita dirección exacta.",
  columnas: (data) => [
    { clave: "n", titulo: "Faena", celda: (f) => <span className="font-medium text-slate-900">{f.nombre}</span>, orden: (f) => f.nombre },
    { clave: "c", titulo: "Cliente", celda: (f) => (f.clienteId ? nombreDe.cliente(data, f.clienteId) : "—"), orden: (f) => nombreDe.cliente(data, f.clienteId) },
    { clave: "r", titulo: "Referencia", celda: (f) => <span className="block max-w-[20rem] truncate">{f.referencia}</span>, ocultarEnMovil: true },
    { clave: "e", titulo: "Entregas", alinear: "der", celda: (f) => data.despachos.filter((d) => d.faenaId === f.id && d.estado !== "anulado").length },
    { clave: "a", titulo: "Estado", celda: (f) => estadoActivo(f.activo) },
  ],
  campos: (data) => [
    { clave: "nombre", etiqueta: "Nombre de la faena", tipo: "texto", obligatorio: true },
    { clave: "clienteId", etiqueta: "Cliente (opcional)", tipo: "select", opciones: [{ valor: "", etiqueta: "Sin cliente" }, ...data.clientes.map((c) => ({ valor: c.id, etiqueta: c.nombre }))] },
    { clave: "referencia", etiqueta: "Referencia del lugar", tipo: "texto", obligatorio: true, ancho: true, ayuda: "Ej.: Camino rural Ruta N-31, tramo km 12." },
    { clave: "contacto", etiqueta: "Contacto en terreno", tipo: "texto" },
    { clave: "observaciones", etiqueta: "Observaciones", tipo: "largo", ancho: true },
    { clave: "activo", etiqueta: "Faena activa", tipo: "bool" },
  ],
  inicial: () => ({ nombre: "", clienteId: "", referencia: "", contacto: "", observaciones: "", activo: true }),
  texto: (d, f) => `${f.nombre} ${f.referencia} ${nombreDe.cliente(d, f.clienteId)}`,
  activo: (f) => f.activo,
};

const TIPOS: { valor: TipoVehiculo; etiqueta: string }[] = [
  { valor: "camion", etiqueta: ETIQUETAS.tipoVehiculo.camion },
  { valor: "maquinaria", etiqueta: ETIQUETAS.tipoVehiculo.maquinaria },
  { valor: "otro", etiqueta: ETIQUETAS.tipoVehiculo.otro },
];
const ESTADOS_VEH = (Object.keys(ETIQUETAS.estadoVehiculo) as EstadoVehiculo[]).map((e) => ({ valor: e, etiqueta: ETIQUETAS.estadoVehiculo[e] }));

export const DEF_VEHICULOS: DefCatalogo<AppData["vehiculos"][number]> = {
  cat: "vehiculos",
  titulo: "Camiones y maquinarias",
  singular: "vehículo",
  descripcion: "Los camiones se miden en kilómetros y la maquinaria en horas de horómetro; nunca se mezclan.",
  columnas: (data) => [
    { clave: "c", titulo: "Identificador", celda: (v) => <span className="font-medium text-slate-900">{v.codigo}</span>, orden: (v) => v.codigo },
    { clave: "t", titulo: "Tipo", celda: (v) => ETIQUETAS.tipoVehiculo[v.tipo], orden: (v) => v.tipo },
    { clave: "p", titulo: "Patente", celda: (v) => v.patente ?? "—", ocultarEnMovil: true },
    { clave: "cap", titulo: "Capacidad", alinear: "der", celda: (v) => (v.capacidadM3 ? m3(v.capacidadM3, 0) : "—"), ocultarEnMovil: true },
    { clave: "l", titulo: "Última lectura", alinear: "der", celda: (v) => (v.medidor === "horas" ? horas(ultimaLectura(data, v.id)) : km(ultimaLectura(data, v.id))), orden: (v) => ultimaLectura(data, v.id) },
    { clave: "h", titulo: "Conductor habitual", celda: (v) => (v.conductorHabitualId ? nombreDe.usuario(data, v.conductorHabitualId) : "—"), ocultarEnMovil: true },
    { clave: "rev", titulo: "Próx. revisión", celda: (v) => (v.proximaRevision ? fecha(v.proximaRevision) : "—"), orden: (v) => v.proximaRevision ?? "9999", ocultarEnMovil: true },
    { clave: "e", titulo: "Estado", celda: (v) => <BadgeVehiculo estado={v.estado} />, orden: (v) => v.estado },
  ],
  campos: (data, val) => [
    { clave: "codigo", etiqueta: "Identificador interno", tipo: "texto", obligatorio: true, ayuda: "Ej.: CAM-05 o MAQ-02." },
    { clave: "tipo", etiqueta: "Tipo de equipo", tipo: "select", obligatorio: true, opciones: TIPOS },
    { clave: "patente", etiqueta: "Patente (opcional)", tipo: "texto" },
    { clave: "marca", etiqueta: "Marca", tipo: "texto" },
    { clave: "modelo", etiqueta: "Modelo", tipo: "texto" },
    { clave: "capacidadM3", etiqueta: "Capacidad de carga", tipo: "numero", unidad: "m³", obligatorio: val.tipo === "camion", visible: (v) => v.tipo !== "maquinaria" },
    { clave: "medidor", etiqueta: "Se mide en", tipo: "select", obligatorio: true, opciones: [{ valor: "km", etiqueta: "Kilómetros (odómetro)" }, { valor: "horas", etiqueta: "Horas (horómetro)" }] },
    { clave: "lecturaActual", etiqueta: val.medidor === "horas" ? "Horómetro actual" : "Kilometraje actual", tipo: "numero", unidad: val.medidor === "horas" ? "h" : "km", obligatorio: true, ayuda: "No puede ser menor que la última lectura registrada." },
    { clave: "conductorHabitualId", etiqueta: "Conductor habitual", tipo: "select", opciones: [{ valor: "", etiqueta: "Sin asignar" }, ...data.usuarios.filter((u) => u.rol === "conductor").map((u) => ({ valor: u.id, etiqueta: u.nombre }))] },
    { clave: "estado", etiqueta: "Estado operativo", tipo: "select", opciones: ESTADOS_VEH },
    { clave: "proximaRevision", etiqueta: "Próxima revisión", tipo: "fecha" },
    { clave: "observaciones", etiqueta: "Observaciones", tipo: "largo", ancho: true },
  ],
  inicial: () => ({ codigo: "", tipo: "camion", patente: "", marca: "", modelo: "", capacidadM3: "", medidor: "km", lecturaActual: "0", conductorHabitualId: "", estado: "disponible", proximaRevision: "", observaciones: "" }),
  texto: (d, v) => `${v.codigo} ${v.patente ?? ""} ${v.marca ?? ""} ${v.modelo ?? ""} ${ETIQUETAS.tipoVehiculo[v.tipo]}`,
};

export const DEF_MATERIALES: DefCatalogo<AppData["materiales"][number]> = {
  cat: "materiales",
  titulo: "Materiales y precios",
  singular: "material",
  descripcion: "Precio de referencia NETO (sin IVA) por m³. Cada venta guarda su propio precio, por lo que un cambio aquí no altera ventas históricas.",
  columnas: () => [
    { clave: "n", titulo: "Material", celda: (m) => <span className="font-medium text-slate-900">{m.nombre}</span>, orden: (m) => m.nombre },
    { clave: "u", titulo: "Unidad", celda: (m) => m.unidad },
    { clave: "p", titulo: "Precio ref. neto", alinear: "der", celda: (m) => clp(m.precioReferencia), orden: (m) => m.precioReferencia },
    { clave: "d", titulo: "Descripción", celda: (m) => m.descripcion ?? "—", ocultarEnMovil: true },
    { clave: "a", titulo: "Estado", celda: (m) => estadoActivo(m.activo) },
  ],
  campos: () => [
    { clave: "nombre", etiqueta: "Nombre del material", tipo: "texto", obligatorio: true },
    { clave: "unidad", etiqueta: "Unidad", tipo: "texto" },
    { clave: "precioReferencia", etiqueta: "Precio de referencia neto", tipo: "numero", unidad: "$/m³", obligatorio: true, ayuda: "Valor ficticio de demostración, sin IVA." },
    { clave: "descripcion", etiqueta: "Descripción", tipo: "largo", ancho: true },
    { clave: "activo", etiqueta: "Material activo", tipo: "bool" },
  ],
  inicial: () => ({ nombre: "", unidad: "m³", precioReferencia: "", descripcion: "", activo: true }),
  texto: (_d, m) => `${m.nombre} ${m.descripcion ?? ""}`,
  activo: (m) => m.activo,
};

const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: "admin", etiqueta: ETIQUETAS.rol.admin },
  { valor: "vendedor", etiqueta: ETIQUETAS.rol.vendedor },
  { valor: "conductor", etiqueta: ETIQUETAS.rol.conductor },
];

export const DEF_USUARIOS: DefCatalogo<AppData["usuarios"][number]> = {
  cat: "usuarios",
  titulo: "Usuarios",
  singular: "usuario",
  descripcion: "Usuarios ficticios de la demostración. Los roles se simulan en la interfaz: no constituyen seguridad real, que debe aplicarse en un servidor.",
  columnas: () => [
    { clave: "n", titulo: "Nombre", celda: (u) => <span className="font-medium text-slate-900">{u.nombre}</span>, orden: (u) => u.nombre },
    { clave: "r", titulo: "Rol", celda: (u) => ETIQUETAS.rol[u.rol], orden: (u) => u.rol },
    { clave: "e", titulo: "Correo", celda: (u) => u.email, ocultarEnMovil: true },
    { clave: "t", titulo: "Teléfono", celda: (u) => u.telefono ?? "—", ocultarEnMovil: true },
    { clave: "a", titulo: "Estado", celda: (u) => estadoActivo(u.activo) },
  ],
  campos: () => [
    { clave: "nombre", etiqueta: "Nombre completo", tipo: "texto", obligatorio: true },
    { clave: "rol", etiqueta: "Rol", tipo: "select", obligatorio: true, opciones: ROLES },
    { clave: "email", etiqueta: "Correo", tipo: "texto", obligatorio: true },
    { clave: "telefono", etiqueta: "Teléfono", tipo: "texto" },
    { clave: "activo", etiqueta: "Usuario activo", tipo: "bool" },
  ],
  inicial: () => ({ nombre: "", rol: "vendedor", email: "", telefono: "", activo: true }),
  texto: (_d, u) => `${u.nombre} ${u.email} ${ETIQUETAS.rol[u.rol]}`,
  activo: (u) => u.activo,
};

export type ClaveDef = "clientes" | "faenas" | "vehiculos" | "materiales" | "usuarios";
