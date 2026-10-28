import type { AppData, Venta } from "@/lib/types";
import {
  estadoComercialVenta, estadoPagoVenta, nombreDe, saldoVenta, totalesVenta, volumenEntregadoVenta,
} from "@/lib/calc";
import { clp, fecha, m3 } from "@/lib/formato";
import type { Columna } from "@/components/ui/datos";
import { BadgeComercial, BadgePago } from "@/components/Estados";
import { ETIQUETAS } from "@/lib/types";

/** Columnas del listado de ventas, compartidas por el módulo de ventas y los dashboards. */
export function columnasVentas(data: AppData, hoy: string, opciones: { vendedor?: boolean } = {}): Columna<Venta>[] {
  const cols: Columna<Venta>[] = [
    { clave: "numero", titulo: "N° venta", celda: (v) => <span className="font-medium text-brand-700">{v.numero}</span>, orden: (v) => v.numero },
    { clave: "fecha", titulo: "Fecha", celda: (v) => fecha(v.fecha), orden: (v) => v.fecha },
    { clave: "cliente", titulo: "Cliente", celda: (v) => <span className="block max-w-[14rem] truncate">{nombreDe.cliente(data, v.clienteId)}</span>, orden: (v) => nombreDe.cliente(data, v.clienteId) },
  ];
  if (opciones.vendedor) cols.push({ clave: "vendedor", titulo: "Vendedor", celda: (v) => nombreDe.usuario(data, v.vendedorId), orden: (v) => nombreDe.usuario(data, v.vendedorId), ocultarEnMovil: true });
  cols.push(
    { clave: "material", titulo: "Material", celda: (v) => nombreDe.material(data, v.materialId), orden: (v) => nombreDe.material(data, v.materialId), ocultarEnMovil: true },
    { clave: "solicitado", titulo: "Solicitado", alinear: "der", celda: (v) => m3(v.cantidadM3), orden: (v) => v.cantidadM3 },
    { clave: "entregado", titulo: "Entregado", alinear: "der", celda: (v) => m3(volumenEntregadoVenta(data, v.id)), orden: (v) => volumenEntregadoVenta(data, v.id) },
    { clave: "total", titulo: "Total", alinear: "der", celda: (v) => clp(totalesVenta(v).total), orden: (v) => totalesVenta(v).total },
    { clave: "saldo", titulo: "Saldo", alinear: "der", celda: (v) => (v.estado === "confirmada" ? clp(saldoVenta(data, v)) : "—"), orden: (v) => (v.estado === "confirmada" ? saldoVenta(data, v) : -1) },
    { clave: "entrega", titulo: "Despacho", celda: (v) => <BadgeComercial estado={estadoComercialVenta(data, v)} />, orden: (v) => ETIQUETAS.estadoComercial[estadoComercialVenta(data, v)] },
    { clave: "pago", titulo: "Pago", celda: (v) => <BadgePago estado={estadoPagoVenta(data, v, hoy)} />, orden: (v) => estadoPagoVenta(data, v, hoy) ?? "" },
  );
  return cols;
}
