"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActividadVehiculo, FilaGrupoVenta, PuntoCombustible, PuntoOperacion, PuntoVentas, ResumenCobranza } from "@/lib/calc";
import { clp, clpCorto, fecha, horas, km, litros, m3, num, pct } from "@/lib/formato";
import { Pestanas } from "@/components/ui/datos";
import { Insignia } from "@/components/ui/base";
import { CajaTooltip, TablaSimple, TarjetaGrafico } from "./Tarjeta-grafico";
import { COBRANZA, EJE, GRILLA, PREVIO, SERIE, colorCategoria } from "./colores";

const tick = { fontSize: 11, fill: EJE };
const leyenda = { fontSize: 12, paddingTop: 6 };
const sinDatos = (arr: number[]) => arr.every((x) => !x);

/* ------------------------------------------------------------------ */
/* 1. Evolución de ventas                                              */
/* ------------------------------------------------------------------ */
export function GraficoEvolucionVentas({ serie, comparar }: { serie: PuntoVentas[]; comparar: boolean }) {
  const vacio = sinDatos(serie.map((p) => p.total)) ? { titulo: "Sin ventas en el periodo", descripcion: "Prueba con otro periodo o quita filtros." } : null;
  const totalPrev = serie.reduce((s, p) => s + (p.previo ?? 0), 0);
  const conPrev = comparar && totalPrev > 0;
  return (
    <TarjetaGrafico
      titulo="Evolución de ventas"
      subtitulo="Importe con IVA de ventas confirmadas, por día, semana o mes según el periodo."
      vacio={vacio}
      tabla={
        <TablaSimple
          columnas={[{ t: "Periodo" }, { t: "N° ventas", der: true }, { t: "m³ vendidos", der: true }, { t: "Neto", der: true }, { t: "Total con IVA", der: true }, ...(conPrev ? [{ t: "Periodo anterior", der: true }] : [])]}
          filas={serie.map((p) => [p.etiqueta, num(p.n), m3(p.volumen), clp(p.neto), clp(p.total), ...(conPrev ? [clp(p.previo ?? 0)] : [])])}
        />
      }
    >
      <div role="img" aria-label="Gráfico de ventas por periodo">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRILLA} vertical={false} />
            <XAxis dataKey="etiqueta" tick={tick} tickLine={false} axisLine={{ stroke: GRILLA }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => clpCorto(v as number)} width={56} />
            <Tooltip
              cursor={{ fill: "rgb(31 95 168 / 0.06)" }}
              content={(p) => {
                const d = p.payload?.[0]?.payload as PuntoVentas | undefined;
                if (!p.active || !d) return null;
                return (
                  <CajaTooltip
                    titulo={d.desde === d.hasta ? fecha(d.desde) : `${fecha(d.desde)} – ${fecha(d.hasta)}`}
                    filas={[
                      { etiqueta: "Ventas", valor: num(d.n) },
                      { etiqueta: "Importe con IVA", valor: clp(d.total), color: SERIE.azul },
                      { etiqueta: "Neto", valor: clp(d.neto) },
                      ...(conPrev ? [{ etiqueta: "Periodo anterior", valor: d.previo != null ? clp(d.previo) : "—", color: PREVIO }] : []),
                    ]}
                  />
                );
              }}
            />
            <Legend wrapperStyle={leyenda} />
            <Bar dataKey="total" name="Periodo actual" fill={SERIE.azul} radius={[4, 4, 0, 0]} maxBarSize={36} />
            {conPrev && <Line dataKey="previo" name="Periodo anterior" stroke={PREVIO} strokeWidth={2} strokeDasharray="5 4" dot={false} type="monotone" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafico>
  );
}

