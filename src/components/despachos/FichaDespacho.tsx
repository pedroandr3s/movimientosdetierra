"use client";
import { useState } from "react";
import Link from "next/link";
import { anularDespacho, anularViaje, editarDespacho, reabrirDespacho, registrarViajeAdmin, type DespachoPatch } from "@/lib/actions";
import { destinoDespacho, idx, nombreDe, trabajoDespacho, viajesDeDespacho, volumenEntregadoDespacho } from "@/lib/calc";
import { hoyISO } from "@/lib/fecha";
import { fecha, fechaHora, horas, km, litros, m3 } from "@/lib/formato";
import { useData, useUsuario } from "@/lib/store";
import { ETIQUETAS, type Resultado, type Viaje } from "@/lib/types";
import { Boton, EncabezadoTarjeta, EnlaceBoton, Insignia, Tarjeta } from "@/components/ui/base";
import { AvisoPagina, EncabezadoPagina, EstadoVacio, ListaDatos, Pestanas, TablaDatos, type Columna } from "@/components/ui/datos";
import { CampoNumero, CampoSelect, CampoTexto, CampoTextoLargo, numATexto, parseNum } from "@/components/ui/form";
import { Ban, Pencil, Plus, Printer, RotateCcw } from "@/components/ui/icons";
import { ConfirmarDialogo, Modal, notificar } from "@/components/ui/overlay";
import { BadgeDespacho, BadgeRegistro } from "@/components/Estados";
import { correr } from "@/components/acciones";
import { Talonario } from "./Talonario";

type Vista = "ficha" | "talonario";
type ModalAbierto = null | "viaje" | "editar" | "anular" | "reabrir";

