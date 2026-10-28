"use client";
import { useMemo, useState } from "react";
import { rangoDeFiltros } from "@/lib/calc";
import { construirCSV, descargarTexto } from "@/lib/csv";
import { useFiltros } from "@/lib/filtros-store";
import { hoyISO } from "@/lib/fecha";
import { clp, fecha, horas, km, litros, m3, num } from "@/lib/formato";
import { REPORTES, generarReporte, type ColumnaReporte, type Formato, type Valor } from "@/lib/reportes";
import { useData } from "@/lib/store";
import { ETIQUETAS, type AppData } from "@/lib/types";
import type { Filtros } from "@/lib/calc";
import { Boton, Tarjeta } from "@/components/ui/base";
import { cn } from "@/components/ui/cn";
import { AvisoPagina, EncabezadoPagina, EstadoVacio } from "@/components/ui/datos";
import { Download, FileBarChart, Printer } from "@/components/ui/icons";
import { FiltrosGlobales } from "@/components/dash/FiltrosGlobales";
import { GraficoBarrasSimple } from "@/components/dash/graficos";

export function formatear(v: Valor, f: Formato): string {
  if (v == null) return "Sin dato";
  if (typeof v === "string") return f === "fecha" ? fecha(v) : v;
  switch (f) {
    case "clp": return clp(v);
    case "m3": return m3(v);
    case "litros": return litros(v, Number.isInteger(v) ? 0 : 1);
    case "pct": return `${num(v, 1)} %`;
    case "km": return km(v, 1);
    case "horas": return horas(v);
    case "num": return num(v, Number.isInteger(v) ? 0 : 1);
    default: return String(v);
  }
}

function describirFiltros(data: AppData, f: Filtros, dimensiones: string[]): string {
  const partes: string[] = [];
  const add = (cond: string | undefined, texto: string) => cond && partes.push(texto);
  if (dimensiones.includes("vendedor")) add(f.vendedorId, `Vendedor: ${data.usuarios.find((u) => u.id === f.vendedorId)?.nombre}`);
  if (dimensiones.includes("cliente")) add(f.clienteId, `Cliente: ${data.clientes.find((c) => c.id === f.clienteId)?.nombre}`);
  if (dimensiones.includes("material")) add(f.materialId, `Material: ${data.materiales.find((m) => m.id === f.materialId)?.nombre}`);
  if (dimensiones.includes("faena")) add(f.faenaId, `Faena: ${data.faenas.find((x) => x.id === f.faenaId)?.nombre}`);
  if (dimensiones.includes("conductor")) add(f.conductorId, `Conductor: ${data.usuarios.find((u) => u.id === f.conductorId)?.nombre}`);
  if (dimensiones.includes("vehiculo")) add(f.vehiculoId, `Vehículo: ${data.vehiculos.find((v) => v.id === f.vehiculoId)?.codigo}`);
  if (dimensiones.includes("estadoVenta")) add(f.estadoVenta, `Estado de venta: ${f.estadoVenta ? ETIQUETAS.estadoComercial[f.estadoVenta] : ""}`);
  if (dimensiones.includes("estadoDespacho")) add(f.estadoDespacho, `Estado de despacho: ${f.estadoDespacho ? ETIQUETAS.estadoDespacho[f.estadoDespacho] : ""}`);
  return partes.length > 0 ? partes.join(" · ") : "Sin filtros adicionales";
}

const claseAlin = (c: ColumnaReporte) => (c.formato === "txt" || c.formato === "fecha" ? "text-left" : "text-right tabular");

