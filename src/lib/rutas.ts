import type { Rol } from "./types";
import { can } from "./permisos";

/**
 * Control de acceso de INTERFAZ por ruta (demo). La seguridad real debe aplicarse en el servidor.
 */
export function puedeVerRuta(rol: Rol | undefined, ruta: string): boolean {
  if (!rol) return false;
  const p = ruta.replace(/\/+$/, "") || "/";
  const empieza = (base: string) => p === base || p.startsWith(`${base}/`);

  if (empieza("/conductor")) return can(rol, "conductor.operar");
  if (rol === "conductor") return false;

  if (empieza("/admin")) return rol === "admin";
  if (empieza("/vendedor")) return can(rol, "dashboard.vendedor");
  if (["/reportes", "/registros", "/combustible", "/faenas", "/vehiculos", "/usuarios", "/configuracion"].some(empieza)) return rol === "admin";
  if (empieza("/ventas")) return can(rol, "ventas.ver_todas") || can(rol, "ventas.ver_propias");
  if (empieza("/despachos")) return can(rol, "despachos.ver_todos") || can(rol, "despachos.ver_de_mis_ventas");
  if (empieza("/clientes")) return can(rol, "catalogos.ver_clientes");
  if (empieza("/materiales")) return can(rol, "catalogos.ver_materiales");
  if (empieza("/historial")) return can(rol, "historial.ver_todo") || can(rol, "historial.ver_propio");
  return true;
}
