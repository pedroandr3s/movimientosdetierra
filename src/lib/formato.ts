import type { ISODate, ISODateTime } from "./types";
import { parseISO } from "./fecha";

const fmtCLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const fmtNum0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const fmtNum1 = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const fmtNum2 = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Pesos chilenos sin decimales: $1.234.567 */
export function clp(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return fmtCLP.format(Math.round(n));
}

/** Versión compacta para ejes de gráficos: $1,2 M / $350 mil */
export function clpCorto(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${fmtNum1.format(n / 1_000_000)} M`;
  if (a >= 1_000) return `$${fmtNum0.format(n / 1_000)} mil`;
  return `$${fmtNum0.format(n)}`;
}

export function num(n: number | null | undefined, decimales = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (decimales === 0) return fmtNum0.format(n);
  if (decimales === 1) return fmtNum1.format(n);
  return fmtNum2.format(n);
}

export function m3(n: number | null | undefined, decimales = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${num(n, decimales)} m³`;
}

export function litros(n: number | null | undefined, decimales = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${num(n, decimales)} L`;
}

export function km(n: number | null | undefined, decimales = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${num(n, decimales)} km`;
}

export function horas(n: number | null | undefined, decimales = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${num(n, decimales)} h`;
}

export function pct(n: number | null | undefined, decimales = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${num(n, decimales)} %`;
}

/** Muestra un indicador o "Sin datos suficientes" (nunca un cero engañoso). */
export function indicador(n: number | null | undefined, formato: (v: number) => string): string {
  if (n == null || Number.isNaN(n)) return "Sin datos suficientes";
  return formato(n);
}

/** dd-mm-aaaa */
export function fecha(iso: ISODate | ISODateTime | undefined | null): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function fechaLarga(iso: ISODate | undefined | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(parseISO(iso));
}

export function fechaCortaDia(iso: ISODate): string {
  const d = parseISO(iso);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function mesCorto(iso: ISODate): string {
  const s = new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit" }).format(parseISO(iso));
  return s.replace(".", "");
}

export function hora(dt: ISODateTime | undefined | null): string {
  if (!dt || dt.length < 16) return "—";
  return dt.slice(11, 16);
}

export function fechaHora(dt: ISODateTime | undefined | null): string {
  if (!dt) return "—";
  return `${fecha(dt)} ${hora(dt)}`;
}

export function signo(n: number, texto: string): string {
  return n > 0 ? `+${texto}` : texto;
}

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
