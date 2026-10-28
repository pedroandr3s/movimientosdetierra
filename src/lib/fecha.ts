import type { ISODate, ISODateTime } from "./types";

/* ------------------------------------------------------------------ */
/* Reloj (sustituible en pruebas)                                      */
/* ------------------------------------------------------------------ */

let relojFijo: Date | null = null;

/** Solo para pruebas automáticas: fija "ahora". Pasar null para volver al reloj real. */
export function fijarReloj(d: Date | null) {
  relojFijo = d;
}

function ahoraDate(): Date {
  return relojFijo ? new Date(relojFijo.getTime()) : new Date();
}

const p2 = (n: number) => String(n).padStart(2, "0");

export function dateToISO(d: Date): ISODate {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function hoyISO(): ISODate {
  return dateToISO(ahoraDate());
}

export function ahoraISO(): ISODateTime {
  const d = ahoraDate();
  return `${dateToISO(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */
/* Aritmética de fechas (siempre en hora local, sin desfases UTC)      */
/* ------------------------------------------------------------------ */

export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function fechaDe(dt: ISODateTime | ISODate): ISODate {
  return dt.slice(0, 10);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return dateToISO(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  // b - a en días
  const da = parseISO(a);
  const db = parseISO(b);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const d = parseISO(iso);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return dateToISO(d);
}

export function inicioMes(iso: ISODate): ISODate {
  const d = parseISO(iso);
  return dateToISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function finMes(iso: ISODate): ISODate {
  const d = parseISO(iso);
  return dateToISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function inicioAnio(iso: ISODate): ISODate {
  return `${iso.slice(0, 4)}-01-01`;
}

/** 0 = domingo … 6 = sábado */
export function diaSemana(iso: ISODate): number {
  return parseISO(iso).getDay();
}

export function esFinDeSemana(iso: ISODate): boolean {
  const d = diaSemana(iso);
  return d === 0 || d === 6;
}

/** Devuelve el mismo día si es hábil; si no, el lunes siguiente. */
export function siguienteHabil(iso: ISODate): ISODate {
  let f = iso;
  while (esFinDeSemana(f)) f = addDays(f, 1);
  return f;
}

/** Devuelve el mismo día si es hábil; si no, el viernes anterior. */
export function anteriorHabil(iso: ISODate): ISODate {
  let f = iso;
  while (esFinDeSemana(f)) f = addDays(f, -1);
  return f;
}

/** Hora (HH:mm) → minutos desde medianoche */
export function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function conHora(fecha: ISODate, minutos: number): ISODateTime {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutos)));
  return `${fecha}T${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
}
