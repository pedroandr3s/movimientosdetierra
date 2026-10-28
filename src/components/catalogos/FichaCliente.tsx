"use client";
import { useState } from "react";
import { cobradoVenta, destinoDespacho, idx, totalesVenta, ventaValida, volumenEntregadoDespacho } from "@/lib/calc";
import { hoyISO } from "@/lib/fecha";
import { clp, fecha, m3 } from "@/lib/formato";
import { can } from "@/lib/permisos";
import { useData, useUsuario } from "@/lib/store";
import type { Despacho } from "@/lib/types";
import { useRouter } from "next/navigation";
import { Boton, EncabezadoTarjeta, EnlaceBoton, Tarjeta } from "@/components/ui/base";
import { AvisoPagina, EncabezadoPagina, EstadoVacio, ListaDatos, TablaDatos, TarjetaKpi, type Columna } from "@/components/ui/datos";
import { Pencil, Plus } from "@/components/ui/icons";
import { BadgeDespacho } from "@/components/Estados";
import { columnasVentas } from "@/components/ventas/columnas";
import { FormularioEntidad, aValores, DEFS } from "./CatalogManager";
import { saldoCliente } from "./definiciones";

export function FichaCliente({ clienteId }: { clienteId: string }) {
  const data = useData();
  const usuario = useUsuario();
  const router = useRouter();
  const hoy = hoyISO();
  const i = idx(data);
  const c = i.clientes.get(clienteId);
  const [editando, setEditando] = useState(false);
  if (!c) return <EstadoVacio titulo="El cliente no existe" accion={<EnlaceBoton href="/clientes" variante="primario">Ir a clientes</EnlaceBoton>} />;

  const esVendedor = usuario?.rol === "vendedor";
  const ventas = data.ventas.filter((v) => v.clienteId === c.id && (!esVendedor || v.vendedorId === usuario?.id)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const idsVentas = new Set(ventas.map((v) => v.id));
  const despachos = data.despachos.filter((d) => (d.ventaId ? idsVentas.has(d.ventaId) : !esVendedor && d.clienteId === c.id)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const validas = ventas.filter(ventaValida);
  const facturado = validas.reduce((s, v) => s + totalesVenta(v).total, 0);
  const cobrado = validas.reduce((s, v) => s + cobradoVenta(data, v.id), 0);
  const saldo = esVendedor ? validas.filter((v) => v.estado === "confirmada").reduce((s, v) => s + Math.max(0, totalesVenta(v).total - cobradoVenta(data, v.id)), 0) : saldoCliente(data, c.id);
  const puedeEditar = can(usuario?.rol, "catalogos.editar_clientes");
  const faenas = data.faenas.filter((f) => f.clienteId === c.id);

  const colsDesp: Columna<Despacho>[] = [
    { clave: "n", titulo: "Despacho", celda: (d) => <span className="font-medium text-brand-700">{d.numero}</span> },
    { clave: "f", titulo: "Fecha", celda: (d) => fecha(d.fecha) },
    { clave: "d", titulo: "Destino", celda: (d) => <span className="block max-w-[16rem] truncate">{destinoDespacho(data, d)}</span>, ocultarEnMovil: true },
    { clave: "m", titulo: "Entregado", alinear: "der", celda: (d) => m3(volumenEntregadoDespacho(data, d.id)) },
    { clave: "e", titulo: "Estado", celda: (d) => <BadgeDespacho estado={d.estado} /> },
  ];

  return (
    <>
      <EncabezadoPagina
        migas={[{ href: "/clientes", texto: "Clientes" }, { texto: c.nombre }]}
        titulo={c.nombre}
        descripcion={c.activo ? "Cliente activo" : "Cliente inactivo"}
        acciones={
          <>
            {puedeEditar && <Boton variante="secundario" onClick={() => setEditando(true)}><Pencil className="size-4" /> Editar</Boton>}
            {can(usuario?.rol, "ventas.crear") && <EnlaceBoton href={`/ventas/nueva?cliente=${c.id}`} variante="acento"><Plus className="size-4" /> Nueva venta</EnlaceBoton>}
          </>
        }
      />
      {esVendedor && <div className="mb-4"><AvisoPagina tono="info">Se muestran solo las ventas y despachos de este cliente asociados a tus ventas.</AvisoPagina></div>}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi titulo="Ventas válidas" valor={String(validas.length)} sinComparacion />
        <TarjetaKpi titulo="Total vendido (con IVA)" valor={clp(facturado)} sinComparacion />
        <TarjetaKpi titulo="Cobrado" valor={clp(cobrado)} sinComparacion />
        <TarjetaKpi titulo="Saldo por cobrar" valor={clp(saldo)} sinComparacion neutral />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-1">
          <EncabezadoTarjeta titulo="Datos del cliente" />
          <div className="p-4 sm:p-5">
            <ListaDatos columnas={1} items={[
              { etiqueta: "RUT", valor: c.rut ?? "—" },
              { etiqueta: "Contacto", valor: c.contacto ?? "—" },
              { etiqueta: "Teléfono", valor: c.telefono ?? "—" },
              { etiqueta: "Correo", valor: c.email ?? "—" },
              { etiqueta: "Dirección", valor: c.direccion ?? "—" },
              { etiqueta: "Faenas", valor: faenas.length > 0 ? faenas.map((f) => f.nombre).join(", ") : "—" },
              { etiqueta: "Observaciones", valor: c.observaciones ?? "—" },
            ]} />
          </div>
        </Tarjeta>
        <div className="space-y-5 lg:col-span-2">
          <Tarjeta>
            <EncabezadoTarjeta titulo={`Ventas (${ventas.length})`} />
            <TablaDatos columnas={columnasVentas(data, hoy, { vendedor: !esVendedor })} filas={ventas} clave={(v) => v.id} alHacerClic={(v) => router.push(`/ventas/${v.id}`)} tamanoPagina={6} ariaEtiqueta="Ventas del cliente" vacio={<EstadoVacio titulo="Sin ventas" descripcion="Este cliente aún no registra ventas." />} />
          </Tarjeta>
          <Tarjeta>
            <EncabezadoTarjeta titulo={`Despachos (${despachos.length})`} />
            <TablaDatos columnas={colsDesp} filas={despachos} clave={(d) => d.id} alHacerClic={(d) => router.push(`/despachos/${d.id}`)} tamanoPagina={6} ariaEtiqueta="Despachos del cliente" vacio={<EstadoVacio titulo="Sin despachos" descripcion="Aún no hay entregas para este cliente." />} />
          </Tarjeta>
        </div>
      </div>
      {editando && <FormularioEntidad def={DEFS.clientes} inicial={aValores(c as unknown as Record<string, unknown>, DEFS.clientes)} id={c.id} onCerrar={() => setEditando(false)} />}
    </>
  );
}
