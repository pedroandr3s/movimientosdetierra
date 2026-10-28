import { generarDatosDemo } from "../src/lib/seed";
import type { AppData, Ctx, Resultado } from "../src/lib/types";

export const HOY = "2026-10-27";
export const AHORA = "2026-10-27T10:30";

export function datos(): AppData {
  return generarDatosDemo(HOY);
}

export function ctx(userId: string): Ctx {
  return { userId, hoy: HOY, ahora: AHORA };
}

export const ADMIN = ctx("u-admin");
export const VENDEDOR = ctx("u-vend-1");
export const VENDEDOR2 = ctx("u-vend-2");
export const CONDUCTOR = ctx("u-cond-1");
export const CONDUCTOR2 = ctx("u-cond-2");

/** Exige éxito y devuelve el resultado tipado. */
export function ok<T extends object>(r: Resultado<T>): { ok: true; data: AppData } & T {
  if (!r.ok) throw new Error(`Se esperaba éxito pero falló: ${r.error}`);
  return r;
}

export function falla<T extends object>(r: Resultado<T>): { ok: false; error: string; campo?: string; codigo?: string } {
  if (r.ok) throw new Error("Se esperaba un error pero la acción tuvo éxito.");
  return r;
}
