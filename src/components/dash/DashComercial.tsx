"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  cobradoVenta, cuentasPorCobrar, estadoComercialVenta, saldoVenta, serieVentas, ventasEnPeriodo, ventasPorCliente, ventasPorMaterial, ventasPorVendedor,
  variacionPct, volumenEntregadoVenta, redondear,
} from "@/lib/calc";
import { clp, m3, num, pct } from "@/lib/formato";
import { Tarjeta, EncabezadoTarjeta, EnlaceBoton } from "@/components/ui/base";
import { EncabezadoPagina, TablaDatos, TarjetaKpi } from "@/components/ui/datos";
import { Banknote, CircleCheck, ClipboardList, Package, Receipt, Truck, Wallet, TriangleAlert } from "@/components/ui/icons";
import { columnasVentas } from "@/components/ventas/columnas";
import { FiltrosGlobales } from "./FiltrosGlobales";
import { useAnalisis } from "./useAnalisis";
import { AccesosRapidos, BloqueAlertas, UltimasEntregas } from "./bloques";
import { GraficoCobranza, GraficoEvolucionVentas, GraficoVentasCliente, GraficoVentasMaterial, GraficoVentasVendedor } from "./graficos";
import { SERIE, colorCategoria } from "./colores";
import { useUsuario } from "@/lib/store";

const ico = "size-[18px]";

