"use client";
import { useState } from "react";
import Link from "next/link";
import { finalizarEntregaConductor, guardarAvanceConductor, informarIncidencia, iniciarEntrega, registrarInsumoConductor, eliminarInsumoConductor, type AvancePayload } from "@/lib/actions";
import { destinoDespacho, idx, nombreDe, trabajoDespacho, viajesDeDespacho, volumenEntregadoDespacho, volumenEntregadoVenta } from "@/lib/calc";
import { hoyISO } from "@/lib/fecha";
import { fecha, fechaHora, horas, km, litros, m3 } from "@/lib/formato";
import { lecturaPrevia } from "@/lib/validaciones";
import { useData, useUsuario } from "@/lib/store";
import { ETIQUETAS, type AppData, type Despacho, type TipoInsumo } from "@/lib/types";
import { Boton, EnlaceBoton, Tarjeta } from "@/components/ui/base";
import { cn } from "@/components/ui/cn";
import { AvisoPagina, EstadoVacio } from "@/components/ui/datos";
import { CampoNumero, CampoSelect, CampoTexto, CampoTextoLargo, Casilla, numATexto, parseNum } from "@/components/ui/form";
import { ChevronLeft, ChevronRight, CircleCheck, Plus, Save, Trash2, TriangleAlert } from "@/components/ui/icons";
import { ConfirmarDialogo, Modal, notificar } from "@/components/ui/overlay";
import { BadgeDespacho } from "@/components/Estados";
import { correr } from "@/components/acciones";

export function EntregaConductor({ despachoId }: { despachoId: string }) {
  const data = useData();
  const usuario = useUsuario();
  const [registroNuevo, setRegistroNuevo] = useState<string | null>(null);
  const d = idx(data).despachos.get(despachoId);

  if (!d) return <EstadoVacio titulo="No encontramos esta entrega" descripcion="Puede que la demostración se haya restaurado." accion={<EnlaceBoton href="/conductor" variante="primario">Volver a mis entregas</EnlaceBoton>} />;
  if (d.conductorId !== usuario?.id) return <AvisoPagina tono="alerta" titulo="Esta entrega no está asignada a ti" accion={<EnlaceBoton href="/conductor" variante="secundario">Volver</EnlaceBoton>}>Solo puedes registrar tus propias entregas.</AvisoPagina>;
  if (d.estado === "finalizado" || d.estado === "anulado") return <VistaCerrada data={data} d={d} registroNuevo={registroNuevo} />;
  return <Flujo key={d.id} data={data} d={d} onFinalizada={setRegistroNuevo} />;
}