/* ------------------------------------------------------------------ */
/* 2 y 3. Barras horizontales por grupo (material / vendedor)           */
/* ------------------------------------------------------------------ */
function GraficoPorGrupo({ titulo, subtitulo, filas, colorDe, nombreCol, vacioTitulo }: { titulo: string; subtitulo: string; filas: FilaGrupoVenta[]; colorDe: (id: string) => string; nombreCol: string; vacioTitulo: string }) {
  const [modo, setModo] = useState<"total" | "volumen">("total");
  const totalMetrica = filas.reduce((s, f) => s + f[modo], 0);
  const datos = [...filas].sort((a, b) => b[modo] - a[modo]).map((f) => ({ ...f, valor: f[modo] }));
  const fmt = (v: number) => (modo === "total" ? clpCorto(v) : m3(v));
  return (
    <TarjetaGrafico
      titulo={titulo}
      subtitulo={subtitulo}
      vacio={filas.length === 0 ? { titulo: vacioTitulo } : null}
      controles={<Pestanas valor={modo} onCambiar={setModo} opciones={[{ valor: "total", etiqueta: "Ingresos" }, { valor: "volumen", etiqueta: "Volumen" }]} />}
      tabla={null}
    >
      <div role="img" aria-label={titulo}>
        <ResponsiveContainer width="100%" height={Math.max(150, datos.length * 46 + 30)}>
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 64, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRILLA} horizontal={false} />
            <XAxis type="number" tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v as number)} />
            <YAxis type="category" dataKey="nombre" tick={{ ...tick, fill: "#334155" }} tickLine={false} axisLine={false} width={96} />
            <Tooltip
              cursor={{ fill: "rgb(31 95 168 / 0.06)" }}
              content={(p) => {
                const d = p.payload?.[0]?.payload as FilaGrupoVenta | undefined;
                if (!p.active || !d) return null;
                return (
                  <CajaTooltip
                    titulo={d.nombre}
                    filas={[
                      { etiqueta: "Ventas", valor: num(d.n) },
                      { etiqueta: "Volumen vendido", valor: m3(d.volumen) },
                      { etiqueta: "Volumen entregado", valor: m3(d.entregado) },
                      { etiqueta: "Importe con IVA", valor: clp(d.total) },
                      { etiqueta: "Importe neto", valor: clp(d.neto) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={26}>
              {datos.map((d) => <Cell key={d.id} fill={colorDe(d.id)} />)}
              <LabelList dataKey="valor" position="right" formatter={(v) => fmt(Number(v))} style={{ fontSize: 11, fill: "#334155" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 overflow-x-auto border-t border-slate-100 pt-2">
        <TablaSimple
          columnas={[{ t: nombreCol }, { t: "Ventas", der: true }, { t: "m³", der: true }, { t: "Ingresos", der: true }, { t: "%", der: true }]}
          filas={datos.map((d) => [
            <span key="n" className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: colorDe(d.id) }} aria-hidden />{d.nombre}</span>,
            num(d.n),
            m3(d.volumen),
            clp(d.total),
            totalMetrica > 0 ? pct((d[modo] / totalMetrica) * 100, 1) : "—",
          ])}
        />
      </div>
    </TarjetaGrafico>
  );
}

export const GraficoVentasMaterial = (p: { filas: FilaGrupoVenta[]; colorDe: (id: string) => string }) => (
  <GraficoPorGrupo titulo="Ventas por material" subtitulo="Distribución por material. Alterna entre ingresos (con IVA) y volumen vendido." nombreCol="Material" vacioTitulo="Sin ventas de materiales en el periodo" {...p} />
);
export const GraficoVentasVendedor = (p: { filas: FilaGrupoVenta[]; colorDe: (id: string) => string }) => (
  <GraficoPorGrupo titulo="Ventas por vendedor" subtitulo="Importe o volumen vendido por vendedor; el detalle muestra el número de ventas." nombreCol="Vendedor" vacioTitulo="Sin ventas en el periodo" {...p} />
);
export const GraficoVentasCliente = (p: { filas: FilaGrupoVenta[]; colorDe: (id: string) => string }) => (
  <GraficoPorGrupo titulo="Ventas por cliente" subtitulo="Clientes con mayor facturación y frecuencia de compra en el periodo." nombreCol="Cliente" vacioTitulo="Sin ventas en el periodo" {...p} />
);

/* ------------------------------------------------------------------ */
/* 4. Eficiencia operacional                                           */
/* ------------------------------------------------------------------ */
export function GraficoEficiencia({ serie }: { serie: PuntoOperacion[] }) {
  const tot = serie.reduce(
    (a, p) => ({ vendido: a.vendido + p.vendido, entregado: a.entregado + p.entregado, viajes: a.viajes + p.viajes, fin: a.fin + p.finalizadas, pend: a.pend + p.pendientes }),
    { vendido: 0, entregado: 0, viajes: 0, fin: 0, pend: 0 },
  );
  const vacio = sinDatos(serie.map((p) => p.vendido + p.entregado + p.viajes)) ? { titulo: "Sin operación en el periodo", descripcion: "No hay ventas ni viajes con los filtros actuales." } : null;
  return (
    <TarjetaGrafico
      titulo="Eficiencia operacional"
      subtitulo="Volumen entregado (viajes válidos) frente al volumen vendido en el mismo tramo."
      vacio={vacio}
      tabla={
        <TablaSimple
          columnas={[{ t: "Periodo" }, { t: "m³ vendidos", der: true }, { t: "m³ entregados", der: true }, { t: "Viajes", der: true }, { t: "Entregas finalizadas", der: true }, { t: "Entregas pendientes", der: true }]}
          filas={serie.map((p) => [p.etiqueta, m3(p.vendido), m3(p.entregado), num(p.viajes), num(p.finalizadas), num(p.pendientes)])}
          pie={["Total", m3(tot.vendido), m3(tot.entregado), num(tot.viajes), num(tot.fin), "—"]}
        />
      }
      pie={
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          <span>Vendido: <strong className="text-slate-800">{m3(tot.vendido)}</strong></span>
          <span>Entregado: <strong className="text-slate-800">{m3(tot.entregado)}</strong></span>
          <span>Viajes: <strong className="text-slate-800">{num(tot.viajes)}</strong></span>
          <span>Entregas finalizadas: <strong className="text-slate-800">{num(tot.fin)}</strong></span>
          <span>Programadas aún pendientes: <strong className="text-slate-800">{num(tot.pend)}</strong></span>
        </span>
      }
    >
      <div role="img" aria-label="Volumen vendido y entregado por periodo">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRILLA} vertical={false} />
            <XAxis dataKey="etiqueta" tick={tick} tickLine={false} axisLine={{ stroke: GRILLA }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={44} unit=" m³" />
            <Tooltip
              cursor={{ fill: "rgb(31 95 168 / 0.06)" }}
              content={(p) => {
                const d = p.payload?.[0]?.payload as PuntoOperacion | undefined;
                if (!p.active || !d) return null;
                return (
                  <CajaTooltip
                    titulo={d.desde === d.hasta ? fecha(d.desde) : `${fecha(d.desde)} – ${fecha(d.hasta)}`}
                    filas={[
                      { etiqueta: "Entregado", valor: m3(d.entregado), color: SERIE.azul },
                      { etiqueta: "Vendido", valor: m3(d.vendido), color: SERIE.naranja },
                      { etiqueta: "Viajes", valor: num(d.viajes) },
                      { etiqueta: "Entregas finalizadas", valor: num(d.finalizadas) },
                      { etiqueta: "Entregas pendientes", valor: num(d.pendientes) },
                    ]}
                  />
                );
              }}
            />
            <Legend wrapperStyle={leyenda} />
            <Bar dataKey="entregado" name="Volumen entregado" fill={SERIE.azul} radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Line dataKey="vendido" name="Volumen vendido" stroke={SERIE.naranja} strokeWidth={2} dot={{ r: 2.5 }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafico>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Combustible y rendimiento (cuatro paneles, un eje cada uno)       */
/* ------------------------------------------------------------------ */
function MiniPanel({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 p-3">
      <p className="text-[13px] font-semibold text-navy-900">{titulo}</p>
      {nota && <p className="mb-1 text-[11px] text-slate-500">{nota}</p>}
      {children}
    </div>
  );
}

function MensajePanel({ texto }: { texto: string }) {
  return <p className="flex h-[170px] items-center justify-center px-4 text-center text-xs text-slate-500">{texto}</p>;
}

export function GraficoCombustible({ serie }: { serie: PuntoCombustible[] }) {
  const hayLitros = !sinDatos(serie.map((p) => p.litros));
  const hayKm = !sinDatos(serie.map((p) => p.km));
  const hayL100 = serie.some((p) => p.l100km != null);
  const hayLh = serie.some((p) => p.lh != null);
  const vacio = !hayLitros && !hayKm && !hayLh ? { titulo: "Sin registros de combustible ni lecturas", descripcion: "No hay despachos finalizados con estos datos en el periodo." } : null;
  const comunes = { margin: { top: 6, right: 6, left: 0, bottom: 0 } };
  const ejeX = <XAxis dataKey="etiqueta" tick={tick} tickLine={false} axisLine={{ stroke: GRILLA }} interval="preserveStartEnd" minTickGap={22} />;
  return (
    <TarjetaGrafico
      titulo="Combustible y rendimiento"
      subtitulo="Cada indicador se muestra por separado (mismas unidades). Los rendimientos excluyen registros incompletos, inconsistentes o con distancia cero."
      vacio={vacio}
      tabla={
        <TablaSimple
          columnas={[{ t: "Periodo" }, { t: "Litros consumidos", der: true }, { t: "Km (camiones)", der: true }, { t: "Horas (maquinaria)", der: true }, { t: "L/100 km", der: true }, { t: "L/h", der: true }]}
          filas={serie.map((p) => [p.etiqueta, litros(p.litros), km(p.km), horas(p.horas), p.l100km != null ? p.l100km.toFixed(1).replace(".", ",") : "Sin datos suficientes", p.lh != null ? p.lh.toFixed(1).replace(".", ",") : "Sin datos suficientes"])}
        />
      }
      pie="El combustible mostrado es el CONSUMIDO informado por el conductor en cada operación; no es el combustible cargado en estación ni se deduce del kilometraje."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <MiniPanel titulo="Litros consumidos" nota="Total registrado por periodo">
          {hayLitros ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={serie} {...comunes}>
                <CartesianGrid stroke={GRILLA} vertical={false} />
                {ejeX}
                <YAxis tick={tick} tickLine={false} axisLine={false} width={40} />
                <Tooltip cursor={{ fill: "rgb(31 95 168 / 0.06)" }} content={(p) => (p.active && p.payload?.[0] ? <CajaTooltip titulo={p.label as string} filas={[{ etiqueta: "Litros consumidos", valor: litros(p.payload[0].value as number), color: SERIE.azul }]} /> : null)} />
                <Bar dataKey="litros" fill={SERIE.azul} radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : <MensajePanel texto="Sin combustible consumido registrado." />}
        </MiniPanel>
        <MiniPanel titulo="Kilómetros recorridos (camiones)" nota="Solo lecturas válidas de kilometraje">
          {hayKm ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={serie} {...comunes}>
                <CartesianGrid stroke={GRILLA} vertical={false} />
                {ejeX}
                <YAxis tick={tick} tickLine={false} axisLine={false} width={40} />
                <Tooltip cursor={{ fill: "rgb(31 95 168 / 0.06)" }} content={(p) => (p.active && p.payload?.[0] ? <CajaTooltip titulo={p.label as string} filas={[{ etiqueta: "Kilómetros", valor: km(p.payload[0].value as number), color: SERIE.aqua }]} /> : null)} />
                <Bar dataKey="km" fill={SERIE.aqua} radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : <MensajePanel texto="Sin kilómetros válidos en el periodo." />}
        </MiniPanel>
        <MiniPanel titulo="Rendimiento de camiones (L/100 km)" nota="Menor es mejor. Solo despachos con km válidos y combustible registrado">
          {hayL100 ? (
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={serie} {...comunes}>
                <CartesianGrid stroke={GRILLA} vertical={false} />
                {ejeX}
                <YAxis tick={tick} tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} />
                <Tooltip content={(p) => (p.active && p.payload?.[0]?.value != null ? <CajaTooltip titulo={p.label as string} filas={[{ etiqueta: "L/100 km", valor: (p.payload[0].value as number).toFixed(1).replace(".", ","), color: SERIE.naranja }]} /> : null)} />
                <Line dataKey="l100km" stroke={SERIE.naranja} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          ) : <MensajePanel texto="Sin datos suficientes para calcular L/100 km en el periodo." />}
        </MiniPanel>
        <MiniPanel titulo="Consumo de maquinaria (L/h)" nota="Equipos con horómetro. Solo horas válidas y combustible registrado">
          {hayLh ? (
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={serie} {...comunes}>
                <CartesianGrid stroke={GRILLA} vertical={false} />
                {ejeX}
                <YAxis tick={tick} tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} />
                <Tooltip content={(p) => (p.active && p.payload?.[0]?.value != null ? <CajaTooltip titulo={p.label as string} filas={[{ etiqueta: "L/h", valor: (p.payload[0].value as number).toFixed(1).replace(".", ","), color: SERIE.violeta }]} /> : null)} />
                <Line dataKey="lh" stroke={SERIE.violeta} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          ) : <MensajePanel texto="Sin datos suficientes para calcular L/h en el periodo." />}
        </MiniPanel>
      </div>
    </TarjetaGrafico>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Actividad de la flota                                            */
/* ------------------------------------------------------------------ */
type MetricaFlota = "viajes" | "volumen" | "litros" | "km" | "horas";
const METRICAS: Record<MetricaFlota, { etiqueta: string; fmt: (n: number) => string; valor: (a: ActividadVehiculo) => number | null }> = {
  viajes: { etiqueta: "Viajes", fmt: num, valor: (a) => a.viajes },
  volumen: { etiqueta: "Volumen m³", fmt: (n) => m3(n), valor: (a) => a.volumen },
  litros: { etiqueta: "Litros", fmt: (n) => litros(n), valor: (a) => a.litros },
  km: { etiqueta: "Kilómetros", fmt: (n) => km(n), valor: (a) => (a.medidor === "km" ? a.km : null) },
  horas: { etiqueta: "Horas", fmt: (n) => horas(n), valor: (a) => (a.medidor === "horas" ? a.horas : null) },
};

export function GraficoFlota({ filas }: { filas: ActividadVehiculo[] }) {
  const [metrica, setMetrica] = useState<MetricaFlota>("viajes");
  const m = METRICAS[metrica];
  const datos = filas
    .map((a) => ({ ...a, valor: m.valor(a) }))
    .filter((a) => a.valor != null)
    .sort((a, b) => (b.valor as number) - (a.valor as number));
  const max = datos[0]?.valor ?? 0;
  const vacio = filas.every((a) => !a.despachos && !a.viajes) ? { titulo: "Sin actividad de flota en el periodo" } : null;
  const f1 = (n: number | null) => (n == null ? "Sin datos suficientes" : n.toFixed(1).replace(".", ","));
  return (
    <TarjetaGrafico
      titulo="Actividad de la flota"
      subtitulo="Entregas y viajes por vehículo, con kilómetros u horas y combustible. Cambia la métrica para comparar."
      vacio={vacio}
      controles={<Pestanas valor={metrica} onCambiar={setMetrica} opciones={(Object.keys(METRICAS) as MetricaFlota[]).map((k) => ({ valor: k, etiqueta: METRICAS[k].etiqueta }))} className="max-w-[16rem] sm:max-w-none" />}
      tabla={
        <TablaSimple
          columnas={[{ t: "Vehículo" }, { t: "Entregas", der: true }, { t: "Viajes", der: true }, { t: "m³", der: true }, { t: "Km / horas", der: true }, { t: "Litros", der: true }, { t: "Rendimiento", der: true }]}
          filas={filas.map((a) => [a.codigo, num(a.despachos), num(a.viajes), m3(a.volumen), a.medidor === "km" ? km(a.km) : horas(a.horas), litros(a.litros), a.medidor === "km" ? `${f1(a.l100km)}${a.l100km != null ? " L/100 km" : ""}` : `${f1(a.lh)}${a.lh != null ? " L/h" : ""}`])}
        />
      }
    >
      {datos.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Ningún vehículo registra esta métrica en el periodo ({m.etiqueta.toLowerCase()} aplica solo a {metrica === "km" ? "camiones" : metrica === "horas" ? "maquinaria con horómetro" : "la flota"}).</p>
      ) : (
        <div role="img" aria-label={`Actividad de la flota: ${m.etiqueta}`}>
          <ResponsiveContainer width="100%" height={Math.max(160, datos.length * 40 + 24)}>
            <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 70, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRILLA} horizontal={false} />
              <XAxis type="number" tick={tick} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="codigo" tick={{ ...tick, fill: "#334155" }} tickLine={false} axisLine={false} width={64} />
              <Tooltip
                cursor={{ fill: "rgb(31 95 168 / 0.06)" }}
                content={(p) => {
                  const d = p.payload?.[0]?.payload as ActividadVehiculo | undefined;
                  if (!p.active || !d) return null;
                  return (
                    <CajaTooltip
                      titulo={d.codigo}
                      filas={[
                        { etiqueta: "Entregas", valor: num(d.despachos) },
                        { etiqueta: "Viajes", valor: num(d.viajes) },
                        { etiqueta: "Volumen", valor: m3(d.volumen) },
                        { etiqueta: d.medidor === "km" ? "Kilómetros" : "Horas", valor: d.medidor === "km" ? km(d.km) : horas(d.horas) },
                        { etiqueta: "Litros consumidos", valor: litros(d.litros) },
                        { etiqueta: d.medidor === "km" ? "L/100 km" : "L/h", valor: f1(d.medidor === "km" ? d.l100km : d.lh) },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {datos.map((d, i) => <Cell key={d.vehiculoId} fill={d.tipo === "camion" ? SERIE.azul : SERIE.violeta} fillOpacity={i === 0 ? 1 : 0.85} />)}
                <LabelList dataKey="valor" position="right" formatter={(v) => m.fmt(Number(v))} style={{ fontSize: 11, fill: "#334155" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIE.azul }} aria-hidden />Camiones</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIE.violeta }} aria-hidden />Maquinaria</span>
            {max > 0 && datos[0] && <Insignia tono="naranja">Mayor actividad: {datos[0].codigo}</Insignia>}
          </div>
        </div>
      )}
    </TarjetaGrafico>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Cuentas por cobrar                                               */
/* ------------------------------------------------------------------ */
export function GraficoCobranza({ res }: { res: ResumenCobranza }) {
  const vacio = res.facturado === 0 ? { titulo: "Sin ventas facturadas en el periodo" } : null;
  const partes = [
    { clave: "pagado", etiqueta: "Cobrado (abonos aplicados)", monto: res.pagado, n: null as number | null, color: COBRANZA.pagado },
    { clave: "parcial", etiqueta: "Saldo de ventas con pago parcial", monto: res.parcial.monto, n: res.parcial.n, color: COBRANZA.parcial },
    { clave: "pendiente", etiqueta: "Saldo pendiente de pago", monto: res.pendiente.monto, n: res.pendiente.n, color: COBRANZA.pendiente },
    { clave: "vencido", etiqueta: "Saldo vencido", monto: res.vencido.monto, n: res.vencido.n, color: COBRANZA.vencido },
  ];
  const fila = [{ nombre: "Cartera", pagado: res.pagado, parcial: res.parcial.monto, pendiente: res.pendiente.monto, vencido: res.vencido.monto }];
  return (
    <TarjetaGrafico
      titulo="Cuentas por cobrar"
      subtitulo="Facturado del periodo repartido entre lo cobrado y los saldos según su estado de pago."
      vacio={vacio}
      pie="Los importes son registros internos de la demostración con IVA; no son documentos tributarios electrónicos."
    >
      <div role="img" aria-label="Distribución de la cartera: cobrado, pago parcial, pendiente y vencido">
        <ResponsiveContainer width="100%" height={96}>
          <BarChart data={fila} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="nombre" hide />
            <Tooltip
              cursor={false}
              content={(p) =>
                p.active ? (
                  <CajaTooltip titulo="Cartera del periodo" filas={partes.map((x) => ({ etiqueta: x.etiqueta, valor: clp(x.monto), color: x.color }))} />
                ) : null
              }
            />
            {partes.map((x, i) => (
              <Bar key={x.clave} dataKey={x.clave} stackId="c" fill={x.color} stroke="#ffffff" strokeWidth={2} radius={i === 0 ? [6, 0, 0, 6] : i === partes.length - 1 ? [0, 6, 6, 0] : 0} maxBarSize={44} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mb-3 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {partes.map((x) => <li key={x.clave} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: x.color }} aria-hidden />{x.etiqueta}</li>)}
      </ul>
      <TablaSimple
        columnas={[{ t: "Concepto" }, { t: "Ventas", der: true }, { t: "Importe", der: true }, { t: "% facturado", der: true }]}
        filas={[
          [<strong key="a">Facturado (con IVA)</strong>, "—", <strong key="b">{clp(res.facturado)}</strong>, "100 %"],
          [<span key="n" className="pl-3 text-slate-600">Importe neto</span>, "—", clp(res.facturadoNeto), pct(res.facturado ? (res.facturadoNeto / res.facturado) * 100 : 0, 1)],
          [<span key="i" className="pl-3 text-slate-600">IVA</span>, "—", clp(res.iva), pct(res.facturado ? (res.iva / res.facturado) * 100 : 0, 1)],
          ...partes.map((x) => [x.etiqueta, x.n != null ? num(x.n) : `${num(res.pagadasN)} pagadas`, clp(x.monto), pct(res.facturado ? (x.monto / res.facturado) * 100 : 0, 1)]),
          [<strong key="s">Saldo total por cobrar</strong>, num(res.pendiente.n + res.parcial.n + res.vencido.n), <strong key="t">{clp(res.saldoTotal)}</strong>, pct(res.facturado ? (res.saldoTotal / res.facturado) * 100 : 0, 1)],
        ]}
      />
    </TarjetaGrafico>
  );
}

export { colorCategoria };

/* ------------------------------------------------------------------ */
/* Barras horizontales genéricas (una métrica, una unidad)               */
/* ------------------------------------------------------------------ */
export interface DatoBarra {
  id: string;
  nombre: string;
  valor: number;
  detalle?: { etiqueta: string; valor: string }[];
}

export function GraficoBarrasSimple({ titulo, subtitulo, datos, formato, color = SERIE.azul, vacio, pie, nombreCol = "Elemento", etiquetaValor = "Valor" }: {
  titulo: string;
  subtitulo?: string;
  datos: DatoBarra[];
  formato: (n: number) => string;
  color?: string;
  vacio: string;
  pie?: string;
  nombreCol?: string;
  etiquetaValor?: string;
}) {
  const ordenados = [...datos].sort((a, b) => b.valor - a.valor);
  return (
    <TarjetaGrafico
      titulo={titulo}
      subtitulo={subtitulo}
      vacio={ordenados.length === 0 ? { titulo: vacio } : null}
      pie={pie}
      tabla={<TablaSimple columnas={[{ t: nombreCol }, { t: etiquetaValor, der: true }]} filas={ordenados.map((d) => [d.nombre, formato(d.valor)])} />}
    >
      <div role="img" aria-label={titulo}>
        <ResponsiveContainer width="100%" height={Math.max(130, ordenados.length * 38 + 24)}>
          <BarChart data={ordenados} layout="vertical" margin={{ top: 4, right: 70, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRILLA} horizontal={false} />
            <XAxis type="number" tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => formato(v as number)} />
            <YAxis type="category" dataKey="nombre" tick={{ ...tick, fill: "#334155" }} tickLine={false} axisLine={false} width={110} />
            <Tooltip
              cursor={{ fill: "rgb(31 95 168 / 0.06)" }}
              content={(p) => {
                const d = p.payload?.[0]?.payload as DatoBarra | undefined;
                if (!p.active || !d) return null;
                return <CajaTooltip titulo={d.nombre} filas={[{ etiqueta: etiquetaValor, valor: formato(d.valor), color }, ...(d.detalle ?? [])]} />;
              }}
            />
            <Bar dataKey="valor" fill={color} radius={[0, 4, 4, 0]} maxBarSize={24}>
              <LabelList dataKey="valor" position="right" formatter={(v) => formato(Number(v))} style={{ fontSize: 11, fill: "#334155" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafico>
  );
}
