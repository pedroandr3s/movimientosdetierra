"use client";
import { useState } from "react";
import Link from "next/link";
import { devolverRegistro, guardarObservacionRegistro, validarRegistro } from "@/lib/actions";
import { despachosDeRegistro, idx, nombreDe, totalesRegistro, trabajoDespacho, viajesDeDespacho, volumenEntregadoDespacho } from "@/lib/calc";
import { fecha, fechaHora, horas, km, litros, m3 } from "@/lib/formato";
import { can } from "@/lib/permisos";
import { useData, useUsuario } from "@/lib/store";
import { ETIQUETAS, type Despacho } from "@/lib/types";
import { Boton, EncabezadoTarjeta, EnlaceBoton, Insignia, Tarjeta } from "@/components/ui/base";
import { AvisoPagina, EncabezadoPagina, EstadoVacio, ListaDatos, TablaDatos, type Columna } from "@/components/ui/datos";
import { CampoTextoLargo } from "@/components/ui/form";
import { CircleCheck, Printer, RotateCcw } from "@/components/ui/icons";
import { ConfirmarDialogo, notificar } from "@/components/ui/overlay";
import { BadgeDespacho, BadgeRegistro } from "@/components/Estados";
import { correr } from "@/components/acciones";

export function FichaRegistro({ registroId }: { registroId: string }) {
  const data = useData();
  const usuario = useUsuario();
  const i = idx(data);
  const r = data.registros.find((x) => x.id === registroId);
  const [modal, setModal] = useState<null | "devolver" | "incompleto" | "validar">(null);
  const [editando, setEditando] = useState(false);
  const [obs, setObs] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errMotivo, setErrMotivo] = useState<string | undefined>();

  if (!r) return <EstadoVacio titulo="El registro no existe" accion={<EnlaceBoton href="/registros" variante="primario">Ir a registros</EnlaceBoton>} />;
  const puedeValidar = can(usuario?.rol, "registros.validar");
  const ds = despachosDeRegistro(data, r.id);
  const t = totalesRegistro(data, r.id);
  const veh = i.vehiculos.get(r.vehiculoId);
  const insumos = data.insumos.filter((x) => x.registroDiarioId === r.id || (!x.registroDiarioId && x.vehiculoId === r.vehiculoId && x.fecha === r.fecha));
  const validado = r.estado === "validado";

  const cols: Columna<Despacho>[] = [
    { clave: "n", titulo: "Despacho", celda: (d) => <Link className="font-medium text-brand-700 hover:underline" href={`/despachos/${d.id}`}>{d.numero}</Link> },
    { clave: "v", titulo: "Venta", celda: (d) => (d.ventaId ? i.ventas.get(d.ventaId)?.numero : "Sin venta"), ocultarEnMovil: true },
    { clave: "viajes", titulo: "Viajes", alinear: "der", celda: (d) => viajesDeDespacho(data, d.id).length },
    { clave: "m", titulo: "Entregado", alinear: "der", celda: (d) => (d.tipo === "transporte" ? m3(volumenEntregadoDespacho(data, d.id)) : "—") },
    { clave: "med", titulo: "Km / horas", alinear: "der", celda: (d) => { const w = trabajoDespacho(data, d); return w.valida && w.cantidad != null ? (w.medidor === "km" ? km(w.cantidad, 1) : horas(w.cantidad)) : <span className="text-amber-700">Sin dato</span>; } },
    { clave: "c", titulo: "Consumido", alinear: "der", celda: (d) => (d.combustibleConsumidoL != null ? litros(d.combustibleConsumidoL) : <span className="text-amber-700">Sin dato</span>) },
    { clave: "e", titulo: "Estado", celda: (d) => <BadgeDespacho estado={d.estado} /> },
  ];

  function validar(aceptarIncompleto?: boolean) {
    const res = correr((x, c) => validarRegistro(x, c, r!.id, { aceptarIncompleto }), { silencioso: true });
    if (res.ok) { setModal(null); notificar("exito", `${r!.numero} validado.`); return; }
    if (res.codigo === "incompleto") { setModal("incompleto"); return; }
    setModal(null);
    notificar("error", res.error);
  }
  function guardarObs() {
    if (validado && motivo.trim().length < 5) { setErrMotivo("Indica quién cambia y por qué (mín. 5 caracteres)."); return; }
    const res = correr((x, c) => guardarObservacionRegistro(x, c, r!.id, obs, validado ? motivo : undefined), { exito: validado ? "Observación corregida; el registro vuelve a pendiente." : "Observaciones guardadas." });
    if (res.ok) { setEditando(false); setMotivo(""); setErrMotivo(undefined); }
  }

  return (
    <>
      <div className="no-imprimir">
        <EncabezadoPagina
          migas={[{ href: "/registros", texto: "Registro diario" }, { texto: r.numero }]}
          titulo={`Registro ${r.numero}`}
          descripcion={<span className="flex flex-wrap items-center gap-2"><BadgeRegistro estado={r.estado} /><span className="text-xs text-slate-500">{fecha(r.fecha)} · {nombreDe.usuario(data, r.conductorId)} · {nombreDe.vehiculo(data, r.vehiculoId)}</span></span>}
          acciones={
            <>
              <Boton variante="secundario" onClick={() => window.print()}><Printer className="size-4" /> Imprimir</Boton>
              {puedeValidar && !validado && <Boton variante="secundario" onClick={() => setModal("devolver")}><RotateCcw className="size-4" /> Devolver</Boton>}
              {puedeValidar && !validado && <Boton variante="exito" onClick={() => validar()}><CircleCheck className="size-4" /> Validar registro</Boton>}
            </>
          }
        />
      </div>

      <div className="mb-4 hidden print:block">
        <p className="text-lg font-bold text-navy-900">{data.config.empresa.nombre} — Registro diario {r.numero}</p>
        <p className="text-sm text-slate-600">{fecha(r.fecha)} · {nombreDe.usuario(data, r.conductorId)} · {nombreDe.vehiculo(data, r.vehiculoId)} · Estado: {ETIQUETAS.estadoRegistro[r.estado]}</p>
      </div>

      {r.estado === "devuelto" && <div className="mb-4"><AvisoPagina tono="alerta" titulo="Devuelto al conductor">{[...r.validaciones].reverse().find((v) => v.accion === "devuelto")?.comentario ?? "Pendiente de corrección."}</AvisoPagina></div>}
      {!t.completo && ds.length > 0 && <div className="mb-4"><AvisoPagina tono="alerta" titulo="Datos incompletos">Alguna operación no tiene lectura válida o combustible consumido. Esas operaciones se excluyen de los rendimientos (L/100 km y L/h).</AvisoPagina></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Totales del día" subtitulo="Calculados desde las operaciones vinculadas: no hay datos duplicados." />
            <div className="p-4 sm:p-5">
              <ListaDatos columnas={3} items={[
                { etiqueta: "Viajes válidos", valor: t.viajes },
                { etiqueta: "Volumen entregado", valor: m3(t.volumen) },
                { etiqueta: "Materiales", valor: t.materiales.join(", ") || "—" },
                { etiqueta: veh?.medidor === "horas" ? "Horas trabajadas" : "Km recorridos", valor: veh?.medidor === "horas" ? (t.horas > 0 ? horas(t.horas) : "Sin datos suficientes") : t.km > 0 ? km(t.km, 1) : "Sin datos suficientes" },
                { etiqueta: "Combustible consumido", valor: t.litrosConsumidos > 0 ? litros(t.litrosConsumidos) : "Sin dato" },
                { etiqueta: "Combustible cargado (del día)", valor: t.litrosCargados > 0 ? litros(t.litrosCargados) : "Sin cargas" },
              ]} />
              <p className="mt-3 text-xs text-slate-500">Combustible cargado y consumido son datos distintos: el consumo lo ingresa el conductor y la carga se registra aparte.</p>
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo={`Operaciones (${ds.length})`} />
            <TablaDatos columnas={cols} filas={ds} clave={(d) => d.id} ariaEtiqueta="Operaciones del registro" vacio={<EstadoVacio titulo="Sin operaciones activas" descripcion="Todas las operaciones de este registro fueron anuladas." />} />
          </Tarjeta>

          {insumos.length > 0 && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Insumos de mantenimiento informados" />
              <ul className="divide-y divide-slate-100 text-sm">
                {insumos.map((x) => <li key={x.id} className="flex justify-between px-4 py-2.5"><span>{ETIQUETAS.tipoInsumo[x.tipo]}{x.nota ? ` · ${x.nota}` : ""}</span><span className="tabular">{x.cantidad} {x.unidad}</span></li>)}
              </ul>
            </Tarjeta>
          )}

          <Tarjeta>
            <EncabezadoTarjeta titulo="Observaciones del supervisor" acciones={puedeValidar && !editando ? <Boton tamano="sm" variante="secundario" className="no-imprimir" onClick={() => { setObs(r.observaciones ?? ""); setEditando(true); }}>Editar</Boton> : undefined} />
            <div className="p-4 sm:p-5">
              {editando ? (
                <div className="space-y-3">
                  <CampoTextoLargo etiqueta="Observaciones" value={obs} onChange={(e) => setObs(e.target.value)} />
                  {validado && <CampoTextoLargo etiqueta="Quién cambia y por qué (obligatorio: el registro está validado)" obligatorio value={motivo} onChange={(e) => setMotivo(e.target.value)} error={errMotivo} />}
                  <div className="flex gap-2"><Boton onClick={guardarObs}>Guardar</Boton><Boton variante="fantasma" onClick={() => { setEditando(false); setErrMotivo(undefined); }}>Cancelar</Boton></div>
                </div>
              ) : (
                <p className="text-sm text-slate-700">{r.observaciones || "Sin observaciones."}</p>
              )}
            </div>
          </Tarjeta>
        </div>

        <aside className="space-y-5">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Historial de validación" />
            {r.validaciones.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Aún no se ha validado ni devuelto.</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {[...r.validaciones].reverse().map((v) => (
                  <li key={v.id} className="px-4 py-3 text-sm">
                    <p className="flex items-center gap-2 font-medium capitalize text-slate-800">
                      <Insignia tono={v.accion === "aprobado" ? "verde" : v.accion === "devuelto" ? "rojo" : "amarillo"}>{v.accion}</Insignia>
                    </p>
                    {v.comentario && <p className="mt-1 text-slate-600">{v.comentario}</p>}
                    <p className="mt-0.5 text-xs text-slate-500">{nombreDe.usuario(data, v.userId)} · {fechaHora(v.fecha)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>
        </aside>
      </div>

      {modal === "devolver" && (
        <ConfirmarDialogo
          titulo={`Devolver ${r.numero}`}
          mensaje="El conductor verá el comentario y deberá corregir la información."
          textoConfirmar="Devolver al conductor"
          pideMotivo={{ etiqueta: "¿Qué debe corregir?" }}
          onCancelar={() => setModal(null)}
          onConfirmar={(c) => { const res = correr((x, ctx) => devolverRegistro(x, ctx, r.id, c), { exito: `${r.numero} devuelto al conductor.` }); if (res.ok) setModal(null); }}
        />
      )}
      {modal === "incompleto" && (
        <ConfirmarDialogo
          peligro
          titulo="Registro con datos incompletos"
          mensaje="Hay operaciones sin lectura válida o sin combustible consumido. Si validas, quedarán excluidas de los rendimientos y se mostrará «Sin datos suficientes». ¿Validar de todas formas?"
          textoConfirmar="Validar de todas formas"
          onCancelar={() => setModal(null)}
          onConfirmar={() => validar(true)}
        />
      )}
    </>
  );
}
