"use client";
import { useMemo } from "react";
import { actividadFlota, enRango, nombreDe, serieCombustible, trabajoDespacho, despachosEnPeriodo, type ActividadVehiculo } from "@/lib/calc";
import { diffDays } from "@/lib/fecha";
import { ETIQUETAS, type Vehiculo } from "@/lib/types";
import { fecha, horas, km, litros, m3, num } from "@/lib/formato";
import { Insignia, Tarjeta, EncabezadoTarjeta } from "@/components/ui/base";
import { EncabezadoPagina, TablaDatos, TarjetaKpi, type Columna, AvisoPagina } from "@/components/ui/datos";
import { BadgeVehiculo } from "@/components/Estados";
import { Droplets, Fuel, Gauge, Route } from "@/components/ui/icons";
import { FiltrosGlobales } from "./FiltrosGlobales";
import { useAnalisis } from "./useAnalisis";
import { GraficoBarrasSimple, GraficoCombustible, GraficoFlota } from "./graficos";
import { TablaSimple } from "./Tarjeta-grafico";
import { SERIE } from "./colores";

const ico = "size-[18px]";
const f1 = (n: number) => n.toFixed(1).replace(".", ",");

interface Fila extends ActividadVehiculo {
  veh: Vehiculo;
  lecturas: number;
  incidencias: number;
}