export function PaginaReportes() {
  const data = useData();
  const f = useFiltros();
  const hoy = hoyISO();
  const [id, setId] = useState(REPORTES[0].id);
  const def = REPORTES.find((r) => r.id === id) ?? REPORTES[0];
  const r = useMemo(() => rangoDeFiltros(f, hoy), [f, hoy]);
  const res = useMemo(() => generarReporte(data, def.id, f, hoy), [data, def.id, f, hoy]);
  if (!res) return null;
  const filtrosTxt = describirFiltros(data, f, def.dimensiones);

  function exportar() {
    if (!res || res.filas.length === 0) return;
    descargarTexto(`reporte_${def.id}_${r.desde}_${r.hasta}.csv`, construirCSV(res.columnas.map((c) => c.titulo), res.filas));
  }

  return (
    <div className="pagina-apaisada">
      <div className="no-imprimir">
        <EncabezadoPagina
          titulo="Reportes"
          descripcion="Elige un reporte, define el periodo y los filtros. La exportación CSV contiene exactamente las filas que ves."
          acciones={
            <>
              <Boton variante="secundario" onClick={exportar} disabled={res.filas.length === 0}><Download className="size-4" /> Exportar CSV</Boton>
              <Boton variante="secundario" onClick={() => window.print()} disabled={res.filas.length === 0}><Printer className="size-4" /> Imprimir</Boton>
            </>
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
        <nav aria-label="Lista de reportes" className="no-imprimir">
          <label className="mb-1 block text-xs font-medium text-slate-600 lg:hidden" htmlFor="sel-reporte">Reporte</label>
          <select id="sel-reporte" value={id} onChange={(e) => setId(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm lg:hidden">
            {REPORTES.map((x, k) => <option key={x.id} value={x.id}>{k + 1}. {x.titulo}</option>)}
          </select>
          <ul className="hidden space-y-1 lg:block">
            {REPORTES.map((x, k) => (
              <li key={x.id}>
                <button type="button" onClick={() => setId(x.id)} aria-current={x.id === id ? "true" : undefined} className={cn("w-full rounded-lg px-3 py-2 text-left text-[13px] leading-snug transition-colors", x.id === id ? "bg-brand-600 font-medium text-white" : "text-slate-700 hover:bg-slate-100")}>
                  <span className="mr-1.5 tabular opacity-70">{k + 1}.</span>{x.titulo}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <FiltrosGlobales dimensiones={def.dimensiones} />

          <div className="solo-impresion mb-4">
            <p className="text-lg font-bold text-navy-900">{data.config.empresa.nombre} — {def.titulo}</p>
            <p className="text-sm text-slate-600">Periodo: {fecha(r.desde)} a {fecha(r.hasta)} · {filtrosTxt}</p>
            <p className="text-xs text-slate-500">Generado el {fecha(hoy)} · Datos de demostración · Informe interno, no tributario</p>
          </div>

          <div className="mb-3 no-imprimir">
            <h2 className="text-lg font-semibold text-navy-900">{def.titulo}</h2>
            <p className="text-sm text-slate-600">{def.descripcion}</p>
          </div>

          {res.resumen.length > 0 && (
            <dl className="mb-4 flex flex-wrap gap-3">
              {res.resumen.map((s) => (
                <div key={s.etiqueta} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                  <dt className="text-xs text-slate-500">{s.etiqueta}</dt>
                  <dd className="text-lg font-semibold tabular text-navy-900">{typeof s.valor === "number" ? formatear(s.valor, s.formato ?? "num") : s.valor}</dd>
                </div>
              ))}
            </dl>
          )}

          {res.filas.length === 0 ? (
            <Tarjeta><EstadoVacio icono={<FileBarChart className="size-6" />} titulo="Sin datos para este periodo y filtros" descripcion="Prueba ampliando el periodo o quitando filtros. No se exportan archivos vacíos." /></Tarjeta>
          ) : (
            <>
              {res.grafico && res.grafico.datos.length > 0 && (
                <div className="mb-4 no-imprimir">
                  <GraficoBarrasSimple titulo={res.grafico.titulo} datos={res.grafico.datos.map((d, k) => ({ id: String(k), nombre: d.nombre, valor: d.valor }))} formato={(n) => formatear(n, res.grafico!.formato)} vacio="Sin datos" etiquetaValor={res.grafico.etiquetaValor} />
                </div>
              )}
              <Tarjeta className="overflow-hidden">
                <div className="tabla-reporte overflow-x-auto">
                  <table className="w-full text-[13px]" aria-label={def.titulo}>
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                        {res.columnas.map((c) => <th key={c.titulo} scope="col" className={cn("whitespace-nowrap px-3 py-2.5 font-semibold", claseAlin(c))}>{c.titulo}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {res.filas.map((fila, k) => (
                        <tr key={k} className="hover:bg-slate-50/70">
                          {fila.map((v, j) => <td key={j} className={cn("whitespace-nowrap px-3 py-2", claseAlin(res.columnas[j]), v == null && "text-slate-400")}>{formatear(v, res.columnas[j].formato)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                    {res.totales && (
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                          {res.totales.map((v, j) => <td key={j} className={cn("whitespace-nowrap px-3 py-2.5", claseAlin(res.columnas[j]))}>{v == null ? "" : formatear(v, res.columnas[j].formato)}</td>)}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </Tarjeta>
              <p className="mt-2 text-xs text-slate-500 no-imprimir">{res.filas.length} {res.filas.length === 1 ? "fila" : "filas"} · {fecha(r.desde)} a {fecha(r.hasta)}</p>
            </>
          )}

          {res.notas.length > 0 && (
            <div className="mt-4">
              <AvisoPagina tono="info" titulo="Cómo se calcula">
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {res.notas.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </AvisoPagina>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
