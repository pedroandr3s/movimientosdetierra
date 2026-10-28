import Link from "next/link";
import { destinoDespacho, idx, nombreDe, viajesDeDespacho, volumenEntregadoDespacho } from "@/lib/calc";
import { fecha, m3 } from "@/lib/formato";
import type { AppData, Despacho } from "@/lib/types";
import { BadgeDespacho } from "@/components/Estados";
import { ChevronRight, MapPin, Truck } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

/** Tarjeta grande y táctil de una entrega asignada al conductor. */
export function TarjetaEntrega({ data, d, hoy, destacada }: { data: AppData; d: Despacho; hoy: string; destacada?: boolean }) {
  const i = idx(data);
  const venta = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
  const atrasada = (d.estado === "programado" || d.estado === "en_curso") && d.fecha < hoy;
  const esTransporte = d.tipo === "transporte";
  return (
    <Link
      href={`/conductor/entrega/${d.id}`}
      className={cn(
        "block rounded-2xl border bg-white p-4 shadow-sm active:bg-slate-50",
        destacada ? "border-accent-400 ring-2 ring-accent-200" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-500">{d.numero} · {fecha(d.fecha)}{atrasada ? " · atrasada" : ""}</p>
          <p className="mt-0.5 text-lg font-semibold leading-snug text-navy-900">{nombreDe.cliente(data, d.clienteId ?? venta?.clienteId)}</p>
        </div>
        <BadgeDespacho estado={d.estado} />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-700"><MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />{destinoDespacho(data, d)}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
        <Truck className="size-4 shrink-0 text-slate-400" aria-hidden />
        {nombreDe.vehiculo(data, d.vehiculoId)}
        {esTransporte && <> · {nombreDe.material(data, d.materialId ?? venta?.materialId)} · <strong>{m3(d.volumenSolicitadoM3)}</strong></>}
        {!esTransporte && <> · trabajo de maquinaria</>}
      </p>
      {esTransporte && viajesDeDespacho(data, d.id).length > 0 && (
        <p className="mt-1 text-xs text-slate-500">Avance: {m3(volumenEntregadoDespacho(data, d.id))} en {viajesDeDespacho(data, d.id).length} viaje(s)</p>
      )}
      <p className="mt-3 flex items-center justify-end gap-1 text-sm font-semibold text-brand-600">
        {d.estado === "programado" ? "Comenzar" : d.estado === "finalizado" ? "Ver detalle" : "Continuar"} <ChevronRight className="size-4" aria-hidden />
      </p>
    </Link>
  );
}
