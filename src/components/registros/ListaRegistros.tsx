"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { despachosDeRegistro, nombreDe, totalesRegistro } from "@/lib/calc";
import { construirCSV, descargarTexto } from "@/lib/csv";
import { hoyISO } from "@/lib/fecha";
import { fecha, km, horas, litros, m3 } from "@/lib/formato";
import { useData } from "@/lib/store";
import { ETIQUETAS, type EstadoRegistro, type RegistroDiario } from "@/lib/types";
import { Boton, Insignia, Tarjeta } from "@/components/ui/base";
import { BarraFiltros, EncabezadoPagina, EstadoVacio, TablaDatos, type Columna } from "@/components/ui/datos";
import { EntradaFiltro, SelectFiltro } from "@/components/ui/form";
import { ClipboardList, Download } from "@/components/ui/icons";
import { BadgeRegistro } from "@/components/Estados";

export function ListaRegistros() {
  const data = useData();
  const router = useRouter();
  const params = useSearchParams();
  const estadoInicial = params.get("estado") ?? "";
  const [estado, setEstado] = useState(["pendiente", "validado", "devuelto"].includes(estadoInicial) ? estadoInicial : "");
  const [conductor, setConductor] = useState("");
  const [vehiculo, setVehiculo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const filas = useMemo(
    () =>
      data.registros.filter((r) => {
        if (estado && r.estado !== estado) return false;
        if (conductor && r.conductorId !== conductor) return false;
        if (vehiculo && r.vehiculoId !== vehiculo) return false;
        if (desde && r.fecha < desde) return false;
        if (hasta && r.fecha > hasta) return false;
        return true;
      }),
    [data.registros, estado, conductor, vehiculo, desde, hasta],
  );
  const conteo = (e: EstadoRegistro) => data.registros.filter((r) => r.estado === e).length;

  const cols: Columna<RegistroDiario>[] = [
    { clave: "n", titulo: "Registro", celda: (r) => <span className="font-medium text-brand-700">{r.numero}</span>, orden: (r) => r.numero },
    { clave: "f", titulo: "Fecha", celda: (r) => fecha(r.fecha), orden: (r) => r.fecha },
    { clave: "c", titulo: "Conductor", celda: (r) => nombreDe.usuario(data, r.conductorId), orden: (r) => nombreDe.usuario(data, r.conductorId) },
    { clave: "v", titulo: "Vehículo", celda: (r) => nombreDe.vehiculo(data, r.vehiculoId), orden: (r) => nombreDe.vehiculo(data, r.vehiculoId), ocultarEnMovil: true },
    { clave: "o", titulo: "Operaciones", alinear: "der", celda: (r) => despachosDeRegistro(data, r.id).length },
    { clave: "m", titulo: "Entregado", alinear: "der", celda: (r) => m3(totalesRegistro(data, r.id).volumen), orden: (r) => totalesRegistro(data, r.id).volumen, ocultarEnMovil: true },
    { clave: "l", titulo: "Consumido", alinear: "der", celda: (r) => litros(totalesRegistro(data, r.id).litrosConsumidos), ocultarEnMovil: true },
    { clave: "i", titulo: "Datos", celda: (r) => (totalesRegistro(data, r.id).completo ? <Insignia tono="verde">Completos</Insignia> : <Insignia tono="amarillo">Incompletos</Insignia>), ocultarEnMovil: true },
    { clave: "s", titulo: "Estado", celda: (r) => <BadgeRegistro estado={r.estado} />, orden: (r) => r.estado },
  ];

  function exportar() {
    const enc = ["N° registro", "Fecha", "Conductor", "Vehículo", "Operaciones", "Viajes", "Entregado (m³)", "Km", "Horas", "Combustible consumido (L)", "Combustible cargado (L)", "Datos completos", "Estado"];
    const rows = filas.map((r) => {
      const t = totalesRegistro(data, r.id);
      return [r.numero, r.fecha, nombreDe.usuario(data, r.conductorId), nombreDe.vehiculo(data, r.vehiculoId), despachosDeRegistro(data, r.id).length, t.viajes, t.volumen, t.km, t.horas, t.litrosConsumidos, t.litrosCargados, t.completo ? "Sí" : "No", ETIQUETAS.estadoRegistro[r.estado]];
    });
    descargarTexto(`registros_diarios_${hoyISO()}.csv`, construirCSV(enc, rows));
  }
  const hayFiltros = !!(estado || conductor || vehiculo || desde || hasta);
  const limpiar = () => { setEstado(""); setConductor(""); setVehiculo(""); setDesde(""); setHasta(""); };

  return (
    <>
      <EncabezadoPagina
        titulo="Registro diario"
        descripcion="Consolida por conductor, vehículo y fecha lo que se registró en cada entrega, sin duplicar datos. El supervisor valida o devuelve."
        acciones={<Boton variante="secundario" onClick={exportar} disabled={filas.length === 0}><Download className="size-4" /> Exportar CSV</Boton>}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {(["pendiente", "devuelto", "validado"] as const).map((e) => (
          <button key={e} type="button" onClick={() => setEstado(estado === e ? "" : e)} aria-pressed={estado === e} className={`rounded-full border px-3 py-1 ${estado === e ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {ETIQUETAS.estadoRegistro[e]} <span className="tabular font-semibold">{conteo(e)}</span>
          </button>
        ))}
      </div>
      <Tarjeta>
        <div className="border-b border-slate-100 p-3 sm:p-4">
          <BarraFiltros>
            <SelectFiltro etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {(["pendiente", "devuelto", "validado"] as const).map((e) => <option key={e} value={e}>{ETIQUETAS.estadoRegistro[e]}</option>)}
            </SelectFiltro>
            <SelectFiltro etiqueta="Conductor" value={conductor} onChange={(e) => setConductor(e.target.value)}>
              <option value="">Todos los conductores</option>
              {data.usuarios.filter((u) => u.rol === "conductor").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </SelectFiltro>
            <SelectFiltro etiqueta="Vehículo" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)}>
              <option value="">Todos los vehículos</option>
              {data.vehiculos.map((v) => <option key={v.id} value={v.id}>{v.codigo}</option>)}
            </SelectFiltro>
            <EntradaFiltro etiqueta="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <EntradaFiltro etiqueta="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            {hayFiltros && <Boton tamano="sm" variante="fantasma" onClick={limpiar}>Limpiar</Boton>}
          </BarraFiltros>
        </div>
        <TablaDatos columnas={cols} filas={filas} clave={(r) => r.id} alHacerClic={(r) => router.push(`/registros/${r.id}`)} ordenInicial={{ clave: "f", dir: "desc" }} tamanoPagina={12} ariaEtiqueta="Registros diarios"
          vacio={<EstadoVacio icono={<ClipboardList className="size-6" />} titulo="Sin registros para mostrar" descripcion="Los registros se crean cuando un conductor finaliza una entrega." accion={hayFiltros ? <Boton variante="secundario" onClick={limpiar}>Limpiar filtros</Boton> : undefined} />} />
      </Tarjeta>
    </>
  );
}
void km; void horas;
