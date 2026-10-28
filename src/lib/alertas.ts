/**
 * Alertas operacionales derivadas SIEMPRE de los datos (nunca mensajes estáticos).
 * Los umbrales provienen de `config.umbrales` (parámetros de demostración editables).
 */
import type { AppData, ISODate } from "./types";
import {
  destinoDespacho,
  estadoPagoVenta,
  excesoVenta,
  idx,
  nombreDe,
  totalesVenta,
  trabajoDespacho,
  ventaValida,
  volumenEntregadoVenta,
  volumenPendienteVenta,
} from "./calc";
import { diffDays } from "./fecha";
import { clp, fecha, m3 } from "./formato";

export type TipoAlerta =
  | "incidencia"
  | "retraso"
  | "pendiente"
  | "sin_validar"
  | "lectura"
  | "consumo"
  | "revision"
  | "incompleto"
  | "cobranza"
  | "exceso";

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  severidad: "alta" | "media" | "baja";
  titulo: string;
  detalle: string;
  href?: string;
}

export const TITULO_TIPO_ALERTA: Record<TipoAlerta, string> = {
  incidencia: "Incidencias",
  retraso: "Entregas con retraso",
  pendiente: "Volumen pendiente",
  sin_validar: "Registros sin validar",
  lectura: "Lecturas anómalas",
  consumo: "Consumo fuera de umbral",
  revision: "Vehículos a revisar",
  incompleto: "Información incompleta",
  cobranza: "Cobranza vencida",
  exceso: "Exceso de volumen",
};

