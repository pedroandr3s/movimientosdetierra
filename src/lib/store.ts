/**
 * Almacén único de datos de la demo (una sola fuente de verdad).
 * Patrón useSyncExternalStore: sin acceso a localStorage durante el render del servidor.
 */
import { useSyncExternalStore } from "react";
import type { AppData, Ctx, Resultado, Usuario } from "./types";
import { ahoraISO, hoyISO } from "./fecha";
import { generarDatosDemo } from "./seed";
import { cargarDatos, exportarJSON, guardarDatos, guardarSesion, importarJSON, leerSesion, STORAGE_KEY } from "./persist";
import { idx } from "./calc";

export type EstadoStore =
  | { status: "cargando" }
  | {
      status: "listo";
      data: AppData;
      userId: string | null;
      /** Error al guardar en el navegador (se muestra como aviso). */
      errorPersistencia: string | null;
      /** Aviso al cargar (datos inválidos restaurados). */
      avisoCarga: string | null;
    };

const CARGANDO: EstadoStore = { status: "cargando" };
let estado: EstadoStore = CARGANDO;
const oyentes = new Set<() => void>();

function fijar(sig: EstadoStore) {
  estado = sig;
  oyentes.forEach((l) => l());
}

export function suscribir(cb: () => void) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}
export const instantanea = () => estado;
export const instantaneaServidor = () => CARGANDO;

let escuchandoStorage = false;

/** Carga los datos guardados (o crea los de demostración). Idempotente. */
export function inicializar() {
  if (estado.status === "listo") return;
  const { data: guardados, aviso } = cargarDatos();
  let data = guardados;
  let errorPersistencia: string | null = null;
  if (!data) {
    data = generarDatosDemo(hoyISO());
    errorPersistencia = guardarDatos(data);
  }
  let userId = leerSesion();
  if (userId && !data.usuarios.some((u) => u.id === userId && u.activo)) userId = null;
  fijar({ status: "listo", data, userId, errorPersistencia, avisoCarga: aviso ?? null });
  if (!escuchandoStorage && typeof window !== "undefined") {
    escuchandoStorage = true;
    // Sincroniza varias pestañas abiertas
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY || estado.status !== "listo") return;
      const { data: nuevos } = cargarDatos();
      if (nuevos) fijar({ ...estado, data: nuevos });
    });
  }
}

export function useEstadoStore(): EstadoStore {
  return useSyncExternalStore(suscribir, instantanea, instantaneaServidor);
}

export function contexto(): Ctx | null {
  if (estado.status !== "listo" || !estado.userId) return null;
  return { userId: estado.userId, hoy: hoyISO(), ahora: ahoraISO() };
}

/** Ejecuta una acción de negocio, aplica el resultado y lo guarda en el navegador. */
export function ejecutar<T extends object>(accion: (data: AppData, ctx: Ctx) => Resultado<T>): Resultado<T> {
  const ctx = contexto();
  if (estado.status !== "listo" || !ctx) return { ok: false, error: "No hay una sesión activa. Selecciona un usuario de demostración." };
  let r: Resultado<T>;
  try {
    r = accion(estado.data, ctx);
  } catch (e) {
    return { ok: false, error: `Ocurrió un error inesperado: ${e instanceof Error ? e.message : "desconocido"}.` };
  }
  if (r.ok) {
    const errorPersistencia = guardarDatos(r.data);
    fijar({ ...estado, data: r.data, errorPersistencia });
  }
  return r;
}

export function iniciarSesion(userId: string) {
  if (estado.status !== "listo") return;
  const u = estado.data.usuarios.find((x) => x.id === userId && x.activo);
  if (!u) return;
  guardarSesion(userId);
  fijar({ ...estado, userId });
}

export function cerrarSesion() {
  if (estado.status !== "listo") return;
  guardarSesion(null);
  fijar({ ...estado, userId: null });
}

export function restaurarDemo(): void {
  if (estado.status !== "listo") return;
  const actual = estado;
  const data = generarDatosDemo(hoyISO());
  const errorPersistencia = guardarDatos(data);
  const userId = actual.userId && data.usuarios.some((u) => u.id === actual.userId) ? actual.userId : null;
  fijar({ ...actual, data, userId, errorPersistencia, avisoCarga: null });
}

export function importarDatos(texto: string): { ok: true } | { ok: false; error: string } {
  if (estado.status !== "listo") return { ok: false, error: "La aplicación aún no está lista." };
  const actual = estado;
  const r = importarJSON(texto);
  if (!r.ok) return r;
  const errorPersistencia = guardarDatos(r.data);
  const userId = actual.userId && r.data.usuarios.some((u) => u.id === actual.userId && u.activo) ? actual.userId : null;
  if (!userId) guardarSesion(null);
  fijar({ ...actual, data: r.data, userId, errorPersistencia, avisoCarga: null });
  return { ok: true };
}

export function exportarDatos(): string | null {
  if (estado.status !== "listo") return null;
  return exportarJSON(estado.data, ahoraISO());
}

export function descartarAviso(tipo: "persistencia" | "carga") {
  if (estado.status !== "listo") return;
  fijar({ ...estado, errorPersistencia: tipo === "persistencia" ? null : estado.errorPersistencia, avisoCarga: tipo === "carga" ? null : estado.avisoCarga });
}

/* ---------------- Hooks ---------------- */

/** Datos actuales (solo dentro de la aplicación ya cargada). */
export function useData(): AppData {
  const e = useEstadoStore();
  if (e.status !== "listo") throw new Error("Los datos aún no están cargados.");
  return e.data;
}

export function useUsuario(): Usuario | null {
  const e = useEstadoStore();
  if (e.status !== "listo" || !e.userId) return null;
  return idx(e.data).usuarios.get(e.userId) ?? null;
}
