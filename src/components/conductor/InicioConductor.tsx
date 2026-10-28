"use client";
import { ultimaLectura } from "@/lib/calc";
import { hoyISO } from "@/lib/fecha";
import { fechaLarga, horas, km } from "@/lib/formato";
import { useData, useUsuario } from "@/lib/store";
import { EnlaceBoton, Tarjeta } from "@/components/ui/base";
import { EstadoVacio } from "@/components/ui/datos";
import { Truck } from "@/components/ui/icons";
import { TarjetaEntrega } from "./ComunesConductor";

export function InicioConductor() {
  const data = useData();
  const usuario = useUsuario();
  const hoy = hoyISO();
  if (!usuario) return null;
  const mias = data.despachos.filter((d) => d.conductorId === usuario.id);
  const enCurso = mias.filter((d) => d.estado === "en_curso" || d.estado === "incidencia");
  const pendientes = mias.filter((d) => d.estado === "programado" && d.fecha <= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
  const proximas = mias.filter((d) => d.estado === "programado" && d.fecha > hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const recientes = mias.filter((d) => d.estado === "finalizado").sort((a, b) => (b.horaFin ?? b.fecha).localeCompare(a.horaFin ?? a.fecha)).slice(0, 3);
  const veh = data.vehiculos.find((v) => v.conductorHabitualId === usuario.id);
  const principal = enCurso[0] ?? pendientes[0];
  const nombre = usuario.nombre.split(" ")[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Hola, {nombre}</h1>
        <p className="text-sm text-slate-600 first-letter:uppercase">{fechaLarga(hoy)}</p>
      </div>

      {veh && (
        <Tarjeta className="flex items-center gap-3 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Truck className="size-6" aria-hidden /></span>
          <div className="min-w-0">
            <p className="font-semibold text-navy-900">{veh.codigo}{veh.patente ? ` · ${veh.patente}` : ""}</p>
            <p className="text-sm text-slate-600">Última lectura: {veh.medidor === "horas" ? `${horas(ultimaLectura(data, veh.id))}` : km(ultimaLectura(data, veh.id))}</p>
          </div>
        </Tarjeta>
      )}

      {principal ? (
        <EnlaceBoton href={`/conductor/entrega/${principal.id}`} variante="acento" tamano="xl" bloque>
          {principal.estado === "programado" ? "Registrar entrega" : "Continuar entrega en curso"}
        </EnlaceBoton>
      ) : null}

      {enCurso.length > 0 && (
        <section aria-labelledby="h-curso" className="space-y-3">
          <h2 id="h-curso" className="text-base font-semibold text-navy-900">En curso</h2>
          {enCurso.map((d) => <TarjetaEntrega key={d.id} data={data} d={d} hoy={hoy} destacada />)}
        </section>
      )}

      <section aria-labelledby="h-pend" className="space-y-3">
        <h2 id="h-pend" className="text-base font-semibold text-navy-900">Pendientes de hoy y atrasadas ({pendientes.length})</h2>
        {pendientes.length === 0 ? (
          <EstadoVacio titulo="No tienes entregas pendientes" descripcion="Cuando el administrador te asigne una entrega aparecerá aquí." />
        ) : (
          pendientes.map((d) => <TarjetaEntrega key={d.id} data={data} d={d} hoy={hoy} />)
        )}
      </section>

      {proximas.length > 0 && (
        <section aria-labelledby="h-prox" className="space-y-3">
          <h2 id="h-prox" className="text-base font-semibold text-navy-900">Próximos días</h2>
          {proximas.map((d) => <TarjetaEntrega key={d.id} data={data} d={d} hoy={hoy} />)}
        </section>
      )}

      {recientes.length > 0 && (
        <section aria-labelledby="h-rec" className="space-y-3">
          <h2 id="h-rec" className="text-base font-semibold text-navy-900">Finalizadas recientemente</h2>
          {recientes.map((d) => <TarjetaEntrega key={d.id} data={data} d={d} hoy={hoy} />)}
          <EnlaceBoton href="/conductor/historial" variante="secundario" bloque>Ver todo el historial</EnlaceBoton>
        </section>
      )}
    </div>
  );
}
