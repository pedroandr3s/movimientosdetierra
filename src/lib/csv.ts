/** Exportación CSV pensada para Excel en español: separador ";", BOM UTF-8 y comillas escapadas. */
export type CeldaCSV = string | number | null | undefined;

function escapar(v: CeldaCSV): string {
  if (v == null) return "";
  const t = String(v);
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function construirCSV(encabezados: string[], filas: CeldaCSV[][]): string {
  const lineas = [encabezados, ...filas].map((f) => f.map(escapar).join(";"));
  return `﻿${lineas.join("\r\n")}\r\n`;
}

/** Descarga un archivo de texto desde el navegador. */
export function descargarTexto(nombre: string, contenido: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