export function FichaDespacho({ despachoId }: { despachoId: string }) {
  const data = useData();
  const usuario = useUsuario();
  const i = idx(data);
  const d = i.despachos.get(despachoId);
  const [vista, setVista] = useState<Vista>("ficha");
  const [modal, setModal] = useState<ModalAbierto>(null);
  const [viajeAnular, setViajeAnular] = useState<Viaje | null>(null);

  const idsHistorial = new Set<string>([despachoId, ...data.viajes.filter((v) => v.despachoId === despachoId).map((v) => v.id)]);
  const historial = data.cambios.filter((c) => idsHistorial.has(c.entidadId)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));

  if (!d) return <EstadoVacio titulo="El despacho no existe" descripcion="Es posible que se haya restaurado la demostración." accion={<EnlaceBoton href="/despachos" variante="primario">Ir a despachos</EnlaceBoton>} />;
  const venta = d.ventaId ? i.ventas.get(d.ventaId) : undefined;
  if (usuario?.rol === "vendedor" && venta?.vendedorId !== usuario.id) {
    return <AvisoPagina tono="alerta" titulo="Este despacho no corresponde a tus ventas">Con tu rol solo puedes consultar despachos de tus propias ventas.</AvisoPagina>;
  }

  const esAdmin = usuario?.rol === "admin";
  const veh = i.vehiculos.get(d.vehiculoId);
  const todosViajes = data.viajes.filter((v) => v.despachoId === d.id).sort((a, b) => a.secuencia - b.secuencia);
  const validos = viajesDeDespacho(data, d.id);
  const entregado = volumenEntregadoDespacho(data, d.id);
  const t = trabajoDespacho(data, d);
  const reg = d.registroDiarioId ? data.registros.find((r) => r.id === d.registroDiarioId) : undefined;
  const esTransporte = d.tipo === "transporte";
  const puedeAnular = d.estado !== "anulado" && (esAdmin || (usuario?.rol === "vendedor" && d.estado === "programado" && todosViajes.length === 0));
  const unidad = veh?.medidor === "horas" ? "h" : "km";
  const fmtLec = (n?: number) => (n == null ? "—" : veh?.medidor === "horas" ? horas(n) : km(n));

  const colsViajes: Columna<Viaje>[] = [
    { clave: "n", titulo: "N°", celda: (v) => v.secuencia, alinear: "der" },
    { clave: "f", titulo: "Fecha y hora", celda: (v) => fechaHora(v.fechaHora) },
    { clave: "dest", titulo: "Destino", celda: (v) => v.destino, ocultarEnMovil: true },
    { clave: "m", titulo: "Volumen", alinear: "der", celda: (v) => <span className={v.estado === "anulado" ? "text-slate-400 line-through" : ""}>{m3(v.cantidadM3)}</span> },
    {
      clave: "e",
      titulo: "Estado",
      celda: (v) =>
        v.estado === "anulado" ? (
          <span className="flex flex-col items-start gap-1"><Insignia tono="gris">Anulado</Insignia>{v.motivoAnulacion && <span className="max-w-[14rem] whitespace-normal text-xs text-slate-500">Motivo: {v.motivoAnulacion}</span>}</span>
        ) : v.autorizadoExceso ? (
          <Insignia tono="amarillo">Válido · exceso autorizado</Insignia>
        ) : (
          <Insignia tono="verde">Válido</Insignia>
        ),
    },
    {
      clave: "acc",
      titulo: "",
      alinear: "der",
      celda: (v) =>
        v.estado === "valido" && esAdmin && d.estado !== "anulado" ? (
          <Boton tamano="sm" variante="fantasma" className="text-red-700" onClick={() => setViajeAnular(v)}>Anular</Boton>
        ) : null,
    },
  ];

  return (
    <>
      <div className="no-imprimir">
        <EncabezadoPagina
          migas={[{ href: "/despachos", texto: esAdmin ? "Despachos" : "Despachos de mis ventas" }, { texto: d.numero }]}
          titulo={`Despacho ${d.numero}`}
          descripcion={<span className="flex flex-wrap items-center gap-2"><BadgeDespacho estado={d.estado} /><span className="text-xs text-slate-500">{fecha(d.fecha)} · {esTransporte ? "Transporte de material" : "Trabajo de maquinaria"}</span></span>}
          acciones={
            <>
              <Boton variante="secundario" onClick={() => window.print()}><Printer className="size-4" /> Imprimir talonario</Boton>
              {esAdmin && esTransporte && d.estado !== "anulado" && <Boton onClick={() => setModal("viaje")}><Plus className="size-4" /> Agregar viaje</Boton>}
              {esAdmin && d.estado !== "anulado" && <Boton variante="secundario" onClick={() => setModal("editar")}><Pencil className="size-4" /> Editar</Boton>}
              {esAdmin && (d.estado === "finalizado" || d.estado === "incidencia") && <Boton variante="secundario" onClick={() => setModal("reabrir")}><RotateCcw className="size-4" /> Reabrir</Boton>}
              {puedeAnular && <Boton variante="secundario" className="text-red-700" onClick={() => setModal("anular")}><Ban className="size-4" /> Anular</Boton>}
            </>
          }
        />
        <Pestanas valor={vista} onCambiar={setVista} className="mb-4" opciones={[{ valor: "ficha", etiqueta: "Ficha de gestión" }, { valor: "talonario", etiqueta: "Talonario imprimible" }]} />
      </div>

      {vista === "talonario" ? (
        <Talonario data={data} d={d} />
      ) : (
        <>
          <Talonario data={data} d={d} className="solo-impresion" />
          <div className="no-imprimir">
            {d.estado === "anulado" && <div className="mb-4"><AvisoPagina tono="error" titulo="Despacho anulado">Motivo: {d.motivoAnulacion ?? "no indicado"}. Sus viajes no se cuentan como entregados.</AvisoPagina></div>}
            {d.estado === "incidencia" && <div className="mb-4"><AvisoPagina tono="alerta" titulo="Incidencia informada por el conductor">{d.incidencia ?? "Sin detalle."}</AvisoPagina></div>}

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <Tarjeta>
                  <EncabezadoTarjeta titulo="Datos del despacho" />
                  <div className="p-4 sm:p-5">
                    <ListaDatos
                      columnas={3}
                      items={[
                        { etiqueta: "Venta", valor: venta ? <Link className="text-brand-700 hover:underline" href={`/ventas/${venta.id}`}>{venta.numero}</Link> : "Sin venta asociada" },
                        { etiqueta: "Cliente", valor: nombreDe.cliente(data, d.clienteId ?? venta?.clienteId) },
                        { etiqueta: "Destino", valor: destinoDespacho(data, d) },
                        { etiqueta: "Material", valor: esTransporte ? nombreDe.material(data, d.materialId ?? venta?.materialId) : "—" },
                        { etiqueta: "Vehículo", valor: `${nombreDe.vehiculo(data, d.vehiculoId)}${veh?.patente ? ` · ${veh.patente}` : ""}` },
                        { etiqueta: "Conductor", valor: nombreDe.usuario(data, d.conductorId) },
                        { etiqueta: "Inicio", valor: d.horaInicio ? fechaHora(d.horaInicio) : "—" },
                        { etiqueta: "Término", valor: d.horaFin ? fechaHora(d.horaFin) : "—" },
                        { etiqueta: "Motivo (sin venta)", valor: d.motivoIndependiente ?? "—" },
                        { etiqueta: "Observaciones", valor: d.observaciones || "—" },
                      ]}
                    />
                  </div>
                </Tarjeta>

                {esTransporte && (
                  <Tarjeta>
                    <EncabezadoTarjeta titulo={`Viajes (${validos.length} válidos de ${todosViajes.length} registrados)`} subtitulo="El volumen entregado suma solo los viajes válidos." />
                    <div className="grid grid-cols-3 gap-3 border-b border-slate-100 p-4 sm:p-5">
                      <Dato e="Programado" v={m3(d.volumenSolicitadoM3)} />
                      <Dato e="Entregado" v={m3(entregado)} color="text-emerald-700" />
                      <Dato e="Viajes planificados" v={String(d.viajesPlanificados)} />
                    </div>
                    <TablaDatos columnas={colsViajes} filas={todosViajes} clave={(v) => v.id} tamanoPagina={10} ariaEtiqueta="Viajes del despacho" vacio={<EstadoVacio titulo="Sin viajes registrados" descripcion="Los viajes los registra el conductor al realizar la entrega, o el administrador manualmente." />} />
                  </Tarjeta>
                )}

                <Tarjeta>
                  <EncabezadoTarjeta titulo="Operación y combustible" subtitulo={veh?.medidor === "horas" ? "Esta máquina se mide en horas de horómetro." : "Este camión se mide en kilómetros de odómetro."} />
                  <div className="p-4 sm:p-5">
                    <ListaDatos
                      columnas={3}
                      items={[
                        { etiqueta: `Lectura inicial (${unidad})`, valor: fmtLec(d.lecturaInicial) },
                        { etiqueta: `Lectura final (${unidad})`, valor: fmtLec(d.lecturaFinal) },
                        { etiqueta: veh?.medidor === "horas" ? "Horas trabajadas" : "Km recorridos", valor: t.valida && t.cantidad != null ? (veh?.medidor === "horas" ? horas(t.cantidad) : km(t.cantidad, 1)) : <span className="text-slate-500">Sin datos suficientes{t.motivo === "anomala" ? " (lectura anómala)" : t.motivo === "inconsistente" ? " (lectura inconsistente)" : ""}</span> },
                        { etiqueta: "Combustible consumido", valor: d.combustibleConsumidoL != null ? litros(d.combustibleConsumidoL) : <span className="text-slate-500">Sin dato</span> },
                      ]}
                    />
                    <p className="mt-3 text-xs text-slate-500">El combustible consumido lo ingresa el conductor; nunca se deduce. Es distinto del combustible cargado.</p>
                  </div>
                </Tarjeta>
              </div>

              <div className="space-y-5">
                <Tarjeta>
                  <EncabezadoTarjeta titulo="Conformidad y validación" />
                  <div className="space-y-3 p-4 text-sm sm:p-5">
                    <div>
                      <p className="text-xs text-slate-500">Conformidad del conductor</p>
                      {d.conformidad ? <p><strong>{d.conformidad.nombre}</strong> · {fechaHora(d.conformidad.fecha)}</p> : <p className="text-slate-600">Pendiente</p>}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Registro diario</p>
                      {reg ? (
                        <p className="flex flex-wrap items-center gap-2"><Link className="text-brand-700 hover:underline" href={`/registros/${reg.id}`}>{reg.numero}</Link><BadgeRegistro estado={reg.estado} /></p>
                      ) : (
                        <p className="text-slate-600">Se crea al finalizar la entrega.</p>
                      )}
                    </div>
                  </div>
                </Tarjeta>
                <Tarjeta>
                  <EncabezadoTarjeta titulo="Historial" />
                  {historial.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">Sin cambios registrados.</p>
                  ) : (
                    <ol className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                      {historial.map((c) => (
                        <li key={c.id} className="px-4 py-3 text-sm">
                          <p className="font-medium text-slate-800">{c.accion}</p>
                          <p className="text-slate-600">{c.detalle}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{nombreDe.usuario(data, c.userId)} · {fechaHora(c.fecha)}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </Tarjeta>
              </div>
            </div>
          </div>
        </>
      )}

      {modal === "viaje" && <ModalViaje despachoId={d.id} onCerrar={() => setModal(null)} />}
      {modal === "editar" && <ModalEditar despachoId={d.id} onCerrar={() => setModal(null)} />}
      {modal === "anular" && (
        <ConfirmarDialogo
          peligro
          titulo={`Anular ${d.numero}`}
          mensaje={<>Se anulará el despacho{todosViajes.length > 0 ? <> y dejarán de contarse como entregados <strong>{m3(entregado)}</strong></> : null}. La venta recalculará su avance y el cambio quedará en el historial.</>}
          textoConfirmar="Anular despacho"
          pideMotivo={{ etiqueta: "Motivo de la anulación" }}
          onCancelar={() => setModal(null)}
          onConfirmar={(motivo) => { const r = correr((x, c) => anularDespacho(x, c, d.id, motivo), { exito: `${d.numero} anulado.` }); if (r.ok) setModal(null); }}
        />
      )}
      {modal === "reabrir" && (
        <ConfirmarDialogo
          titulo={`Reabrir ${d.numero}`}
          mensaje="El despacho volverá a «En curso» y, si su registro diario estaba validado, vuelve a pendiente de validación."
          textoConfirmar="Reabrir"
          pideMotivo={{ etiqueta: "Motivo de la reapertura" }}
          onCancelar={() => setModal(null)}
          onConfirmar={(motivo) => { const r = correr((x, c) => reabrirDespacho(x, c, d.id, motivo), { exito: `${d.numero} reabierto.` }); if (r.ok) setModal(null); }}
        />
      )}
      {viajeAnular && (
        <ConfirmarDialogo
          peligro
          titulo={`Anular viaje ${viajeAnular.secuencia}`}
          mensaje={<>El viaje de <strong>{m3(viajeAnular.cantidadM3)}</strong> dejará de contarse como entregado. Quedará visible, tachado, con su motivo.</>}
          textoConfirmar="Anular viaje"
          pideMotivo={{ etiqueta: "Motivo de la anulación" }}
          onCancelar={() => setViajeAnular(null)}
          onConfirmar={(motivo) => { const r = correr((x, c) => anularViaje(x, c, viajeAnular.id, motivo), { exito: "Viaje anulado y totales recalculados." }); if (r.ok) setViajeAnular(null); }}
        />
      )}
    </>
  );
}

function Dato({ e, v, color = "text-navy-900" }: { e: string; v: string; color?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{e}</dt>
      <dd className={`text-lg font-semibold tabular ${color}`}>{v}</dd>
    </div>
  );
}

/* ---------------- Agregar viaje manual (administrador) ---------------- */
function ModalViaje({ despachoId, onCerrar }: { despachoId: string; onCerrar: () => void }) {
  const data = useData();
  const d = idx(data).despachos.get(despachoId)!;
  const veh = idx(data).vehiculos.get(d.vehiculoId);
  const restante = Math.max(0, d.volumenSolicitadoM3 - volumenEntregadoDespacho(data, d.id));
  const [cant, setCant] = useState(numATexto(Math.min(veh?.capacidadM3 ?? restante, restante || (veh?.capacidadM3 ?? 0))));
  const [obs, setObs] = useState("");
  const [fh, setFh] = useState(`${hoyISO()}T${new Date().toTimeString().slice(0, 5)}`);
  const [error, setError] = useState<{ campo?: string; texto: string } | null>(null);
  const [exceso, setExceso] = useState<string | null>(null);

  function guardar(autorizarExceso?: boolean) {
    const n = parseNum(cant);
    const r: Resultado<{ id: string }> = correr((x, c) => registrarViajeAdmin(x, c, d.id, { cantidadM3: n ?? NaN, fechaHora: fh, observaciones: obs }, { autorizarExceso }), { silencioso: true });
    if (r.ok) { notificar("exito", "Viaje agregado."); onCerrar(); return; }
    if (r.codigo === "exceso") { setExceso(r.error); return; }
    setExceso(null);
    setError({ campo: r.campo, texto: r.error });
  }

  return (
    <>
      <Modal titulo={`Agregar viaje a ${d.numero}`} descripcion="Úsalo para completar un viaje que el conductor no alcanzó a registrar." onCerrar={onCerrar} pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={() => guardar()}>Agregar viaje</Boton></>}>
        <div className="space-y-4">
          {error && !error.campo && <AvisoPagina tono="error">{error.texto}</AvisoPagina>}
          <CampoNumero etiqueta="Volumen del viaje" unidad="m³" obligatorio value={cant} onChange={(e) => setCant(e.target.value)} error={error?.campo === "cantidadM3" ? error.texto : undefined} ayuda={veh?.capacidadM3 ? `Capacidad de ${veh.codigo}: ${m3(veh.capacidadM3, 0)}.` : undefined} />
          <CampoTexto etiqueta="Fecha y hora" type="datetime-local" value={fh} onChange={(e) => setFh(e.target.value)} />
          <CampoTextoLargo etiqueta="Observaciones (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
      </Modal>
      {exceso && (
        <ConfirmarDialogo
          peligro
          titulo="Volumen sobre lo pendiente"
          mensaje={<>{exceso}<p className="mt-2 font-medium">¿Autorizas explícitamente este exceso? Quedará marcado en el viaje y en el historial.</p></>}
          textoConfirmar="Autorizar exceso"
          onCancelar={() => setExceso(null)}
          onConfirmar={() => { setExceso(null); guardar(true); }}
        />
      )}
    </>
  );
}

/* ---------------- Editar despacho (administrador) ---------------- */
function ModalEditar({ despachoId, onCerrar }: { despachoId: string; onCerrar: () => void }) {
  const data = useData();
  const i = idx(data);
  const d = i.despachos.get(despachoId)!;
  const reg = d.registroDiarioId ? data.registros.find((r) => r.id === d.registroDiarioId) : undefined;
  const validado = reg?.estado === "validado";
  const [f, setF] = useState({
    fecha: d.fecha,
    vehiculoId: d.vehiculoId,
    conductorId: d.conductorId,
    volumen: numATexto(d.volumenSolicitadoM3),
    viajes: String(d.viajesPlanificados),
    li: d.lecturaInicial != null ? numATexto(d.lecturaInicial) : "",
    lf: d.lecturaFinal != null ? numATexto(d.lecturaFinal) : "",
    comb: d.combustibleConsumidoL != null ? numATexto(d.combustibleConsumidoL) : "",
    obs: d.observaciones ?? "",
    motivo: "",
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [excepcion, setExcepcion] = useState<{ codigo: "exceso" | "vehiculo"; mensaje: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const esTransporte = d.tipo === "transporte";

  function guardar(op: { autorizarExceso?: boolean; autorizarVehiculo?: boolean } = {}) {
    const num = (t: string) => (t.trim() === "" ? null : parseNum(t));
    const patch: DespachoPatch = {
      fecha: f.fecha,
      vehiculoId: f.vehiculoId,
      conductorId: f.conductorId,
      volumenSolicitadoM3: esTransporte ? parseNum(f.volumen) ?? NaN : undefined,
      viajesPlanificados: esTransporte ? parseNum(f.viajes) ?? d.viajesPlanificados : undefined,
      lecturaInicial: num(f.li),
      lecturaFinal: num(f.lf),
      combustibleConsumidoL: num(f.comb),
      observaciones: f.obs,
    };
    const r = correr((x, c) => editarDespacho(x, c, d.id, patch, { ...op, motivo: f.motivo }), { silencioso: true });
    if (r.ok) { notificar("exito", `${d.numero} actualizado.`); onCerrar(); return; }
    setGeneral(null);
    if (r.codigo === "exceso" || r.codigo === "vehiculo") { setExcepcion({ codigo: r.codigo, mensaje: r.error }); return; }
    if (r.campo) setErrores({ [r.campo]: r.error }); else { setErrores({}); setGeneral(r.error); }
  }

  const vehiculos = data.vehiculos.filter((v) => (esTransporte ? v.tipo !== "maquinaria" : true));
  return (
    <>
      <Modal titulo={`Editar ${d.numero}`} ancho="lg" onCerrar={onCerrar} pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={() => guardar()}>Guardar cambios</Boton></>}>
        <div className="space-y-4">
          {general && <AvisoPagina tono="error">{general}</AvisoPagina>}
          {validado && <AvisoPagina tono="alerta" titulo="Registro ya validado">Este despacho pertenece a {reg?.numero}, que ya fue validado. El cambio exige un motivo y devuelve el registro a «pendiente».</AvisoPagina>}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto etiqueta="Fecha" type="date" value={f.fecha} onChange={set("fecha")} error={errores.fecha} />
            <CampoSelect etiqueta="Vehículo" value={f.vehiculoId} onChange={set("vehiculoId")} error={errores.vehiculoId}>
              {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.codigo}{v.estado !== "disponible" && v.estado !== "en_operacion" ? ` (${ETIQUETAS.estadoVehiculo[v.estado]})` : ""}</option>)}
            </CampoSelect>
            <CampoSelect etiqueta="Conductor" value={f.conductorId} onChange={set("conductorId")} error={errores.conductorId}>
              {data.usuarios.filter((u) => u.rol === "conductor").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </CampoSelect>
            {esTransporte && <CampoNumero etiqueta="Volumen programado" unidad="m³" value={f.volumen} onChange={set("volumen")} error={errores.volumenSolicitadoM3} />}
            {esTransporte && <CampoNumero etiqueta="Viajes planificados" value={f.viajes} onChange={set("viajes")} error={errores.viajesPlanificados} />}
            <CampoNumero etiqueta="Lectura inicial" unidad={i.vehiculos.get(f.vehiculoId)?.medidor === "horas" ? "h" : "km"} value={f.li} onChange={set("li")} error={errores.lecturaInicial} />
            <CampoNumero etiqueta="Lectura final" unidad={i.vehiculos.get(f.vehiculoId)?.medidor === "horas" ? "h" : "km"} value={f.lf} onChange={set("lf")} error={errores.lecturaFinal} />
            <CampoNumero etiqueta="Combustible consumido" unidad="L" value={f.comb} onChange={set("comb")} error={errores.combustibleConsumidoL} ayuda="Déjalo vacío si no hay dato; no se estima." />
            <CampoTextoLargo claseCampo="sm:col-span-2" etiqueta="Observaciones" value={f.obs} onChange={set("obs")} />
            <CampoTextoLargo claseCampo="sm:col-span-2" etiqueta={validado ? "Motivo de la corrección (obligatorio)" : "Motivo del cambio (opcional)"} obligatorio={validado} value={f.motivo} onChange={set("motivo")} error={errores.motivo} />
          </div>
        </div>
      </Modal>
      {excepcion && (
        <ConfirmarDialogo
          peligro
          titulo={excepcion.codigo === "exceso" ? "Volumen sobre lo pendiente" : "Vehículo no disponible"}
          mensaje={<>{excepcion.mensaje}<p className="mt-2 font-medium">¿Autorizas explícitamente esta excepción? Quedará registrada.</p></>}
          textoConfirmar="Autorizar y guardar"
          onCancelar={() => setExcepcion(null)}
          onConfirmar={() => { const c = excepcion.codigo; setExcepcion(null); guardar({ autorizarExceso: c === "exceso" || undefined, autorizarVehiculo: c === "vehiculo" || undefined }); }}
        />
      )}
    </>
  );
}
