"use client";
import { useMemo } from "react";
import { actividadFlota, cuentasPorCobrar, serieCombustible, serieOperacion, serieVentas, ventasEnPeriodo, ventasPorMaterial, ventasPorVendedor } from "@/lib/calc";
import { EncabezadoPagina } from "@/components/ui/datos";
import { FiltrosGlobales } from "./FiltrosGlobales";
import { useAnalisis } from "./useAnalisis";
import { AccesosRapidos, BloqueAlertas, GrillaKpisGenerales, UltimasEntregas, UltimasVentas } from "./bloques";
import { GraficoCobranza, GraficoCombustible, GraficoEficiencia, GraficoEvolucionVentas, GraficoFlota, GraficoVentasMaterial, GraficoVentasVendedor } from "./graficos";
import { colorCategoria } from "./colores";

export function DashGeneral() {
  const a = useAnalisis();
  const { data, f, r, rp, hoy } = a;
  const sVentas = useMemo(() => serieVentas(data, f, r, rp), [data, f, r, rp]);
  const sOper = useMemo(() => serieOperacion(data, f, r), [data, f, r]);
  const sComb = useMemo(() => serieCombustible(data, f, r), [data, f, r]);
  const material = useMemo(() => ventasPorMaterial(data, f, r), [data, f, r]);
  const vendedor = useMemo(() => ventasPorVendedor(data, f, r), [data, f, r]);
  const flota = useMemo(() => actividadFlota(data, f, r), [data, f, r]);
  const cobranza = useMemo(() => cuentasPorCobrar(data, ventasEnPeriodo(data, f, r), hoy), [data, f, r, hoy]);
  const colorMaterial = (id: string) => colorCategoria(Math.max(0, data.materiales.findIndex((m) => m.id === id)));
  const vendedores = data.usuarios.filter((u) => u.rol === "vendedor");
  const colorVendedor = (id: string) => colorCategoria(Math.max(0, vendedores.findIndex((u) => u.id === id)));

  return (
    <>
      <EncabezadoPagina titulo="Dashboard general" descripcion="Cómo van las ventas, las entregas y la operación de la flota. Todos los filtros actualizan indicadores y gráficos." />
      <FiltrosGlobales dimensiones={["vendedor", "cliente", "material", "faena", "conductor", "vehiculo", "estadoVenta", "estadoDespacho"]} />
      <GrillaKpisGenerales a={a} />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><GraficoEvolucionVentas serie={sVentas} comparar /></div>
        <GraficoVentasMaterial filas={material} colorDe={colorMaterial} />
        <GraficoVentasVendedor filas={vendedor} colorDe={colorVendedor} />
        <div className="xl:col-span-2"><GraficoCobranza res={cobranza} /></div>
        <div className="xl:col-span-3"><GraficoEficiencia serie={sOper} /></div>
        <div className="xl:col-span-3"><GraficoCombustible serie={sComb} /></div>
        <div className="xl:col-span-3"><GraficoFlota filas={flota} /></div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><BloqueAlertas a={a} /></div>
        <AccesosRapidos
          items={[
            { href: "/ventas/nueva", etiqueta: "Crear una venta", descripcion: "Registrar una nueva venta", icono: "venta" },
            { href: "/despachos", etiqueta: "Revisar despachos", descripcion: "Estados y talonarios", icono: "despacho" },
            { href: "/reportes", etiqueta: "Consultar un reporte", descripcion: "Con exportación CSV", icono: "reporte" },
            { href: "/registros?estado=pendiente", etiqueta: "Validar registros", descripcion: "Registros diarios pendientes", icono: "flota" },
          ]}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <UltimasVentas a={a} />
        <UltimasEntregas a={a} />
      </div>
    </>
  );
}