/** Dashboard comercial. Con `propio` se limita a las ventas del vendedor conectado (panel del vendedor). */
export function DashComercial({ propio }: { propio?: boolean }) {
  const usuario = useUsuario();
  const vendedorId = propio ? usuario?.id : undefined;
  const a = useAnalisis(vendedorId);
  const router = useRouter();
  const { data, f, r, rp, hoy, kpis: k, previos: p } = a;

  const ventas = useMemo(() => ventasEnPeriodo(data, f, r), [data, f, r]);
  const ventasPrev = useMemo(() => ventasEnPeriodo(data, f, rp), [data, f, rp]);
  const sVentas = useMemo(() => serieVentas(data, f, r, rp), [data, f, r, rp]);
  const material = useMemo(() => ventasPorMaterial(data, f, r), [data, f, r]);
  const vendedor = useMemo(() => ventasPorVendedor(data, f, r), [data, f, r]);
  const cliente = useMemo(() => ventasPorCliente(data, f, r).slice(0, 8), [data, f, r]);
  const cobranza = useMemo(() => cuentasPorCobrar(data, ventas, hoy), [data, ventas, hoy]);

  const entregadoDeVendido = redondear(ventas.reduce((s, v) => s + Math.min(volumenEntregadoVenta(data, v.id), v.cantidadM3), 0));
  const completadas = ventas.filter((v) => estadoComercialVenta(data, v) === "entregada").length;
  const sinDespachar = ventas.filter((v) => estadoComercialVenta(data, v) === "confirmada").length;
  const prop = ventas.length ? (completadas / ventas.length) * 100 : null;
  const porCobrar = ventas.reduce((s, v) => s + saldoVenta(data, v), 0);
  const cobradoDeVentas = ventas.reduce((s, v) => s + cobradoVenta(data, v.id), 0);
  const cols = useMemo(() => columnasVentas(data, hoy, { vendedor: !propio }), [data, hoy, propio]);
  const vendedores = data.usuarios.filter((u) => u.rol === "vendedor");

  return (
    <>
      <EncabezadoPagina
        titulo={propio ? "Mi panel comercial" : "Dashboard comercial"}
        descripcion={propio ? `Tus ventas, entregas y cobros${usuario ? `, ${usuario.nombre}` : ""}. Solo ves información de tus propias ventas.` : "Ventas, cobranza y avance de entrega. Responde cuánto se vendió, cuánto se cobró y cuánto se debe."}
        acciones={<EnlaceBoton href="/ventas/nueva" variante="acento"><Receipt className="size-4" aria-hidden /> Nueva venta</EnlaceBoton>}
      />
      <FiltrosGlobales dimensiones={propio ? ["cliente", "material", "faena", "estadoVenta"] : ["vendedor", "cliente", "material", "faena", "estadoVenta"]} fijarVendedorId={vendedorId} />

      <section aria-label="Indicadores comerciales" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi destacado icono={<Receipt className={ico} />} titulo="Ventas del periodo (con IVA)" valor={clp(k.ventasTotal)} variacion={variacionPct(k.ventasTotal, p.ventasTotal)} detalle={<>Neto {clp(k.ventasNeto)} · IVA {clp(k.ventasIva)}</>} />
        <TarjetaKpi icono={<ClipboardList className={ico} />} titulo="Ventas registradas" valor={num(ventas.length)} variacion={variacionPct(ventas.length, ventasPrev.length)} detalle="Confirmadas, sin anuladas" />
        <TarjetaKpi icono={<Wallet className={ico} />} titulo="Cobrado en el periodo" valor={clp(k.cobrado)} variacion={variacionPct(k.cobrado, p.cobrado)} detalle="Pagos con fecha dentro del periodo" />
        <TarjetaKpi icono={<Banknote className={ico} />} titulo="Saldo por cobrar de estas ventas" valor={clp(porCobrar)} sinComparacion menorEsMejor detalle={<>Cobrado de estas ventas: {clp(cobradoDeVentas)}</>} />
        <TarjetaKpi icono={<Package className={ico} />} titulo="Volumen vendido" valor={m3(k.volumenVendido)} variacion={variacionPct(k.volumenVendido, p.volumenVendido)} />
        <TarjetaKpi icono={<Truck className={ico} />} titulo="Entregado de lo vendido" valor={m3(entregadoDeVendido)} sinComparacion detalle={<>{k.volumenVendido ? pct((entregadoDeVendido / k.volumenVendido) * 100) : "—"} del volumen vendido en el periodo</>} />
        <TarjetaKpi icono={<CircleCheck className={ico} />} titulo="Ventas completadas" valor={prop == null ? "Sin datos suficientes" : pct(prop)} sinComparacion detalle={<>{num(completadas)} de {num(ventas.length)} ventas totalmente entregadas</>} />
        <TarjetaKpi icono={<TriangleAlert className={ico} />} titulo="Ventas sin despachar" valor={num(sinDespachar)} sinComparacion menorEsMejor detalle="Confirmadas sin ninguna entrega" />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><GraficoEvolucionVentas serie={sVentas} comparar /></div>
        <GraficoVentasMaterial filas={material} colorDe={(id) => colorCategoria(Math.max(0, data.materiales.findIndex((m) => m.id === id)))} />
        {!propio && <GraficoVentasVendedor filas={vendedor} colorDe={(id) => colorCategoria(Math.max(0, vendedores.findIndex((u) => u.id === id)))} />}
        <GraficoVentasCliente filas={cliente} colorDe={() => SERIE.azul} />
        <div className={propio ? "xl:col-span-3" : "xl:col-span-3"}><GraficoCobranza res={cobranza} /></div>
      </div>

      <Tarjeta className="mt-5">
        <EncabezadoTarjeta titulo="Ventas del periodo" subtitulo="Mismos registros que el listado de ventas. Haz clic en una fila para abrir su ficha." />
        <TablaDatos
          columnas={cols}
          filas={ventas}
          clave={(v) => v.id}
          alHacerClic={(v) => router.push(`/ventas/${v.id}`)}
          ordenInicial={{ clave: "fecha", dir: "desc" }}
          tamanoPagina={10}
          ariaEtiqueta="Ventas del periodo"
        />
      </Tarjeta>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><BloqueAlertas a={a} soloVendedor={propio} /></div>
        <AccesosRapidos items={propio ? [
          { href: "/ventas/nueva", etiqueta: "Crear una venta", descripcion: "Registrar una nueva venta", icono: "venta" },
          { href: "/ventas", etiqueta: "Mis ventas", descripcion: "Listado y estados", icono: "reporte" },
          { href: "/despachos/nuevo", etiqueta: "Programar un despacho", descripcion: "Para una venta confirmada", icono: "despacho" },
          { href: "/clientes", etiqueta: "Clientes", descripcion: "Consultar o registrar", icono: "clientes" },
        ] : [
          { href: "/ventas/nueva", etiqueta: "Crear una venta", descripcion: "Registrar una nueva venta", icono: "venta" },
          { href: "/reportes", etiqueta: "Consultar un reporte", descripcion: "Ventas, clientes y cobranza", icono: "reporte" },
          { href: "/despachos/nuevo", etiqueta: "Programar un despacho", descripcion: "Para una venta confirmada", icono: "despacho" },
          { href: "/clientes", etiqueta: "Clientes", descripcion: "Fichas y ventas asociadas", icono: "clientes" },
        ]} />
      </div>
      <div className="mt-4"><UltimasEntregas a={a} vendedorId={vendedorId} /></div>
    </>
  );
}
