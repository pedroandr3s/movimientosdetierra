"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generarAlertas, type Alerta, type TipoAlerta } from "@/lib/alertas";
import {
  destinoDespacho, estadoComercialVenta, nombreDe, totalesVenta, variacionPct, volumenEntregadoDespacho,
} from "@/lib/calc";
import { clp, fecha, indicador, km, litros, m3, num, horas } from "@/lib/formato";
import { Tarjeta, EncabezadoTarjeta, Insignia } from "@/components/ui/base";
import { EstadoVacio, Pestanas, TarjetaKpi } from "@/components/ui/datos";
import { BadgeComercial, BadgeDespacho } from "@/components/Estados";
import { cn } from "@/components/ui/cn";
import {
  Banknote, CalendarCheck, ChevronRight, CircleCheck, Droplets, FileBarChart, Fuel, Gauge, Package, Plus, Receipt, Route, Truck, TriangleAlert, ClipboardList, Users,
} from "@/components/ui/icons";
import type { Analisis } from "./useAnalisis";

const ico = "size-[18px]";

/* ---------------- 10 indicadores del dashboard general ---------------- */
export function GrillaKpisGenerales({ a }: { a: Analisis }) {
  const { kpis: k, previos: p } = a;
  const consumo = k.l100km;
  const consumoPrev = p.l100km;
  return (
    <section aria-label="Indicadores principales" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <TarjetaKpi destacado icono={<Receipt className={ico} />} titulo="Ventas totales (con IVA)" valor={clp(k.ventasTotal)} variacion={variacionPct(k.ventasTotal, p.ventasTotal)} detalle={<>Neto {clp(k.ventasNeto)} · IVA {clp(k.ventasIva)}</>} />
      <TarjetaKpi icono={<ClipboardList className={ico} />} titulo="Ventas registradas" valor={num(k.nVentas)} variacion={variacionPct(k.nVentas, p.nVentas)} detalle="Ventas confirmadas (sin anuladas ni borradores)" />
      <TarjetaKpi icono={<Package className={ico} />} titulo="Volumen vendido" valor={m3(k.volumenVendido)} variacion={variacionPct(k.volumenVendido, p.volumenVendido)} detalle="Cantidad de ventas válidas" />
      <TarjetaKpi icono={<Truck className={ico} />} titulo="Volumen entregado" valor={m3(k.volumenEntregado)} variacion={variacionPct(k.volumenEntregado, p.volumenEntregado)} detalle="Suma de viajes válidos del periodo" />
      <TarjetaKpi icono={<CalendarCheck className={ico} />} titulo="Entregas pendientes" valor={num(k.entregasPendientes)} variacion={variacionPct(k.entregasPendientes, p.entregasPendientes)} menorEsMejor detalle="Programadas, en curso o con incidencia" href="/despachos" />
      <TarjetaKpi icono={<Banknote className={ico} />} titulo="Ventas pendientes de pago" valor={clp(k.ventasPendientesPagoMonto)} variacion={variacionPct(k.ventasPendientesPagoMonto, p.ventasPendientesPagoMonto)} menorEsMejor detalle={<>{num(k.ventasPendientesPagoCount)} ventas con saldo (saldo actual)</>} href="/ventas?pago=pendiente" />
      <TarjetaKpi neutral icono={<Fuel className={ico} />} titulo="Combustible consumido" valor={litros(k.combustibleConsumido)} variacion={variacionPct(k.combustibleConsumido, p.combustibleConsumido)} detalle="Consumo informado en operaciones" />
      <TarjetaKpi neutral icono={<Route className={ico} />} titulo="Kilómetros de la flota" valor={km(k.kmFlota)} variacion={variacionPct(k.kmFlota, p.kmFlota)} detalle={<>Maquinaria: {horas(k.horasMaquinaria)} de horómetro</>} />
      <TarjetaKpi icono={<Gauge className={ico} />} titulo="Consumo promedio de camiones" valor={indicador(consumo, (v) => `${v.toFixed(1).replace(".", ",")} L/100 km`)} variacion={variacionPct(consumo, consumoPrev)} menorEsMejor detalle={<>Maquinaria: {indicador(k.lh, (v) => `${v.toFixed(1).replace(".", ",")} L/h`)}</>} />
      <TarjetaKpi destacado icono={<CircleCheck className={ico} />} titulo="Ingreso cobrado" valor={clp(k.cobrado)} variacion={variacionPct(k.cobrado, p.cobrado)} detalle="Pagos registrados con fecha en el periodo" />
    </section>
  );
}

/* ---------------- Alertas derivadas de los datos ---------------- */
type FiltroAlerta = "todas" | "retraso" | "revision" | "incompleto" | "sin_validar" | "otras";

const GRUPOS: Record<FiltroAlerta, { etiqueta: string; tipos?: TipoAlerta[] }> = {
  todas: { etiqueta: "Todas" },
  retraso: { etiqueta: "Entregas retrasadas", tipos: ["retraso", "incidencia"] },
  revision: { etiqueta: "Vehículos a revisar", tipos: ["revision"] },
  incompleto: { etiqueta: "Información incompleta", tipos: ["incompleto", "lectura"] },
  sin_validar: { etiqueta: "Sin validar", tipos: ["sin_validar"] },
  otras: { etiqueta: "Otras", tipos: ["pendiente", "consumo", "cobranza", "exceso"] },
};

