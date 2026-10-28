"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { idx, nombreDe } from "@/lib/calc";
import { fechaHora } from "@/lib/formato";
import { can } from "@/lib/permisos";
import { useData, useUsuario } from "@/lib/store";
import type { Cambio } from "@/lib/types";
import { Boton, Tarjeta } from "@/components/ui/base";
import { BarraFiltros, EncabezadoPagina, EstadoVacio, TablaDatos, type Columna } from "@/components/ui/datos";
import { EntradaFiltro, SelectFiltro } from "@/components/ui/form";
import { History, Search } from "@/components/ui/icons";

const ENTIDADES: Record<string, string> = {
  venta: "Venta", pago: "Pago", despacho: "Despacho", viaje: "Viaje", registro: "Registro diario", carga: "Carga de combustible", insumo: "Insumo",
  clientes: "Cliente", faenas: "Faena", vehiculos: "Vehículo", materiales: "Material", usuarios: "Usuario", configuracion: "Configuración",
};

function rutaEntidad(c: Cambio, data: ReturnType<typeof useData>): string | null {
  switch (c.entidad) {
    case "venta": return `/ventas/${c.entidadId}`;
    case "despacho": return `/despachos/${c.entidadId}`;
    case "registro": return `/registros/${c.entidadId}`;
    case "clientes": return `/clientes/${c.entidadId}`;
    case "pago": { const p = data.pagos.find((x) => x.id === c.entidadId); return p ? `/ventas/${p.ventaId}` : null; }
    case "viaje": { const v = data.viajes.find((x) => x.id === c.entidadId); return v ? `/despachos/${v.despachoId}` : null; }
    default: return null;
  }
}

export function PaginaHistorial() {
  const data = useData();
  const usuario = useUsuario();
  const router = useRouter();
  const todo = can(usuario?.rol, "historial.ver_todo");
  const [q, setQ] = useState("");
  const [entidad, setEntidad] = useState("");
  const [quien, setQuien] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const propios = useMemo(() => {
    if (todo) return data.cambios;
    const i = idx(data);
    const ventas = new Set(data.ventas.filter((v) => v.vendedorId === usuario?.id).map((v) => v.id));
    const desp = new Set(data.despachos.filter((d) => d.ventaId && ventas.has(d.ventaId)).map((d) => d.id));
    const pagos = new Set(data.pagos.filter((p) => ventas.has(p.ventaId)).map((p) => p.id));
    const viajes = new Set(data.viajes.filter((v) => desp.has(v.despachoId)).map((v) => v.id));
    void i;
    return data.cambios.filter((c) => ventas.has(c.entidadId) || desp.has(c.entidadId) || pagos.has(c.entidadId) || viajes.has(c.entidadId) || (c.entidad === "clientes" && c.userId === usuario?.id));
  }, [data, todo, usuario]);

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return propios
      .filter((c) => (!entidad || c.entidad === entidad) && (!quien || c.userId === quien) && (!desde || c.fecha.slice(0, 10) >= desde) && (!hasta || c.fecha.slice(0, 10) <= hasta) && (!t || `${c.accion} ${c.detalle}`.toLowerCase().includes(t)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  }, [propios, q, entidad, quien, desde, hasta]);

  const cols: Columna<Cambio>[] = [
    { clave: "f", titulo: "Fecha y hora", celda: (c) => <span className="whitespace-nowrap">{fechaHora(c.fecha)}</span>, orden: (c) => c.fecha },
    { clave: "u", titulo: "Usuario", celda: (c) => nombreDe.usuario(data, c.userId), orden: (c) => nombreDe.usuario(data, c.userId), ocultarEnMovil: true },
    { clave: "e", titulo: "Registro", celda: (c) => ENTIDADES[c.entidad] ?? c.entidad, orden: (c) => c.entidad },
    { clave: "a", titulo: "Acción", celda: (c) => <span className="font-medium">{c.accion}</span> },
    { clave: "d", titulo: "Detalle", celda: (c) => <span className="block max-w-[28rem] whitespace-normal text-slate-700">{c.detalle}</span> },
  ];
  const hayFiltros = !!(q || entidad || quien || desde || hasta);
  const limpiar = () => { setQ(""); setEntidad(""); setQuien(""); setDesde(""); setHasta(""); };
  const entidadesPresentes = [...new Set(propios.map((c) => c.entidad))];

  return (
    <>
      <EncabezadoPagina titulo={todo ? "Historial de cambios" : "Mi historial"} descripcion={todo ? "Quién cambió qué y cuándo: altas, ediciones, anulaciones, validaciones y correcciones." : "Cambios sobre tus ventas, pagos y despachos asociados."} />
      <Tarjeta>
        <div className="border-b border-slate-100 p-3 sm:p-4">
          <BarraFiltros>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden />
              <EntradaFiltro etiqueta="Buscar en el historial" placeholder="Buscar acción o detalle…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64 pl-8" />
            </div>
            <SelectFiltro etiqueta="Tipo de registro" value={entidad} onChange={(e) => setEntidad(e.target.value)}>
              <option value="">Todos los tipos</option>
              {entidadesPresentes.map((e) => <option key={e} value={e}>{ENTIDADES[e] ?? e}</option>)}
            </SelectFiltro>
            {todo && (
              <SelectFiltro etiqueta="Usuario" value={quien} onChange={(e) => setQuien(e.target.value)}>
                <option value="">Todos los usuarios</option>
                {data.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </SelectFiltro>
            )}
            <EntradaFiltro etiqueta="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <EntradaFiltro etiqueta="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            {hayFiltros && <Boton tamano="sm" variante="fantasma" onClick={limpiar}>Limpiar</Boton>}
          </BarraFiltros>
        </div>
        <TablaDatos columnas={cols} filas={filas} clave={(c) => c.id} alHacerClic={(c) => { const r = rutaEntidad(c, data); if (r) router.push(r); }} ordenInicial={{ clave: "f", dir: "desc" }} tamanoPagina={15} ariaEtiqueta="Historial de cambios"
          vacio={<EstadoVacio icono={<History className="size-6" />} titulo="Sin cambios para mostrar" descripcion={hayFiltros ? "Ningún cambio coincide con los filtros." : "Aún no hay cambios registrados."} accion={hayFiltros ? <Boton variante="secundario" onClick={limpiar}>Limpiar filtros</Boton> : undefined} />} />
      </Tarjeta>
    </>
  );
}
