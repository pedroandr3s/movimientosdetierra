import { destinoDespacho, idx, nombreDe, trabajoDespacho, viajesDeDespacho, volumenEntregadoDespacho } from "@/lib/calc";
import { hoyISO } from "@/lib/fecha";
import { fecha, fechaHora, horas, km, litros, m3 } from "@/lib/formato";
import { ETIQUETAS, type AppData, type Despacho } from "@/lib/types";

/**
 * Talonario imprimible del despacho. Es un comprobante INTERNO de la operación
 * (no un documento tributario). La conformidad se deja con nombre y fecha/hora,
 * sin firma simulada.
 */
export function Talonario({ data, d, className = "" }: { data: AppData; d: Despacho; className?: string }) {
  const i = idx(data);
  const venta = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
  const veh = i.vehiculos.get(d.vehiculoId);
  const e = data.config.empresa;
  const viajes = viajesDeDespacho(data, d.id);
  const todos = data.viajes.filter((v) => v.despachoId === d.id).sort((a, b) => a.secuencia - b.secuencia);
  const t = trabajoDespacho(data, d);
  const reg = d.registroDiarioId ? data.registros.find((r) => r.id === d.registroDiarioId) : undefined;
  const validador = reg?.validaciones.filter((v) => v.accion === "aprobado").at(-1);
  const medidor = veh?.medidor === "horas" ? "Horómetro (horas)" : "Odómetro (km)";
  const fmtLec = (n?: number) => (n == null ? "—" : veh?.medidor === "horas" ? horas(n) : km(n));
  const entregado = volumenEntregadoDespacho(data, d.id);

  return (
    <article className={`mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-6 text-[13px] text-slate-900 imprimir-sin-sombra sm:p-8 ${className}`} aria-label={`Talonario ${d.numero}`}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-navy-900 pb-4">
        <div>
          <p className="text-lg font-bold text-navy-900">{e.nombre}</p>
          <p className="text-xs text-slate-600">{e.giro}</p>
          <p className="text-xs text-slate-600">RUT {e.rut} · {e.direccion}</p>
          <p className="text-xs text-slate-600">{e.telefono} · {e.correo}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Talonario de despacho</p>
          <p className="text-xl font-bold tabular text-navy-900">{d.numero}</p>
          <p className="text-xs text-slate-600">Fecha: {fecha(d.fecha)}</p>
          <p className="text-xs text-slate-600">Estado: {ETIQUETAS.estadoDespacho[d.estado]}</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
        <Par e="Venta" v={venta?.numero ?? (d.tipo === "trabajo_maquinaria" ? "Trabajo de maquinaria (sin venta)" : "Sin venta asociada")} />
        <Par e="Cliente" v={nombreDe.cliente(data, d.clienteId ?? venta?.clienteId)} />
        <Par e="Destino / faena" v={destinoDespacho(data, d)} />
        <Par e="Material" v={d.tipo === "transporte" ? nombreDe.material(data, d.materialId ?? venta?.materialId) : "—"} />
        <Par e="Vehículo" v={`${nombreDe.vehiculo(data, d.vehiculoId)}${veh?.patente ? ` · ${veh.patente}` : ""}`} />
        <Par e="Conductor" v={nombreDe.usuario(data, d.conductorId)} />
        {d.tipo === "transporte" && <Par e="Volumen programado" v={m3(d.volumenSolicitadoM3)} />}
        {d.tipo === "transporte" && <Par e="Volumen entregado (viajes válidos)" v={<strong>{m3(entregado)}</strong>} />}
        {d.motivoIndependiente && <Par e="Motivo de la operación" v={d.motivoIndependiente} />}
      </section>

      {d.tipo === "transporte" && (
        <section className="mt-5">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Viajes</h3>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-slate-400 bg-slate-50 text-xs">
                <th className="px-2 py-1.5">N°</th>
                <th className="px-2 py-1.5">Fecha y hora</th>
                <th className="px-2 py-1.5">Destino</th>
                <th className="px-2 py-1.5 text-right">m³</th>
                <th className="px-2 py-1.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {todos.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-500">Sin viajes registrados.</td></tr>}
              {todos.map((v) => (
                <tr key={v.id} className={`border-b border-slate-200 ${v.estado === "anulado" ? "text-slate-400 line-through" : ""}`}>
                  <td className="px-2 py-1.5 tabular">{v.secuencia}</td>
                  <td className="px-2 py-1.5">{fechaHora(v.fechaHora)}</td>
                  <td className="px-2 py-1.5">{v.destino}</td>
                  <td className="px-2 py-1.5 text-right tabular">{m3(v.cantidadM3)}</td>
                  <td className="px-2 py-1.5">{v.estado === "anulado" ? "Anulado" : v.autorizadoExceso ? "Válido (exceso autorizado)" : "Válido"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-400 font-semibold">
                <td colSpan={3} className="px-2 py-1.5 text-right">Total de {viajes.length} {viajes.length === 1 ? "viaje válido" : "viajes válidos"}</td>
                <td className="px-2 py-1.5 text-right tabular">{m3(entregado)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2">
        <Par e={`${medidor} · inicial`} v={fmtLec(d.lecturaInicial)} />
        <Par e={`${medidor} · final`} v={fmtLec(d.lecturaFinal)} />
        <Par e={veh?.medidor === "horas" ? "Horas trabajadas" : "Kilómetros recorridos"} v={t.valida && t.cantidad != null ? (veh?.medidor === "horas" ? horas(t.cantidad) : km(t.cantidad, 1)) : "Sin dato válido"} />
        <Par e="Combustible consumido en la operación" v={d.combustibleConsumidoL != null ? litros(d.combustibleConsumidoL) : "Sin dato"} />
        <Par e="Inicio" v={d.horaInicio ? fechaHora(d.horaInicio) : "—"} />
        <Par e="Término" v={d.horaFin ? fechaHora(d.horaFin) : "—"} />
        <div className="col-span-2"><Par e="Observaciones" v={d.observaciones || "—"} /></div>
        {d.incidencia && <div className="col-span-2"><Par e="Incidencia" v={d.incidencia} /></div>}
      </section>

      <section className="mt-6 grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-300 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conformidad</p>
          {d.conformidad ? (
            <p className="mt-2">Registrada por <strong>{d.conformidad.nombre}</strong><br /><span className="text-xs text-slate-600">{fechaHora(d.conformidad.fecha)}</span></p>
          ) : (
            <p className="mt-2 text-slate-600">Pendiente de conformidad.</p>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Constancia electrónica por nombre y fecha/hora; no es firma manuscrita ni firma electrónica avanzada.</p>
        </div>
        <div className="rounded-lg border border-slate-300 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Validación del supervisor</p>
          {reg ? (
            <p className="mt-2">
              {reg.numero}: <strong>{ETIQUETAS.estadoRegistro[reg.estado]}</strong>
              {reg.estado === "validado" && validador && <><br /><span className="text-xs text-slate-600">{nombreDe.usuario(data, validador.userId)} · {fechaHora(validador.fecha)}</span></>}
            </p>
          ) : (
            <p className="mt-2 text-slate-600">Aún sin registro diario.</p>
          )}
        </div>
      </section>

      <footer className="mt-6 border-t border-slate-300 pt-2 text-[11px] text-slate-500">
        Documento interno de control operacional generado el {fecha(hoyISO())}. No constituye documento tributario. Datos de demostración.
      </footer>
    </article>
  );
}

function Par({ e, v }: { e: string; v: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{e}</p>
      <p className="text-sm">{v}</p>
    </div>
  );
}
