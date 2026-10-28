import type { Rol } from "./types";

/**
 * Matriz de permisos de INTERFAZ de la demo.
 * IMPORTANTE: esto simula roles en el navegador. No es seguridad real: en producción
 * la autorización debe aplicarse en el backend (ver docs/LIMITACIONES.md).
 */
export type Permiso =
  | "dashboard.admin"
  | "dashboard.vendedor"
  | "ventas.ver_todas"
  | "ventas.ver_propias"
  | "ventas.crear"
  | "ventas.editar_cualquiera"
  | "ventas.anular"
  | "ventas.descuento_alto"
  | "ventas.precio_libre"
  | "pagos.registrar"
  | "pagos.anular"
  | "despachos.ver_todos"
  | "despachos.ver_de_mis_ventas"
  | "despachos.crear"
  | "despachos.editar"
  | "despachos.anular"
  | "despachos.autorizar_excepciones"
  | "despachos.registrar_viajes"
  | "registros.ver"
  | "registros.validar"
  | "combustible.ver"
  | "combustible.editar"
  | "reportes.ver"
  | "catalogos.ver_clientes"
  | "catalogos.editar_clientes"
  | "catalogos.ver_materiales"
  | "catalogos.editar_materiales"
  | "catalogos.administrar"
  | "config.ver"
  | "config.editar"
  | "historial.ver_todo"
  | "historial.ver_propio"
  | "conductor.operar";

const MATRIZ: Record<Rol, Permiso[]> = {
  admin: [
    "dashboard.admin",
    "ventas.ver_todas",
    "ventas.crear",
    "ventas.editar_cualquiera",
    "ventas.anular",
    "ventas.descuento_alto",
    "ventas.precio_libre",
    "pagos.registrar",
    "pagos.anular",
    "despachos.ver_todos",
    "despachos.crear",
    "despachos.editar",
    "despachos.anular",
    "despachos.autorizar_excepciones",
    "despachos.registrar_viajes",
    "registros.ver",
    "registros.validar",
    "combustible.ver",
    "combustible.editar",
    "reportes.ver",
    "catalogos.ver_clientes",
    "catalogos.editar_clientes",
    "catalogos.ver_materiales",
    "catalogos.editar_materiales",
    "catalogos.administrar",
    "config.ver",
    "config.editar",
    "historial.ver_todo",
  ],
  vendedor: [
    "dashboard.vendedor",
    "ventas.ver_propias",
    "ventas.crear",
    "ventas.anular",
    "pagos.registrar",
    "despachos.ver_de_mis_ventas",
    "despachos.crear",
    "catalogos.ver_clientes",
    "catalogos.editar_clientes",
    "catalogos.ver_materiales",
    "historial.ver_propio",
  ],
  conductor: ["conductor.operar"],
};

export function can(rol: Rol | undefined, permiso: Permiso): boolean {
  if (!rol) return false;
  return MATRIZ[rol].includes(permiso);
}

export interface NavItem {
  href: string;
  label: string;
  icono: string;
  grupo?: string;
}

export const NAV: Record<Rol, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard general", icono: "layout-dashboard", grupo: "Análisis" },
    { href: "/admin/comercial", label: "Comercial", icono: "line-chart", grupo: "Análisis" },
    { href: "/admin/operacional", label: "Operacional", icono: "route", grupo: "Análisis" },
    { href: "/admin/flota", label: "Flota y combustible", icono: "truck", grupo: "Análisis" },
    { href: "/reportes", label: "Reportes", icono: "file-bar-chart", grupo: "Análisis" },
    { href: "/ventas", label: "Ventas", icono: "receipt", grupo: "Operación" },
    { href: "/despachos", label: "Despachos y talonarios", icono: "clipboard-list", grupo: "Operación" },
    { href: "/registros", label: "Registros diarios", icono: "calendar-check", grupo: "Operación" },
    { href: "/combustible", label: "Combustible e insumos", icono: "fuel", grupo: "Operación" },
    { href: "/clientes", label: "Clientes", icono: "building", grupo: "Catálogos" },
    { href: "/faenas", label: "Faenas y destinos", icono: "map-pin", grupo: "Catálogos" },
    { href: "/vehiculos", label: "Camiones y maquinarias", icono: "truck", grupo: "Catálogos" },
    { href: "/materiales", label: "Materiales y precios", icono: "layers", grupo: "Catálogos" },
    { href: "/usuarios", label: "Usuarios", icono: "users", grupo: "Catálogos" },
    { href: "/historial", label: "Historial de cambios", icono: "history", grupo: "Sistema" },
    { href: "/configuracion", label: "Configuración y datos", icono: "settings", grupo: "Sistema" },
  ],
  vendedor: [
    { href: "/vendedor", label: "Mi panel comercial", icono: "layout-dashboard", grupo: "Mi gestión" },
    { href: "/ventas", label: "Mis ventas", icono: "receipt", grupo: "Mi gestión" },
    { href: "/despachos", label: "Despachos de mis ventas", icono: "clipboard-list", grupo: "Mi gestión" },
    { href: "/clientes", label: "Clientes", icono: "building", grupo: "Consulta" },
    { href: "/materiales", label: "Precios de materiales", icono: "layers", grupo: "Consulta" },
    { href: "/historial", label: "Mi historial", icono: "history", grupo: "Consulta" },
  ],
  conductor: [],
};

export function inicioDeRol(rol: Rol): string {
  if (rol === "admin") return "/admin";
  if (rol === "vendedor") return "/vendedor";
  return "/conductor";
}
