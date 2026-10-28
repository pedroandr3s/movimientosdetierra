"use client";
import { volumenEntregadoDespacho } from "@/lib/calc";
import { hoyISO } from "@/lib/fecha";
import { fechaLarga, m3 } from "@/lib/formato";
import { useData, useUsuario } from "@/lib/store";
import { EstadoVacio } from "@/components/ui/datos";
import { ClipboardList } from "@/components/ui/icons";
import { TarjetaEntrega } from "./ComunesConductor";

export function HistorialConductor() {
  const data = useData();
  const usuario = useUsuario();
  const hoy = hoyISO();
  if (!usuario) return null;
  const hechas = data.despachos.filter((d) => d.conductorId === usuario.id && (d.estado === "finalizado" || d.estado === "anulado")).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero));
  const porDia = new Map<string, typeof hechas>();
  for (const d of hechas) porDia.set(d.fecha, [...(porDia.get(d.fecha) ?? []), d]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy-900">Mi historial</h1>
      {hechas.length === 0 ? (
        <EstadoVacio icono={<ClipboardList className="size-6" />} titulo="Aún no tienes entregas finalizadas" descripcion="Tus entregas terminadas aparecerán aquí." />
      ) : (
        [...porDia.entries()].map(([dia, ds]) => (
          <section key={dia} className="space-y-3" aria-label={fechaLarga(dia)}>
            <h2 className="flex items-baseline justify-between text-sm font-semibold text-slate-700 first-letter:uppercase">
              <span>{fechaLarga(dia)}</span>
              <span className="tabular text-xs font-normal text-slate-500">{m3(ds.reduce((s, d) => s + volumenEntregadoDespacho(data, d.id), 0))} entregados</span>
            </h2>
            {ds.map((d) => <TarjetaEntrega key={d.id} data={data} d={d} hoy={hoy} />)}
          </section>
        ))
      )}
    </div>
  );
}