export function DashFlota() {
  const a = useAnalisis();
  const { data, f, r, hoy, kpis } = a;
  const u = data.config.umbrales;

  const filas: Fila[] = useMemo(() => {
    const ds = despachosEnPeriodo(data, f, r);
    return actividadFlota(data, f, r).map((x) => {
      const veh = data.vehiculos.find((v) => v.id === x.vehiculoId)!;
      const propios = ds.filter((d) => d.vehiculoId === x.vehiculoId);
      return {
        ...x,
        veh,
        lecturas: propios.filter((d) => ["anomala", "inconsistente"].includes(trabajoDespacho(data, d).motivo ?? "")).length,
        incidencias: propios.filter((d) => d.estado === "incidencia").length,
      };
    });
  }, [data, f, r]);
  const sComb = useMemo(() => serieCombustible(data, f, r), [data, f, r]);
  const planas = useMemo(() => actividadFlota(data, f, r), [data, f, r]);

  const cargadoPeriodo = useMemo(
    () => data.cargas.filter((c) => enRango(c.fecha, r) && (!f.vehiculoId || c.vehiculoId === f.vehiculoId) && (!f.conductorId || c.conductorId === f.conductorId)).reduce((s, c) => s + c.litros, 0),
    [data, f, r],
  );
  const insumos = useMemo(() => {
    const m = new Map<string, { n: number; cantidad: Map<string, number> }>();
    for (const i of data.insumos.filter((x) => enRango(x.fecha, r) && (!f.vehiculoId || x.vehiculoId === f.vehiculoId))) {
      const e = m.get(i.tipo) ?? { n: 0, cantidad: new Map() };
      e.n += 1;
      e.cantidad.set(i.unidad, (e.cantidad.get(i.unidad) ?? 0) + i.cantidad);
      m.set(i.tipo, e);
    }
    return [...m.entries()];
  }, [data, f, r]);

  const revision = (v: Vehiculo) => {
    if (!v.proximaRevision) return <span className="text-slate-400">No configurada</span>;
    const dias = diffDays(hoy, v.proximaRevision);
    if (dias < 0) return <Insignia tono="rojo">Vencida hace {-dias} d</Insignia>;
    if (dias <= u.diasAvisoRevision) return <Insignia tono="amarillo">En {dias} d · {fecha(v.proximaRevision)}</Insignia>;
    return <span>{fecha(v.proximaRevision)}</span>;
  };

  const cols: Columna<Fila>[] = [
    { clave: "veh", titulo: "Vehículo", celda: (x) => <span><span className="font-medium text-slate-900">{x.codigo}</span><span className="block text-xs text-slate-500">{x.veh.patente ?? "Sin patente"} · {x.veh.marca ?? ""} {x.veh.modelo ?? ""}</span></span>, orden: (x) => x.codigo },
    { clave: "tipo", titulo: "Tipo", celda: (x) => ETIQUETAS.tipoVehiculo[x.tipo], ocultarEnMovil: true },
    { clave: "cap", titulo: "Capacidad", alinear: "der", celda: (x) => (x.veh.capacidadM3 ? m3(x.veh.capacidadM3, 0) : "—"), orden: (x) => x.veh.capacidadM3 ?? 0 },
    { clave: "cond", titulo: "Conductor habitual", celda: (x) => nombreDe.usuario(data, x.veh.conductorHabitualId), ocultarEnMovil: true },
    { clave: "est", titulo: "Estado", celda: (x) => <BadgeVehiculo estado={x.veh.estado} /> },
    { clave: "lect", titulo: "Lectura registrada", alinear: "der", celda: (x) => (x.medidor === "km" ? km(x.veh.lecturaActual) : horas(x.veh.lecturaActual)), orden: (x) => x.veh.lecturaActual },
    { clave: "trab", titulo: "Trabajo del periodo", alinear: "der", celda: (x) => (x.medidor === "km" ? km(x.km) : horas(x.horas)), orden: (x) => (x.medidor === "km" ? x.km : x.horas) },
    { clave: "lit", titulo: "Litros", alinear: "der", celda: (x) => litros(x.litros), orden: (x) => x.litros },
    { clave: "rend", titulo: "Rendimiento", alinear: "der", celda: (x) => { const v = x.medidor === "km" ? x.l100km : x.lh; return v == null ? <span className="text-xs text-slate-400">Sin datos suficientes</span> : `${f1(v)} ${x.medidor === "km" ? "L/100 km" : "L/h"}`; }, orden: (x) => (x.medidor === "km" ? x.l100km : x.lh) },
    { clave: "rev", titulo: "Próxima revisión", celda: (x) => revision(x.veh) },
    { clave: "alert", titulo: "Alertas", celda: (x) => (
      <span className="flex flex-wrap gap-1">
        {x.incidencias > 0 && <Insignia tono="rojo">{x.incidencias} incid.</Insignia>}
        {x.lecturas > 0 && <Insignia tono="amarillo">{x.lecturas} lect. anómala{x.lecturas > 1 ? "s" : ""}</Insignia>}
        {x.incidencias === 0 && x.lecturas === 0 && <span className="text-slate-400">—</span>}
      </span>
    ) },
  ];

  const camiones = planas.filter((x) => x.medidor === "km" && x.l100km != null).map((x) => ({ id: x.vehiculoId, nombre: x.codigo, valor: Number(f1(x.l100km as number).replace(",", ".")), detalle: [{ etiqueta: "Km válidos", valor: km(x.km) }, { etiqueta: "Litros", valor: litros(x.litros) }] }));
  const maquinas = planas.filter((x) => x.medidor === "horas" && x.lh != null).map((x) => ({ id: x.vehiculoId, nombre: x.codigo, valor: Number(f1(x.lh as number).replace(",", ".")), detalle: [{ etiqueta: "Horas válidas", valor: horas(x.horas) }, { etiqueta: "Litros", valor: litros(x.litros) }] }));

  return (
    <>
      <EncabezadoPagina titulo="Flota y combustible" descripcion="Estado de camiones y maquinaria, kilómetros u horas trabajadas, combustible y rendimiento normalizado." />
      <FiltrosGlobales dimensiones={["conductor", "vehiculo"]} />

      <section aria-label="Indicadores de flota" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi neutral icono={<Fuel className={ico} />} titulo="Combustible consumido" valor={litros(kpis.combustibleConsumido)} variacion={a.previos.combustibleConsumido ? ((kpis.combustibleConsumido - a.previos.combustibleConsumido) / a.previos.combustibleConsumido) * 100 : null} detalle="Informado por conductores en operaciones" />
        <TarjetaKpi icono={<Droplets className={ico} />} titulo="Combustible cargado" valor={litros(cargadoPeriodo)} sinComparacion detalle="Abastecimiento en estación o depósito (distinto del consumo)" />
        <TarjetaKpi neutral icono={<Route className={ico} />} titulo="Kilómetros / horas" valor={km(kpis.kmFlota)} sinComparacion detalle={<>Maquinaria: {horas(kpis.horasMaquinaria)}</>} />
        <TarjetaKpi icono={<Gauge className={ico} />} titulo="Rendimiento promedio" valor={kpis.l100km == null ? "Sin datos suficientes" : `${f1(kpis.l100km)} L/100 km`} sinComparacion detalle={<>Maquinaria: {kpis.lh == null ? "Sin datos suficientes" : `${f1(kpis.lh)} L/h`}</>} />
      </section>

      <Tarjeta className="mb-5">
        <EncabezadoTarjeta titulo="Detalle por vehículo" subtitulo="Trabajo, litros y rendimiento del periodo seleccionado. Cada vehículo se normaliza por sus propios km u horas." />
        <TablaDatos columnas={cols} filas={filas} clave={(x) => x.vehiculoId} ordenInicial={{ clave: "veh", dir: "asc" }} tamanoPagina={12} ariaEtiqueta="Detalle de flota" />
        <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
          Los rendimientos excluyen registros incompletos, lecturas inconsistentes o distancias iguales a cero. El rendimiento no se calcula a partir del combustible cargado.
        </p>
      </Tarjeta>

      <div className="grid gap-4 xl:grid-cols-2">
        <GraficoBarrasSimple titulo="Rendimiento por camión (L/100 km)" subtitulo="Normalizado por kilómetros válidos. Menor es mejor." datos={camiones} formato={(n) => f1(n)} vacio="Sin datos suficientes para calcular rendimiento de camiones" pie="Se compara solo con kilómetros válidos y combustible registrado, nunca litros brutos entre vehículos con cargas de trabajo distintas." color={SERIE.naranja} nombreCol="Camión" etiquetaValor="L/100 km" />
        <GraficoBarrasSimple titulo="Consumo por máquina (L/h)" subtitulo="Normalizado por horas de horómetro válidas." datos={maquinas} formato={(n) => f1(n)} vacio="Sin datos suficientes para calcular L/h de maquinaria" color={SERIE.violeta} nombreCol="Máquina" etiquetaValor="L/h" />
        <div className="xl:col-span-2"><GraficoCombustible serie={sComb} /></div>
        <div className="xl:col-span-2"><GraficoFlota filas={planas} /></div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Combustible consumido, cargado y disponible" />
          <div className="space-y-3 p-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-navy-50 p-3"><dt className="text-xs text-slate-600">Consumido (operaciones)</dt><dd className="tabular text-lg font-semibold text-navy-900">{litros(kpis.combustibleConsumido)}</dd></div>
              <div className="rounded-lg bg-navy-50 p-3"><dt className="text-xs text-slate-600">Cargado (estación o depósito)</dt><dd className="tabular text-lg font-semibold text-navy-900">{litros(cargadoPeriodo)}</dd></div>
            </dl>
            <AvisoPagina tono="info" titulo="Combustible disponible: no se muestra">
              Esta demostración no implementa un inventario de combustible, por lo que no se puede calcular el saldo disponible. Tampoco se estima el consumo a partir del kilometraje.
            </AvisoPagina>
          </div>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Insumos de mantenimiento registrados" subtitulo="Registros opcionales; no se exigen al conductor en cada entrega." />
          <div className="p-4">
            {insumos.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">Sin insumos registrados en el periodo.</p> : (
              <TablaSimple
                columnas={[{ t: "Insumo" }, { t: "Registros", der: true }, { t: "Cantidad", der: true }]}
                filas={insumos.map(([tipo, e]) => [ETIQUETAS.tipoInsumo[tipo as keyof typeof ETIQUETAS.tipoInsumo], num(e.n), [...e.cantidad.entries()].map(([un, c]) => `${num(c, 1)} ${un}`).join(" · ")])}
              />
            )}
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
