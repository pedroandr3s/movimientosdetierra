"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { destinoDespacho, idx, nombreDe, viajesDeDespacho, volumenEntregadoDespacho } from "@/lib/calc";
import { construirCSV, descargarTexto } from "@/lib/csv";
import { hoyISO } from "@/lib/fecha";
import { fecha, m3 } from "@/lib/formato";
import { can } from "@/lib/permisos";
import { useData, useUsuario } from "@/lib/store";
import { ETIQUETAS, type Despacho, type EstadoDespacho } from "@/lib/types";
import { Boton, EnlaceBoton, Tarjeta } from "@/components/ui/base";
import { BarraFiltros, EncabezadoPagina, EstadoVacio, TablaDatos, type Columna } from "@/components/ui/datos";
import { EntradaFiltro, SelectFiltro } from "@/components/ui/form";
import { ClipboardList, Download, Plus, Search } from "@/components/ui/icons";
import { BadgeDespacho } from "@/components/Estados";

const ESTADOS: EstadoDespacho[] = ["programado", "en_curso", "finalizado", "incidencia", "anulado"];

export function ListaDespachos() {
  const data = useData();
  const usuario = useUsuario();
  const router = useRouter();
  const i = idx(data);
  const esAdmin = usuario?.rol === "admin";
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [vehiculo, setVehiculo] = useState("");
  const [conductor, setConductor] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const visibles = useMemo(
    () => data.despachos.filter((d) => esAdmin || (d.ventaId && i.ventas.get(d.ventaId)?.vendedorId === usuario?.id)),
    [data.despachos, esAdmin, i, usuario],
  );

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return visibles.filter((d) => {
      if (estado && d.estado !== estado) return false;
      if (vehiculo && d.vehiculoId !== vehiculo) return false;
      if (conductor && d.conductorId !== conductor) return false;
      if (desde && d.fecha < desde) return false;
      if (hasta && d.fecha > hasta) return false;
      if (t) {
        const v = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
        const texto = `${d.numero} ${v?.numero ?? ""} ${destinoDespacho(data, d)} ${nombreDe.cliente(data, d.clienteId ?? v?.clienteId)} ${nombreDe.vehiculo(data, d.vehiculoId)} ${nombreDe.usuario(data, d.conductorId)}`.toLowerCase();
        if (!texto.includes(t)) return false;
      }
      return true;
    });
  }, [visibles, data, i, q, estado, vehiculo, conductor, desde, hasta]);

  const cols: Columna<Despacho>[] = [
    { clave: "n", titulo: "Despacho", celda: (d) => <span className="font-medium text-brand-700">{d.numero}</span>, orden: (d) => d.numero },
    { clave: "f", titulo: "Fecha", celda: (d) => fecha(d.fecha), orden: (d) => d.fecha },
    { clave: "v", titulo: "Venta", celda: (d) => (d.ventaId ? i.ventas.get(d.ventaId)?.numero : <span className="text-xs text-slate-500">{d.tipo === "trabajo_maquinaria" ? "Trabajo de maquinaria" : "Sin venta"}</span>), orden: (d) => (d.ventaId ? i.ventas.get(d.ventaId)?.numero ?? "" : "") },
    { clave: "c", titulo: "Cliente · destino", celda: (d) => <span className="block max-w-[16rem] truncate">{nombreDe.cliente(data, d.clienteId ?? (d.ventaId ? i.ventas.get(d.ventaId)?.clienteId : undefined))} · {destinoDespacho(data, d)}</span> },
    { clave: "veh", titulo: "Vehículo", celda: (d) => nombreDe.vehiculo(data, d.vehiculoId), orden: (d) => nombreDe.vehiculo(data, d.vehiculoId), ocultarEnMovil: true },
    { clave: "cd", titulo: "Conductor", celda: (d) => nombreDe.usuario(data, d.conductorId), orden: (d) => nombreDe.usuario(data, d.conductorId), ocultarEnMovil: true },
    { clave: "s", titulo: "Solicitado", alinear: "der", celda: (d) => (d.tipo === "transporte" ? m3(d.volumenSolicitadoM3) : "—"), orden: (d) => d.volumenSolicitadoM3 },
    { clave: "e", titulo: "Entregado", alinear: "der", celda: (d) => (d.tipo === "transporte" ? m3(volumenEntregadoDespacho(data, d.id)) : "—"), orden: (d) => volumenEntregadoDespacho(data, d.id) },
    { clave: "vj", titulo: "Viajes", alinear: "der", celda: (d) => (d.tipo === "transporte" ? `${viajesDeDespacho(data, d.id).length} / ${d.viajesPlanificados}` : "—") },
    { clave: "st", titulo: "Estado", celda: (d) => <BadgeDespacho estado={d.estado} />, orden: (d) => ETIQUETAS.estadoDespacho[d.estado] },
  ];

  function exportar() {
    const enc = ["N° despacho", "Fecha", "Venta", "Cliente", "Destino", "Material", "Vehículo", "Conductor", "Solicitado (m³)", "Entregado (m³)", "Viajes realizados", "Viajes planificados", "Estado"];
    const rows = filas.map((d) => {
      const v = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
      return [d.numero, d.fecha, v?.numero ?? "", nombreDe.cliente(data, d.clienteId ?? v?.clienteId), destinoDespacho(data, d), nombreDe.material(data, d.materialId ?? v?.materialId), nombreDe.vehiculo(data, d.vehiculoId), nombreDe.usuario(data, d.conductorId), d.volumenSolicitadoM3, volumenEntregadoDespacho(data, d.id), viajesDeDespacho(data, d.id).length, d.viajesPlanificados, ETIQUETAS.estadoDespacho[d.estado]];
    });
    descargarTexto(`despachos_${hoyISO()}.csv`, construirCSV(enc, rows));
  }

  const hayFiltros = !!(q || estado || vehiculo || conductor || desde || hasta);
  const limpiar = () => { setQ(""); setEstado(""); setVehiculo(""); setConductor(""); setDesde(""); setHasta(""); };

  return (
    <>
      <EncabezadoPagina
        titulo={esAdmin ? "Despachos y talonarios" : "Despachos de mis ventas"}
        descripcion="Cada venta confirmada puede generar uno o más despachos; el volumen entregado es la suma de sus viajes válidos."
        acciones={
          <>
            <Boton variante="secundario" onClick={exportar} disabled={filas.length === 0}><Download className="size-4" /> Exportar CSV</Boton>
            {can(usuario?.rol, "despachos.crear") && <EnlaceBoton href="/despachos/nuevo" variante="acento"><Plus className="size-4" /> Nuevo despacho</EnlaceBoton>}
          </>
        }
      />
      <Tarjeta>
        <div className="border-b border-slate-100 p-3 sm:p-4">
          <BarraFiltros>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden />
              <EntradaFiltro etiqueta="Buscar despachos" placeholder="Buscar por número, cliente, destino…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64 pl-8" />
            </div>
            <SelectFiltro etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((s) => <option key={s} value={s}>{ETIQUETAS.estadoDespacho[s]}</option>)}
            </SelectFiltro>
            <SelectFiltro etiqueta="Vehículo" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)}>
              <option value="">Todos los vehículos</option>
              {data.vehiculos.map((v) => <option key={v.id} value={v.id}>{v.codigo}</option>)}
            </SelectFiltro>
            {esAdmin && (
              <SelectFiltro etiqueta="Conductor" value={conductor} onChange={(e) => setConductor(e.target.value)}>
                <option value="">Todos los conductores</option>
                {data.usuarios.filter((u) => u.rol === "conductor").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </SelectFiltro>
            )}
            <EntradaFiltro etiqueta="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <EntradaFiltro etiqueta="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            {hayFiltros && <Boton tamano="sm" variante="fantasma" onClick={limpiar}>Limpiar</Boton>}
          </BarraFiltros>
        </div>
        <TablaDatos
          columnas={cols}
          filas={filas}
          clave={(d) => d.id}
          alHacerClic={(d) => router.push(`/despachos/${d.id}`)}
          ordenInicial={{ clave: "f", dir: "desc" }}
          tamanoPagina={12}
          ariaEtiqueta="Listado de despachos"
          vacio={<EstadoVacio icono={<ClipboardList className="size-6" />} titulo={visibles.length === 0 ? "Aún no hay despachos" : "Ningún despacho coincide con los filtros"} descripcion={visibles.length === 0 ? "Programa un despacho a partir de una venta confirmada." : "Prueba con otros filtros."} accion={hayFiltros ? <Boton variante="secundario" onClick={limpiar}>Limpiar filtros</Boton> : undefined} />}
        />
      </Tarjeta>
    </>
  );
}