export function generarAlertas(data: AppData, hoy: ISODate): Alerta[] {
  const out: Alerta[] = [];
  const i = idx(data);
  const u = data.config.umbrales;

  // 1) Incidencias y 2) retrasos
  for (const d of data.despachos) {
    if (d.estado === "incidencia") {
      out.push({
        id: `inc-${d.id}`,
        tipo: "incidencia",
        severidad: "alta",
        titulo: `Incidencia en ${d.numero}`,
        detalle: `${nombreDe.vehiculo(data, d.vehiculoId)} · ${nombreDe.usuario(data, d.conductorId)}${d.incidencia ? ` — ${d.incidencia}` : ""}`,
        href: `/despachos/${d.id}`,
      });
    }
    if ((d.estado === "programado" || d.estado === "en_curso") && d.fecha < hoy) {
      const dias = diffDays(d.fecha, hoy);
      out.push({
        id: `ret-${d.id}`,
        tipo: "retraso",
        severidad: "alta",
        titulo: `Entrega con retraso: ${d.numero}`,
        detalle: `Programada el ${fecha(d.fecha)} (${dias} ${dias === 1 ? "día" : "días"} de atraso) · ${destinoDespacho(data, d)}`,
        href: `/despachos/${d.id}`,
      });
    }
  }

  // 3) Ventas con volumen pendiente y fecha prevista vencida, sin despacho activo
  for (const v of data.ventas) {
    if (!ventaValida(v)) continue;
    const pend = volumenPendienteVenta(data, v);
    if (pend <= 0 || v.fechaEntregaPrevista >= hoy) continue;
    const ds = i.despachosPorVenta.get(v.id) ?? [];
    const hayActivo = ds.some((d) => d.estado === "programado" || d.estado === "en_curso" || d.estado === "incidencia");
    if (hayActivo) continue;
    out.push({
      id: `pend-${v.id}`,
      tipo: "pendiente",
      severidad: "media",
      titulo: `Volumen pendiente en ${v.numero}`,
      detalle: `${m3(pend)} de ${m3(v.cantidadM3)} sin despachar · prevista ${fecha(v.fechaEntregaPrevista)} · ${nombreDe.cliente(data, v.clienteId)}`,
      href: `/ventas/${v.id}`,
    });
  }

  // 4) Registros sin validar (agrupado)
  const sinValidar = data.registros.filter((r) => r.estado === "pendiente");
  if (sinValidar.length > 0) {
    const antiguos = sinValidar.filter((r) => diffDays(r.fecha, hoy) >= 2).length;
    out.push({
      id: "sin-validar",
      tipo: "sin_validar",
      severidad: antiguos > 0 ? "media" : "baja",
      titulo: `${sinValidar.length} ${sinValidar.length === 1 ? "registro diario sin validar" : "registros diarios sin validar"}`,
      detalle: antiguos > 0 ? `${antiguos} con 2 o más días de antigüedad.` : "Todos son recientes.",
      href: "/registros?estado=pendiente",
    });
  }
  const devueltos = data.registros.filter((r) => r.estado === "devuelto").length;
  if (devueltos > 0) {
    out.push({
      id: "devueltos",
      tipo: "sin_validar",
      severidad: "baja",
      titulo: `${devueltos} ${devueltos === 1 ? "registro devuelto" : "registros devueltos"} al conductor`,
      detalle: "Esperan corrección del conductor.",
      href: "/registros?estado=devuelto",
    });
  }

  // 5) Lecturas anómalas + 6) consumo fuera de umbral + 7) incompletos
  const incompletos: string[] = [];
  for (const d of data.despachos) {
    if (d.estado !== "finalizado" && d.estado !== "incidencia") continue;
    const t = trabajoDespacho(data, d);
    const veh = i.vehiculos.get(d.vehiculoId);
    if (t.motivo === "anomala" || t.motivo === "inconsistente") {
      out.push({
        id: `lec-${d.id}`,
        tipo: "lectura",
        severidad: "media",
        titulo: `Lectura ${t.motivo === "anomala" ? "anómala" : "inconsistente"} en ${d.numero}`,
        detalle: `${nombreDe.vehiculo(data, d.vehiculoId)}: ${d.lecturaInicial ?? "?"} → ${d.lecturaFinal ?? "?"} ${veh?.medidor === "horas" ? "h" : "km"}. Se excluye de los rendimientos.`,
        href: `/despachos/${d.id}`,
      });
    } else if (t.valida && t.cantidad != null && d.combustibleConsumidoL != null) {
      if (t.medidor === "km") {
        const l100 = (d.combustibleConsumidoL / t.cantidad) * 100;
        if (l100 > u.consumoMaxCamionL100km) {
          out.push({
            id: `con-${d.id}`,
            tipo: "consumo",
            severidad: "media",
            titulo: `Consumo alto en ${d.numero}`,
            detalle: `${nombreDe.vehiculo(data, d.vehiculoId)}: ${l100.toFixed(1).replace(".", ",")} L/100 km (umbral de demostración: ${u.consumoMaxCamionL100km}).`,
            href: `/despachos/${d.id}`,
          });
        }
      } else {
        const lh = d.combustibleConsumidoL / t.cantidad;
        if (lh > u.consumoMaxMaquinaLh) {
          out.push({
            id: `con-${d.id}`,
            tipo: "consumo",
            severidad: "media",
            titulo: `Consumo alto en ${d.numero}`,
            detalle: `${nombreDe.vehiculo(data, d.vehiculoId)}: ${lh.toFixed(1).replace(".", ",")} L/h (umbral de demostración: ${u.consumoMaxMaquinaLh}).`,
            href: `/despachos/${d.id}`,
          });
        }
      }
    }
    if (d.estado === "finalizado" && (t.motivo === "incompleta" || d.combustibleConsumidoL == null)) {
      incompletos.push(d.numero);
    }
  }
  if (incompletos.length > 0) {
    out.push({
      id: "incompletos",
      tipo: "incompleto",
      severidad: "media",
      titulo: `${incompletos.length} ${incompletos.length === 1 ? "despacho finalizado con datos incompletos" : "despachos finalizados con datos incompletos"}`,
      detalle: `Falta lectura o combustible: ${incompletos.slice(0, 6).join(", ")}${incompletos.length > 6 ? "…" : ""}. No entran en rendimientos.`,
      href: "/despachos",
    });
  }

  // 8) Vehículos que requieren revisión
  for (const v of data.vehiculos) {
    if (v.proximaRevision) {
      const dias = diffDays(hoy, v.proximaRevision);
      if (dias < 0) {
        out.push({
          id: `rev-${v.id}`,
          tipo: "revision",
          severidad: "alta",
          titulo: `${v.codigo}: revisión vencida`,
          detalle: `Estaba programada para el ${fecha(v.proximaRevision)} (hace ${-dias} ${-dias === 1 ? "día" : "días"}).`,
          href: "/admin/flota",
        });
      } else if (dias <= u.diasAvisoRevision) {
        out.push({
          id: `rev-${v.id}`,
          tipo: "revision",
          severidad: "media",
          titulo: `${v.codigo}: revisión próxima`,
          detalle: `Programada para el ${fecha(v.proximaRevision)} (en ${dias} ${dias === 1 ? "día" : "días"}).`,
          href: "/admin/flota",
        });
      }
    }
    if (v.estado === "en_mantenimiento" || v.estado === "fuera_de_servicio") {
      out.push({
        id: `est-${v.id}`,
        tipo: "revision",
        severidad: "baja",
        titulo: `${v.codigo}: ${v.estado === "en_mantenimiento" ? "en mantenimiento" : "fuera de servicio"}`,
        detalle: "No se asignará a nuevas entregas salvo excepción del administrador.",
        href: "/vehiculos",
      });
    }
  }

  // 9) Cobranza vencida (agrupado)
  let vencN = 0;
  let vencMonto = 0;
  for (const v of data.ventas) {
    if (estadoPagoVenta(data, v, hoy) === "vencida") {
      vencN++;
      vencMonto += totalesVenta(v).total - data.pagos.filter((p) => p.ventaId === v.id && !p.anulado).reduce((s, p) => s + p.monto, 0);
    }
  }
  if (vencN > 0) {
    out.push({
      id: "cobranza",
      tipo: "cobranza",
      severidad: "media",
      titulo: `${vencN} ${vencN === 1 ? "venta con pago vencido" : "ventas con pago vencido"}`,
      detalle: `Saldo vencido: ${clp(vencMonto)}.`,
      href: "/ventas?pago=vencida",
    });
  }

  // 10) Excesos autorizados
  for (const v of data.ventas) {
    if (!ventaValida(v)) continue;
    const ex = excesoVenta(data, v);
    if (ex > 0) {
      out.push({
        id: `exc-${v.id}`,
        tipo: "exceso",
        severidad: "baja",
        titulo: `${v.numero}: entregado sobre lo vendido`,
        detalle: `${m3(volumenEntregadoVenta(data, v.id))} entregados de ${m3(v.cantidadM3)} (exceso autorizado ${m3(ex)}).`,
        href: `/ventas/${v.id}`,
      });
    }
  }

  const peso = { alta: 0, media: 1, baja: 2 } as const;
  return out.sort((a, b) => peso[a.severidad] - peso[b.severidad]);
}