export function BloqueAlertas({ a, soloVendedor }: { a: Analisis; soloVendedor?: boolean }) {
  const [filtro, setFiltro] = useState<FiltroAlerta>("todas");
  const [todas, setTodas] = useState(false);
  const alertas = useMemo(() => {
    const l = generarAlertas(a.data, a.hoy);
    return soloVendedor ? l.filter((x) => x.tipo === "pendiente" || x.tipo === "cobranza") : l;
  }, [a.data, a.hoy, soloVendedor]);
  const conteo = (f: FiltroAlerta) => (GRUPOS[f].tipos ? alertas.filter((x) => GRUPOS[f].tipos!.includes(x.tipo)).length : alertas.length);
  const visibles = alertas.filter((x) => !GRUPOS[filtro].tipos || GRUPOS[filtro].tipos!.includes(x.tipo));
  const lista = todas ? visibles : visibles.slice(0, 6);
  const opciones = (Object.keys(GRUPOS) as FiltroAlerta[]).filter((f) => !soloVendedor || f === "todas").map((f) => ({ valor: f, etiqueta: GRUPOS[f].etiqueta, conteo: conteo(f) }));
  const tono = (x: Alerta) => (x.severidad === "alta" ? "text-red-600 bg-red-50" : x.severidad === "media" ? "text-amber-700 bg-amber-50" : "text-slate-600 bg-slate-100");
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Alertas operacionales" subtitulo="Calculadas con los datos actuales; los umbrales son parámetros de demostración configurables." />
      <div className="space-y-3 p-3 sm:p-4">
        {opciones.length > 1 && <Pestanas valor={filtro} onCambiar={(v) => { setFiltro(v); setTodas(false); }} opciones={opciones} />}
        {visibles.length === 0 ? (
          <EstadoVacio icono={<CircleCheck className="size-6" />} titulo="Sin alertas en esta categoría" descripcion="Todo está al día según los datos disponibles." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.map((x) => (
              <li key={x.id}>
                <Link href={x.href ?? "#"} className="group flex items-start gap-3 py-2.5 hover:bg-slate-50">
                  <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", tono(x))}><TriangleAlert className="size-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{x.titulo}</span>
                    <span className="block text-xs text-slate-600">{x.detalle}</span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-slate-400 group-hover:text-brand-600" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {visibles.length > 6 && (
          <button type="button" onClick={() => setTodas((v) => !v)} className="text-xs font-medium text-brand-600 hover:underline">
            {todas ? "Ver menos" : `Ver las ${visibles.length} alertas`}
          </button>
        )}
      </div>
    </Tarjeta>
  );
}

/* ---------------- Últimas ventas / entregas ---------------- */
export function UltimasVentas({ a, vendedorId }: { a: Analisis; vendedorId?: string }) {
  const router = useRouter();
  const ventas = useMemo(
    () => a.data.ventas.filter((v) => v.estado !== "borrador" && (!vendedorId || v.vendedorId === vendedorId)).sort((x, y) => (y.creadoEn + y.numero).localeCompare(x.creadoEn + x.numero)).slice(0, 6),
    [a.data, vendedorId],
  );
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Últimas ventas" acciones={<Link href="/ventas" className="text-xs font-medium text-brand-600 hover:underline">Ver todas</Link>} />
      {ventas.length === 0 ? <EstadoVacio titulo="Aún no hay ventas" /> : (
        <ul className="divide-y divide-slate-100">
          {ventas.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => router.push(`/ventas/${v.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">{v.numero} · {nombreDe.cliente(a.data, v.clienteId)}</span>
                  <span className="block text-xs text-slate-500">{fecha(v.fecha)} · {m3(v.cantidadM3)} de {nombreDe.material(a.data, v.materialId)}</span>
                </span>
                <span className="text-right">
                  <span className="tabular block text-sm font-semibold text-navy-900">{clp(totalesVenta(v).total)}</span>
                  <BadgeComercial estado={estadoComercialVenta(a.data, v)} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

export function UltimasEntregas({ a, vendedorId }: { a: Analisis; vendedorId?: string }) {
  const router = useRouter();
  const lista = useMemo(
    () =>
      a.data.despachos
        .filter((d) => d.estado !== "anulado" && (!vendedorId || (d.ventaId && a.data.ventas.find((v) => v.id === d.ventaId)?.vendedorId === vendedorId)))
        .sort((x, y) => (y.fecha + y.numero).localeCompare(x.fecha + x.numero))
        .slice(0, 6),
    [a.data, vendedorId],
  );
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Últimas entregas" acciones={<Link href="/despachos" className="text-xs font-medium text-brand-600 hover:underline">Ver todas</Link>} />
      {lista.length === 0 ? <EstadoVacio titulo="Aún no hay entregas" /> : (
        <ul className="divide-y divide-slate-100">
          {lista.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => router.push(`/despachos/${d.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">{d.numero} · {destinoDespacho(a.data, d)}</span>
                  <span className="block text-xs text-slate-500">{fecha(d.fecha)} · {nombreDe.vehiculo(a.data, d.vehiculoId)} · {nombreDe.usuario(a.data, d.conductorId)}</span>
                </span>
                <span className="text-right">
                  <span className="tabular block text-sm font-semibold text-navy-900">{m3(volumenEntregadoDespacho(a.data, d.id))}</span>
                  <BadgeDespacho estado={d.estado} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/* ---------------- Accesos rápidos ---------------- */
export function AccesosRapidos({ items }: { items: { href: string; etiqueta: string; descripcion: string; icono: "venta" | "despacho" | "reporte" | "clientes" | "flota" }[] }) {
  const iconos = { venta: Plus, despacho: Truck, reporte: FileBarChart, clientes: Users, flota: Droplets };
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Accesos rápidos" />
      <ul className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-1 xl:grid-cols-2">
        {items.map((i) => {
          const I = iconos[i.icono];
          return (
            <li key={i.href + i.etiqueta}>
              <Link href={i.href} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/50">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600"><I className="size-[18px]" aria-hidden /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-navy-900">{i.etiqueta}</span>
                  <span className="block text-xs text-slate-500">{i.descripcion}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}

export { Insignia };
