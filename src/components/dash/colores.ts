/**
 * Paleta de gráficos. Los tonos categóricos siguen un orden fijo (nunca se reciclan) y provienen de la
 * paleta de referencia validada (azul, naranja, aguamarina…). El color sigue a la entidad, no a su ranking.
 */
export const SERIE = {
  azul: "#2a78d6",
  naranja: "#eb6834",
  aqua: "#1baf7a",
  amarillo: "#eda100",
  magenta: "#e87ba4",
  violeta: "#6250d6",
} as const;

export const CATEGORICOS = [SERIE.azul, SERIE.naranja, SERIE.aqua, SERIE.amarillo, SERIE.magenta, SERIE.violeta];

/** Estados de cobranza (colores semánticos, siempre acompañados de etiqueta). */
export const COBRANZA = {
  pagado: "#1b9a6b",
  parcial: "#eda100",
  pendiente: "#6b8fc2",
  vencido: "#d64545",
} as const;

export const EJE = "#64748b";
export const GRILLA = "#e5e9f0";
export const PREVIO = "#9aa7bb";

export function colorCategoria(i: number): string {
  return CATEGORICOS[i % CATEGORICOS.length];
}
