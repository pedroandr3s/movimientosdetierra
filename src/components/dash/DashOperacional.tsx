"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  actividadConductores, destinoDespacho, despachosEnPeriodo, estadoComercialVenta, nombreDe, pasaFiltrosDespacho, pasaFiltrosVenta, redondear, serieOperacion,
  viajesDeDespacho, viajesEnPeriodo, volumenEntregadoDespacho, ventaValida,
} from "@/lib/calc";
import { ETIQUETAS, type Despacho } from "@/lib/types";
import { fecha, m3, num } from "@/lib/formato";
import { Tarjeta, EncabezadoTarjeta, EnlaceBoton } from "@/components/ui/base";
import { EncabezadoPagina, TablaDatos, TarjetaKpi, type Columna } from "@/components/ui/datos";
import { BadgeDespacho, BadgeVehiculo } from "@/components/Estados";
import { AlertTriangleIcon, CalendarCheck, CircleCheck, Clock, Play, Route, Truck } from "./iconos-dash";
import { FiltrosGlobales } from "./FiltrosGlobales";
import { useAnalisis } from "./useAnalisis";
import { GraficoBarrasSimple, GraficoEficiencia } from "./graficos";
import { SERIE } from "./colores";

const ico = "size-[18px]";

export function DashOperacional() {
  const a = useAnalisis();
  const router = useRouter();
  const { data, f, r, hoy, kpis } = a;

  const ds = useMemo(() => despachosEnPeriodo(data, f, r), [data, f, r]);
  const viajes = useMemo(() => viajesEnPeriodo(data, f, r), [data, f, r]);
  const sOper = useMemo(() => serieOperacion(data, f, r), [data, f, r]);
  const conductores = useMemo(() => actividadConductores(data, f, r), [data, f, r]);

  // Estado "ahora" (independiente del periodo, respeta los demás filtros)
  const vivos = useMemo(() => data.despachos.filter((d) => d.estado !== "anulado" && pasaFiltrosDespacho(data, d, { ...f, estadoDespacho: undefined })), [data, f]);
  const programadasHoy = vivos.filter((d) => d.estado === "programado" && d.fecha === hoy).length;
  const enCurso = vivos.filter((d) => d.estado === "en_curso").length;
  const incidencias = vivos.filter((d) => d.estado === "incidencia").length;
  const finalizadas = ds.filter((d) => d.estado === "finalizado").length;
  const parciales = data.ventas.filter((v) => ventaValida(v) && pasaFiltrosVenta(data, v, f) && estadoComercialVenta(data, v) === "parcial").length;

  const porMaterial = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of viajes) m.set(v.materialId ?? "", (m.get(v.materialId ?? "") ?? 0) + v.cantidadM3);
    return [...m.entries()].map(([id, valor]) => ({ id: id || "sin", nombre: id ? nombreDe.material(data, id) : "Sin material", valor: redondear(valor) }));
  }, [viajes, data]);
  const porFaena = useMemo(() => {
    const m = new Map<string, { valor: number; n: number }>();
    for (const v of viajes) {
      const k = v.destino || "Sin destino";
      const x = m.get(k) ?? { valor: 0, n: 0 };
      x.valor += v.cantidadM3;
      x.n += 1;
      m.set(k, x);
    }
    return [...m.entries()].map(([nombre, x]) => ({ id: nombre, nombre, valor: redondear(x.valor), detalle: [{ etiqueta: "Viajes", valor: num(x.n) }] }));
  }, [viajes]);

  const flota = useMemo(() => {
    const asignadosHoy = new Set(data.despachos.filter((d) => d.fecha === hoy && (d.estado === "programado" || d.estado === "en_curso")).map((d) => d.vehiculoId));
    return data.vehiculos.map((v) => ({ v, asignado: asignadosHoy.has(v.id) }));
  }, [data, hoy]);

  const cols: Columna<Despacho>[] = [
    { clave: "numero", titulo: "Despacho", celda: (d) => <span className="font-medium text-brand-700">{d.numero}</span>, orden: (d) => d.numero },
    { clave: "fecha", titulo: "Fecha", celda: (d) => fecha(d.fecha), orden: (d) => d.fecha },
    { clave: "destino", titulo: "Destino", celda: (d) => <span className="block max-w-[14rem] truncate">{destinoDespacho(data, d)}</span>, orden: (d) => destinoDespacho(data, d) },
    { clave: "veh", titulo: "Vehículo", celda: (d) => nombreDe.vehiculo(data, d.vehiculoId), orden: (d) => nombreDe.vehiculo(data, d.vehiculoId), ocultarEnMovil: true },
    { clave: "cond", titulo: "Conductor", celda: (d) => nombreDe.usuario(data, d.conductorId), orden: (d) => nombreDe.usuario(data, d.conductorId), ocultarEnMovil: true },
    { clave: "mat", titulo: "Material", celda: (d) => nombreDe.material(data, d.materialId ?? (d.ventaId ? data.ventas.find((v) => v.id === d.ventaId)?.materialId : undefined)), ocultarEnMovil: true },
    { clave: "sol", titulo: "Solicitado", alinear: "der", celda: (d) => m3(d.volumenSolicitadoM3), orden: (d) => d.volumenSolicitadoM3 },
    { clave: "ent", titulo: "Entregado", alinear: "der", celda: (d) => m3(volumenEntregadoDespacho(data, d.id)), orden: (d) => volumenEntregadoDespacho(data, d.id) },
    { clave: "viajes", titulo: "Viajes", alinear: "der", celda: (d) => `${viajesDeDespacho(data, d.id).length} / ${d.viajesPlanificados}`, orden: (d) => viajesDeDespacho(data, d.id).length },
    { clave: "estado", titulo: "Estado", celda: (d) => <BadgeDespacho estado={d.estado} />, orden: (d) => ETIQUETAS.estadoDespacho[d.estado] },
  ];

  return (
    <>
      <EncabezadoPagina titulo="Dashboard operacional" descripcion="Ejecución diaria: entregas, viajes, camiones y actividad por conductor y destino." acciones={<EnlaceBoton href="/despachos/nuevo" variante="acento"><Truck className="size-4" aria-hidden /> Programar despacho</EnlaceBoton>} />
      <FiltrosGlobales dimensiones={["vendedor", "cliente", "material", "faena", "conductor", "vehiculo", "estadoDespacho"]} />

      <section aria-label="Estado de las entregas" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <TarjetaKpi destacado icono={<CalendarCheck className={ico} />} titulo="Programadas para hoy" valor={num(programadasHoy)} sinComparacion detalle="Fecha de hoy, aún sin iniciar" />
        <TarjetaKpi icono={<Play className={ico} />} titulo="En curso" valor={num(enCurso)} sinComparacion detalle="Entregas iniciadas ahora" />
        <TarjetaKpi icono={<CircleCheck className={ico} />} titulo="Finalizadas (periodo)" valor={num(finalizadas)} sinComparacion />
        <TarjetaKpi icono={<Clock className={ico} />} titulo="Parciales" valor={num(parciales)} sinComparacion detalle="Ventas con entrega incompleta" />
        <TarjetaKpi icono={<Clock className={ico} />} titulo="Pendientes" valor={num(kpis.entregasPendientes)} sinComparacion menorEsMejor detalle="Programadas, en curso o incidencia" />
        <TarjetaKpi icono={<AlertTriangleIcon className={ico} />} titulo="Con incidencia" valor={num(incidencias)} sinComparacion menorEsMejor />
        <TarjetaKpi icono={<Route className={ico} />} titulo="Viajes realizados" valor={num(viajes.length)} sinComparacion detalle={<>{m3(kpis.volumenEntregado)} entregados</>} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><GraficoEficiencia serie={sOper} /></div>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Camiones y maquinaria" subtitulo="Estado operativo actual y asignación de hoy" />
          <ul className="divide-y divide-slate-100">
            {flota.map(({ v, asignado }) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{v.codigo}{v.patente ? ` · ${v.patente}` : ""}</span>
                  <span className="block text-xs text-slate-500">{asignado ? "Asignado hoy" : v.estado === "disponible" ? "Libre" : ETIQUETAS.estadoVehiculo[v.estado]}</span>
                </span>
                <BadgeVehiculo estado={v.estado} />
              </li>
            ))}
          </ul>
        </Tarjeta>
        <GraficoBarrasSimple titulo="Volumen entregado por material" subtitulo="Suma de viajes válidos del periodo" datos={porMaterial} formato={(n) => m3(n)} vacio="Sin viajes en el periodo" nombreCol="Material" etiquetaValor="m³ entregados" />
        <GraficoBarrasSimple titulo="Actividad por conductor" subtitulo="Volumen entregado; el detalle muestra entregas y viajes" datos={conductores.filter((c) => c.viajes > 0 || c.despachos > 0).map((c) => ({ id: c.conductorId, nombre: c.nombre, valor: c.volumen, detalle: [{ etiqueta: "Entregas", valor: num(c.despachos) }, { etiqueta: "Viajes", valor: num(c.viajes) }] }))} formato={(n) => m3(n)} vacio="Sin actividad de conductores" color={SERIE.naranja} nombreCol="Conductor" etiquetaValor="m³ entregados" />
        <GraficoBarrasSimple titulo="Actividad por faena o destino" subtitulo="Volumen entregado según el destino de cada viaje" datos={porFaena} formato={(n) => m3(n)} vacio="Sin viajes en el periodo" color={SERIE.aqua} nombreCol="Destino" etiquetaValor="m³ entregados" />
      </div>

      <Tarjeta className="mt-5">
        <EncabezadoTarjeta titulo="Despachos del periodo" subtitulo="Abre un despacho para ver su venta, camión, conductor, viajes individuales y registro operacional." />
        <TablaDatos columnas={cols} filas={ds} clave={(d) => d.id} alHacerClic={(d) => router.push(`/despachos/${d.id}`)} ordenInicial={{ clave: "fecha", dir: "desc" }} tamanoPagina={12} ariaEtiqueta="Despachos del periodo" />
      </Tarjeta>
    </>
  );
}
