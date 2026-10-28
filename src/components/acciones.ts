import type { AppData, Ctx, Resultado } from "@/lib/types";
import { ejecutar } from "@/lib/store";
import { notificar } from "./ui/overlay";

/**
 * Ejecuta una acción de negocio y avisa del resultado. Con `silencioso` no muestra el error
 * (para formularios que lo presentan junto al campo).
 */
export function correr<T extends object>(
  accion: (data: AppData, ctx: Ctx) => Resultado<T>,
  opciones: { exito?: string; silencioso?: boolean } = {},
): Resultado<T> {
  const r = ejecutar(accion);
  if (r.ok) {
    if (opciones.exito) notificar("exito", opciones.exito);
  } else if (!opciones.silencioso) {
    notificar("error", r.error);
  }
  return r;
}