/* ------------------------- Entrega ya cerrada ------------------------- */
function VistaCerrada({ data, d, registroNuevo }: { data: AppData; d: Despacho; registroNuevo: string | null }) {
  const veh = idx(data).vehiculos.get(d.vehiculoId);
  const t = trabajoDespacho(data, d);
  const reg = d.registroDiarioId ? data.registros.find((r) => r.id === d.registroDiarioId) : undefined;
  const viajes = viajesDeDespacho(data, d.id);
  return (
    <div className="space-y-4">
      {registroNuevo && (
        <div className="rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200" role="status">
          <CircleCheck className="mx-auto size-12 text-emerald-600" aria-hidden />
          <p className="mt-2 text-xl font-bold text-emerald-800">¡Entrega finalizada!</p>
          <p className="text-sm text-emerald-800">Quedó en el registro diario <strong>{registroNuevo}</strong>, pendiente de validación del supervisor.</p>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-navy-900">Entrega {d.numero}</h1>
        <BadgeDespacho estado={d.estado} />
      </div>
      {d.estado === "anulado" && <AvisoPagina tono="error" titulo="Entrega anulada">{d.motivoAnulacion ?? "Sin detalle."}</AvisoPagina>}
      <Tarjeta className="divide-y divide-slate-100 text-sm">
        <Fila e="Cliente" v={nombreDe.cliente(data, d.clienteId ?? (d.ventaId ? idx(data).ventas.get(d.ventaId)?.clienteId : undefined))} />
        <Fila e="Destino" v={destinoDespacho(data, d)} />
        <Fila e="Vehículo" v={nombreDe.vehiculo(data, d.vehiculoId)} />
        {d.tipo === "transporte" && <Fila e="Entregado" v={`${m3(volumenEntregadoDespacho(data, d.id))} en ${viajes.length} viaje(s)`} />}
        <Fila e={veh?.medidor === "horas" ? "Horas trabajadas" : "Km recorridos"} v={t.valida && t.cantidad != null ? (veh?.medidor === "horas" ? horas(t.cantidad) : km(t.cantidad, 1)) : "Sin datos suficientes"} />
        <Fila e="Combustible consumido" v={d.combustibleConsumidoL != null ? litros(d.combustibleConsumidoL) : "Sin dato"} />
        {d.conformidad && <Fila e="Conformidad" v={`${d.conformidad.nombre} · ${fechaHora(d.conformidad.fecha)}`} />}
        {reg && <Fila e="Registro diario" v={`${reg.numero} · ${ETIQUETAS.estadoRegistro[reg.estado]}`} />}
      </Tarjeta>
      {reg?.estado === "devuelto" && <AvisoPagina tono="alerta" titulo="El supervisor devolvió este registro">{[...reg.validaciones].reverse().find((v) => v.accion === "devuelto")?.comentario}. Avisa al administrador para reabrir la entrega y corregirla.</AvisoPagina>}
      <EnlaceBoton href="/conductor" variante="primario" tamano="xl" bloque>Volver a mis entregas</EnlaceBoton>
    </div>
  );
}

function Fila({ e, v }: { e: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <span className="text-slate-500">{e}</span>
      <span className="text-right font-medium text-slate-900">{v}</span>
    </div>
  );
}

/* ------------------------- Flujo de 3 pasos ------------------------- */
interface FilaViaje {
  key: string;
  id?: string;
  cant: string;
}

function Flujo({ data, d, onFinalizada }: { data: AppData; d: Despacho; onFinalizada: (n: string | null) => void }) {
  const usuario = useUsuario();
  const i = idx(data);
  const veh = i.vehiculos.get(d.vehiculoId);
  const venta = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
  const esTransporte = d.tipo === "transporte";
  const esHoras = veh?.medidor === "horas";
  const unidad = esHoras ? "h" : "km";
  const nombreMedidor = esHoras ? "Horómetro" : "Kilometraje";
  const hoy = hoyISO();

  const [paso, setPaso] = useState<1 | 2 | 3>(d.estado === "programado" ? 1 : 2);
  const [lecI, setLecI] = useState(numATexto(d.lecturaInicial ?? (d.estado === "programado" ? lecturaPrevia(data, d.vehiculoId, d.id) : undefined)));
  const [lecF, setLecF] = useState(numATexto(d.lecturaFinal));
  const [comb, setComb] = useState(numATexto(d.combustibleConsumidoL));
  const cargaPrevia = data.cargas.find((c) => c.despachoId === d.id);
  const [cargado, setCargado] = useState(numATexto(cargaPrevia?.litros));
  const [obs, setObs] = useState(d.observaciones ?? "");
  const [viajes, setViajes] = useState<FilaViaje[]>(() => viajesDeDespacho(data, d.id).map((v) => ({ key: v.id, id: v.id, cant: numATexto(v.cantidadM3) })));
  const [confirma, setConfirma] = useState(false);
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "finalizar" | "incidencia" | "insumo">(null);
  const [textoIncidencia, setTextoIncidencia] = useState("");
  const [errIncidencia, setErrIncidencia] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);

  const otras = data.despachos.filter((x) => x.conductorId === d.conductorId && x.id !== d.id && (x.estado === "programado" || x.estado === "en_curso" || x.estado === "incidencia")).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const insumos = data.insumos.filter((x) => x.creadoPor === d.conductorId && x.vehiculoId === d.vehiculoId && x.fecha === d.fecha);

  const totalViajes = viajes.reduce((s, v) => s + (parseNum(v.cant) ?? 0), 0);
  const restanteVenta = venta ? venta.cantidadM3 - (volumenEntregadoVenta(data, venta.id) - volumenEntregadoDespacho(data, d.id)) : null;

  const faltantes: { texto: string; campo: string }[] = [];
  if (esTransporte && !(viajes.length > 0 && viajes.every((v) => (parseNum(v.cant) ?? 0) > 0))) faltantes.push({ texto: viajes.length === 0 ? "Falta anotar los viajes realizados." : "Hay viajes sin volumen.", campo: "viajes" });
  if (parseNum(lecI) == null) faltantes.push({ texto: `Falta el ${nombreMedidor.toLowerCase()} inicial.`, campo: "lecturaInicial" });
  if (parseNum(lecF) == null) faltantes.push({ texto: `Falta el ${nombreMedidor.toLowerCase()} final.`, campo: "lecturaFinal" });
  else if (parseNum(lecI) != null && (parseNum(lecF) as number) <= (parseNum(lecI) as number)) faltantes.push({ texto: `El ${nombreMedidor.toLowerCase()} final debe ser mayor que el inicial.`, campo: "lecturaFinal" });
  if (parseNum(comb) == null) faltantes.push({ texto: "Falta anotar los litros consumidos (si no usaste, escribe 0).", campo: "combustibleConsumidoL" });

  function payload(extra: Partial<AvancePayload> = {}): AvancePayload {
    return {
      lecturaInicial: lecI.trim() === "" ? null : parseNum(lecI) ?? NaN,
      lecturaFinal: lecF.trim() === "" ? null : parseNum(lecF) ?? NaN,
      combustibleConsumidoL: comb.trim() === "" ? null : parseNum(comb) ?? NaN,
      combustibleCargadoL: cargado.trim() === "" ? 0 : parseNum(cargado) ?? NaN,
      viajes: esTransporte ? viajes.map((v) => ({ id: v.id, cantidadM3: parseNum(v.cant) ?? NaN })) : undefined,
      observaciones: obs,
      ...extra,
    };
  }

  function manejarError(r: { error: string; campo?: string }, irAlPaso = true) {
    setErrores(r.campo ? { [r.campo]: r.error } : {});
    setErrorGeneral(r.error);
    if (irAlPaso && r.campo && r.campo !== "confirma") setPaso(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function comenzar() {
    if (d.estado === "programado") {
      const r = correr((x, c) => iniciarEntrega(x, c, d.id), { silencioso: true });
      if (!r.ok) { manejarError(r, false); return; }
    }
    setErrorGeneral(null);
    setPaso(2);
    window.scrollTo({ top: 0 });
  }

  function guardarAvance() {
    setGuardando(true);
    const r = correr((x, c) => guardarAvanceConductor(x, c, d.id, payload()), { silencioso: true });
    setGuardando(false);
    if (r.ok) { setErrores({}); setErrorGeneral(null); notificar("exito", "Avance guardado. Puedes seguir después."); return; }
    manejarError(r, false);
  }

  function finalizar() {
    setModal(null);
    const r = correr((x, c) => finalizarEntregaConductor(x, c, d.id, payload({ confirmaNombre: confirma ? nombre : "" })), { silencioso: true });
    if (r.ok) { onFinalizada(r.numeroRegistro ?? null); window.scrollTo({ top: 0 }); return; }
    manejarError(r);
  }

  function enviarIncidencia() {
    const r = correr((x, c) => informarIncidencia(x, c, d.id, payload({ incidencia: textoIncidencia })), { silencioso: true });
    if (r.ok) { setModal(null); notificar("exito", "Incidencia informada al administrador."); return; }
    setErrIncidencia(r.error);
  }

  const pasos = ["Elegir entrega", "Registrar operación", "Revisar y finalizar"];

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-3 gap-1.5" aria-label="Pasos">
        {pasos.map((t, k) => {
          const n = (k + 1) as 1 | 2 | 3;
          const activo = paso === n;
          const hecho = paso > n;
          return (
            <li key={t}>
              <button type="button" onClick={() => (n === 1 || d.estado !== "programado" ? setPaso(n) : undefined)} disabled={d.estado === "programado" && n > 1} aria-current={activo ? "step" : undefined} className={cn("flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium leading-tight", activo ? "bg-brand-600 text-white" : hecho ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>
                <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-bold", activo ? "bg-white text-brand-700" : "bg-white/70")}>{hecho ? "✓" : n}</span>
                {t}
              </button>
            </li>
          );
        })}
      </ol>

      {errorGeneral && (
        <div role="alert" className="flex gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">No se pudo guardar</p>
            <p>{errorGeneral}</p>
          </div>
        </div>
      )}
      {d.estado === "incidencia" && <AvisoPagina tono="alerta" titulo="Incidencia informada">{d.incidencia}. Puedes seguir registrando cuando se resuelva.</AvisoPagina>}

      {paso === 1 && (
        <section className="space-y-3" aria-label="Elegir entrega">
          <Tarjeta className="border-accent-400 p-4 ring-2 ring-accent-200">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-slate-500">{d.numero} · {fecha(d.fecha)}</p>
                <p className="text-lg font-semibold text-navy-900">{nombreDe.cliente(data, d.clienteId ?? venta?.clienteId)}</p>
              </div>
              <BadgeDespacho estado={d.estado} />
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Fila e="Destino" v={destinoDespacho(data, d)} />
              <Fila e="Vehículo" v={nombreDe.vehiculo(data, d.vehiculoId)} />
              {esTransporte && <Fila e="Material" v={nombreDe.material(data, d.materialId ?? venta?.materialId)} />}
              {esTransporte && <Fila e="Volumen a entregar" v={m3(d.volumenSolicitadoM3)} />}
              {d.observaciones && <Fila e="Indicaciones" v={d.observaciones} />}
            </dl>
          </Tarjeta>
          <Boton variante="acento" tamano="xl" bloque onClick={comenzar}>{d.estado === "programado" ? "Comenzar esta entrega" : "Continuar"} <ChevronRight className="size-5" aria-hidden /></Boton>
          {otras.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-sm font-semibold text-slate-700">Otras entregas tuyas</p>
              <ul className="space-y-2">
                {otras.map((o) => (
                  <li key={o.id}>
                    <Link href={`/conductor/entrega/${o.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm active:bg-slate-50">
                      <span><strong>{o.numero}</strong> · {nombreDe.cliente(data, o.clienteId ?? (o.ventaId ? i.ventas.get(o.ventaId)?.clienteId : undefined))}</span>
                      <ChevronRight className="size-4 text-slate-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {paso === 2 && (
        <section className="space-y-4" aria-label="Registrar operación">
          <Tarjeta className="p-4">
            <h2 className="mb-3 text-base font-semibold text-navy-900">{nombreMedidor} del vehículo ({unidad})</h2>
            <div className="grid grid-cols-2 gap-3">
              <CampoNumero etiqueta="Inicial" unidad={unidad} value={lecI} onChange={(e) => setLecI(e.target.value)} error={errores.lecturaInicial} className="h-14 text-lg" />
              <CampoNumero etiqueta="Final" unidad={unidad} value={lecF} onChange={(e) => setLecF(e.target.value)} error={errores.lecturaFinal} className="h-14 text-lg" />
            </div>
            <p className="mt-2 text-xs text-slate-500">{esHoras ? "Esta máquina se mide en horas de horómetro, no en kilómetros." : "Anota el kilometraje del odómetro del camión."}</p>
          </Tarjeta>

          {esTransporte && (
            <Tarjeta className="p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-navy-900">Viajes realizados</h2>
                <p className="tabular text-sm text-slate-600">{m3(totalViajes)} de {m3(d.volumenSolicitadoM3)}</p>
              </div>
              {errores.viajes && <p role="alert" className="mb-2 text-sm font-medium text-red-600">{errores.viajes}</p>}
              <ul className="space-y-2">
                {viajes.map((v, k) => (
                  <li key={v.key} className="flex items-end gap-2">
                    <CampoNumero claseCampo="flex-1" etiqueta={`Viaje ${k + 1}`} unidad="m³" value={v.cant} onChange={(e) => setViajes((vs) => vs.map((x) => (x.key === v.key ? { ...x, cant: e.target.value } : x)))} className="h-14 text-lg" />
                    <Boton variante="secundario" tamano="lg" aria-label={`Quitar viaje ${k + 1}`} className="h-14 w-14 px-0 text-red-700" onClick={() => setViajes((vs) => vs.filter((x) => x.key !== v.key))}><Trash2 className="size-5" /></Boton>
                  </li>
                ))}
              </ul>
              {viajes.length === 0 && <p className="mb-2 text-sm text-slate-500">Aún no anotas viajes. Agrega uno cada vez que descargues.</p>}
              <Boton variante="secundario" tamano="xl" bloque className="mt-3" onClick={() => setViajes((vs) => [...vs, { key: `n-${Date.now()}-${vs.length}`, cant: numATexto(veh?.capacidadM3) }])}><Plus className="size-5" /> Agregar viaje{veh?.capacidadM3 ? ` (${veh.capacidadM3} m³)` : ""}</Boton>
              {restanteVenta != null && totalViajes > restanteVenta + 1e-9 && <p className="mt-2 text-sm font-medium text-amber-700">Ojo: con estos viajes se supera lo vendido (quedaban {m3(Math.max(0, restanteVenta))}).</p>}
            </Tarjeta>
          )}

          <Tarjeta className="p-4">
            <h2 className="mb-3 text-base font-semibold text-navy-900">Combustible</h2>
            <div className="grid gap-3">
              <CampoNumero etiqueta="Litros consumidos en esta entrega" unidad="L" obligatorio value={comb} onChange={(e) => setComb(e.target.value)} error={errores.combustibleConsumidoL} className="h-14 text-lg" ayuda="Lo que gastó el vehículo trabajando. Escríbelo tú: no se calcula." />
              <CampoNumero etiqueta="Litros cargados (si cargaste)" unidad="L" value={cargado} onChange={(e) => setCargado(e.target.value)} error={errores.combustibleCargadoL} className="h-14 text-lg" ayuda="Es aparte del consumo: lo que echaste al estanque." />
            </div>
          </Tarjeta>

          <Tarjeta className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-navy-900">Insumos de mantenimiento <span className="text-xs font-normal text-slate-500">(opcional)</span></h2>
              <Boton variante="secundario" tamano="sm" onClick={() => setModal("insumo")}><Plus className="size-4" /> Agregar</Boton>
            </div>
            {insumos.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {insumos.map((x) => (
                  <li key={x.id} className="flex items-center justify-between py-2">
                    <span>{ETIQUETAS.tipoInsumo[x.tipo]} · {x.cantidad} {x.unidad}</span>
                    <button type="button" aria-label="Quitar insumo" className="p-2 text-red-700" onClick={() => correr((dt, c) => eliminarInsumoConductor(dt, c, x.id), { exito: "Insumo quitado." })}><Trash2 className="size-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta className="p-4">
            <CampoTextoLargo etiqueta="Observaciones (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej.: acceso difícil, cliente solicitó cambio de hora…" />
          </Tarjeta>
        </section>
      )}

      {paso === 3 && (
        <section className="space-y-4" aria-label="Revisar y finalizar">
          {faltantes.length > 0 ? (
            <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200" role="status">
              <p className="font-semibold text-amber-900">Antes de finalizar falta:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {faltantes.map((f) => <li key={f.texto}>{f.texto}</li>)}
              </ul>
              <Boton variante="secundario" className="mt-3" onClick={() => setPaso(2)}><ChevronLeft className="size-4" /> Volver a completar</Boton>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200"><CircleCheck className="mr-1.5 inline size-4" aria-hidden />Todo listo para finalizar.</div>
          )}
          <Tarjeta className="divide-y divide-slate-100 text-sm">
            <Fila e="Cliente" v={nombreDe.cliente(data, d.clienteId ?? venta?.clienteId)} />
            <Fila e="Destino" v={destinoDespacho(data, d)} />
            {esTransporte && <Fila e="Viajes" v={`${viajes.length} · ${m3(totalViajes)}`} />}
            <Fila e={`${nombreMedidor} inicial → final`} v={`${lecI || "—"} → ${lecF || "—"} ${unidad}`} />
            <Fila e="Combustible consumido" v={comb.trim() ? `${comb} L` : "—"} />
            <Fila e="Combustible cargado" v={cargado.trim() ? `${cargado} L` : "No cargaste"} />
            {obs && <Fila e="Observaciones" v={obs} />}
          </Tarjeta>
          <Tarjeta className="space-y-3 p-4">
            <CampoTexto etiqueta="Tu nombre (queda como conformidad)" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-14 text-lg" error={errores.confirma} />
            <Casilla etiqueta="Confirmo que los datos son correctos" checked={confirma} onChange={(e) => setConfirma(e.target.checked)} />
            <p className="text-xs text-slate-500">Se guarda tu nombre y la hora ({fecha(hoy)}). No es una firma.</p>
          </Tarjeta>
          <Boton variante="exito" tamano="xl" bloque disabled={faltantes.length > 0 || !confirma || nombre.trim().length < 2} onClick={() => setModal("finalizar")}><CircleCheck className="size-6" /> Finalizar entrega</Boton>
          {(!confirma || nombre.trim().length < 2) && faltantes.length === 0 && <p className="text-center text-xs text-slate-500">Escribe tu nombre y marca la confirmación para finalizar.</p>}
        </section>
      )}

      {paso !== 1 && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" tamano="lg" onClick={() => { setPaso((paso - 1) as 1 | 2); window.scrollTo({ top: 0 }); }}><ChevronLeft className="size-5" /> Atrás</Boton>
            {paso === 2 ? <Boton tamano="lg" onClick={() => { setErrorGeneral(null); setPaso(3); window.scrollTo({ top: 0 }); }}>Revisar <ChevronRight className="size-5" /></Boton> : <Boton variante="secundario" tamano="lg" onClick={guardarAvance} cargando={guardando}><Save className="size-5" /> Guardar avance</Boton>}
          </div>
          {paso === 2 && <Boton variante="secundario" tamano="lg" bloque onClick={guardarAvance} cargando={guardando}><Save className="size-5" /> Guardar avance</Boton>}
          <Boton variante="fantasma" bloque className="text-red-700" onClick={() => { setErrIncidencia(undefined); setModal("incidencia"); }}><TriangleAlert className="size-4" /> Informar un problema o incidencia</Boton>
        </div>
      )}

      {modal === "finalizar" && (
        <ConfirmarDialogo
          titulo="¿Finalizar la entrega?"
          mensaje={<>Se cerrará <strong>{d.numero}</strong> y pasará al registro diario para validación. Después no podrás editarla; si te equivocas, avisa al administrador.</>}
          textoConfirmar="Sí, finalizar"
          onCancelar={() => setModal(null)}
          onConfirmar={finalizar}
        />
      )}
      {modal === "incidencia" && (
        <Modal titulo="Informar incidencia" descripcion="Cuéntanos qué pasó. El administrador será avisado y podrás seguir cuando se resuelva." onCerrar={() => setModal(null)} pie={<><Boton variante="secundario" onClick={() => setModal(null)}>Cancelar</Boton><Boton variante="peligro" onClick={enviarIncidencia}>Informar</Boton></>}>
          <CampoTextoLargo etiqueta="¿Qué pasó?" obligatorio value={textoIncidencia} onChange={(e) => setTextoIncidencia(e.target.value)} error={errIncidencia} placeholder="Ej.: camino cortado, falla mecánica, cliente no recibe…" />
        </Modal>
      )}
      {modal === "insumo" && <ModalInsumoConductor despachoId={d.id} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function ModalInsumoConductor({ despachoId, onCerrar }: { despachoId: string; onCerrar: () => void }) {
  const [tipo, setTipo] = useState<TipoInsumo>("aceite_motor");
  const [cant, setCant] = useState("");
  const [unidad, setUnidad] = useState<"L" | "kg" | "un">("L");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | undefined>();
  function guardar() {
    const r = correr((x, c) => registrarInsumoConductor(x, c, despachoId, { tipo, cantidad: parseNum(cant) ?? NaN, unidad, nota }), { silencioso: true });
    if (r.ok) { notificar("exito", "Insumo anotado."); onCerrar(); } else setError(r.error);
  }
  return (
    <Modal titulo="Agregar insumo" descripcion="Solo si usaste aceite, grasa, filtros u otro insumo." onCerrar={onCerrar} pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></>}>
      <div className="space-y-4">
        <CampoSelect etiqueta="Insumo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoInsumo)} className="h-12">
          {(Object.keys(ETIQUETAS.tipoInsumo) as TipoInsumo[]).map((t) => <option key={t} value={t}>{ETIQUETAS.tipoInsumo[t]}</option>)}
        </CampoSelect>
        <div className="grid grid-cols-2 gap-3">
          <CampoNumero etiqueta="Cantidad" value={cant} onChange={(e) => setCant(e.target.value)} error={error} className="h-12" />
          <CampoSelect etiqueta="Unidad" value={unidad} onChange={(e) => setUnidad(e.target.value as "L" | "kg" | "un")} className="h-12"><option value="L">Litros</option><option value="kg">Kilos</option><option value="un">Unidades</option></CampoSelect>
        </div>
        <CampoTexto etiqueta="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} className="h-12" />
      </div>
    </Modal>
  );
}
