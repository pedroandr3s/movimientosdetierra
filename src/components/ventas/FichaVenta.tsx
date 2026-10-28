"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { anularPago, anularVenta, confirmarVenta, puedeEditarVenta, registrarPago } from "@/lib/actions";
import {
  cobradoVenta, destinoVenta, estadoComercialVenta, estadoPagoVenta, excesoVenta, idx, nombreDe, saldoVenta, totalesVenta, viajesDeDespacho, volumenEntregadoDespacho,
  volumenEntregadoVenta, volumenPendienteVenta,
} from "@/lib/calc";
import { hoyISO } from "@/lib/fecha";
import { clp, fecha, fechaHora, m3, num } from "@/lib/formato";
import { can } from "@/lib/permisos";
import { contexto, useData, useUsuario } from "@/lib/store";
import type { Despacho } from "@/lib/types";
import { Boton, EncabezadoTarjeta, EnlaceBoton, Insignia, Tarjeta } from "@/components/ui/base";
import { AvisoPagina, EncabezadoPagina, EstadoVacio, ListaDatos, TablaDatos, type Columna } from "@/components/ui/datos";
import { CampoNumero, CampoSelect, CampoTexto, parseNum } from "@/components/ui/form";
import { Ban, Banknote, CircleCheck, Pencil, Printer, Truck } from "@/components/ui/icons";
import { ConfirmarDialogo, Modal, notificar } from "@/components/ui/overlay";
import { BadgeComercial, BadgeDespacho, BadgePago } from "@/components/Estados";
import { correr } from "@/components/acciones";

export function FichaVenta({ ventaId }: { ventaId: string }) {
  const data = useData();
  const usuario = useUsuario();
  const router = useRouter();
  const hoy = hoyISO();
  const i = idx(data);
  const v = i.ventas.get(ventaId);
  const [modal, setModal] = useState<null | "pago" | "anular" | "confirmar">(null);
  const [pagoAnular, setPagoAnular] = useState<string | null>(null);

  const despachos = useMemo(() => (v ? [...(i.despachosPorVenta.get(v.id) ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero)) : []), [i, v]);
  const pagos = useMemo(() => (v ? [...(i.pagosPorVenta.get(v.id) ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id)) : []), [i, v]);
  const historial = useMemo(() => {
    if (!v) return [];
    const ids = new Set<string>([v.id, ...despachos.map((d) => d.id), ...pagos.map((p) => p.id)]);
    return data.cambios.filter((c) => ids.has(c.entidadId)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  }, [data.cambios, v, despachos, pagos]);

  if (!v) return <EstadoVacio titulo="La venta no existe" descripcion="Es posible que se haya restaurado la demostración. Vuelve al listado." accion={<EnlaceBoton href="/ventas" variante="primario">Ir a ventas</EnlaceBoton>} />;
  if (usuario?.rol === "vendedor" && v.vendedorId !== usuario.id) {
    return <AvisoPagina tono="alerta" titulo="Esta venta pertenece a otro vendedor">Con tu rol solo puedes consultar tus propias ventas.</AvisoPagina>;
  }

  const t = totalesVenta(v);
  const estado = estadoComercialVenta(data, v);
  const estadoPago = estadoPagoVenta(data, v, hoy);
  const entregado = volumenEntregadoVenta(data, v.id);
  const pendiente = volumenPendienteVenta(data, v);
  const exceso = excesoVenta(data, v);
  const cobrado = cobradoVenta(data, v.id);
  const saldo = saldoVenta(data, v);
  const enCurso = despachos.filter((d) => ["programado", "en_curso", "incidencia"].includes(d.estado)).reduce((s, d) => s + Math.max(0, d.volumenSolicitadoM3 - volumenEntregadoDespacho(data, d.id)), 0);
  const ctx = contexto();
  const editable = ctx ? puedeEditarVenta(data, ctx, v) === null : false;
  const esDuenoOAdmin = usuario?.rol === "admin" || v.vendedorId === usuario?.id;
  const material = i.materiales.get(v.materialId);
  const dif = v.precioReferencia ? ((v.precioUnitario - v.precioReferencia) / v.precioReferencia) * 100 : 0;
  const pct = (x: number) => (v.cantidadM3 > 0 ? Math.min(100, (x / v.cantidadM3) * 100) : 0);
  const metodo = (id: string) => data.config.metodosPago.find((m) => m.id === id)?.label ?? id;

  const colsDesp: Columna<Despacho>[] = [
    { clave: "n", titulo: "Despacho", celda: (d) => <span className="font-medium text-brand-700">{d.numero}</span> },
    { clave: "f", titulo: "Fecha", celda: (d) => fecha(d.fecha) },
    { clave: "v", titulo: "Vehículo", celda: (d) => nombreDe.vehiculo(data, d.vehiculoId) },
    { clave: "c", titulo: "Conductor", celda: (d) => nombreDe.usuario(data, d.conductorId), ocultarEnMovil: true },
    { clave: "s", titulo: "Solicitado", alinear: "der", celda: (d) => m3(d.volumenSolicitadoM3) },
    { clave: "e", titulo: "Entregado", alinear: "der", celda: (d) => m3(volumenEntregadoDespacho(data, d.id)) },
    { clave: "vj", titulo: "Viajes", alinear: "der", celda: (d) => `${viajesDeDespacho(data, d.id).length} / ${d.viajesPlanificados}` },
    { clave: "st", titulo: "Estado", celda: (d) => <BadgeDespacho estado={d.estado} /> },
  ];

  return (
    <>
      <EncabezadoPagina
        migas={[{ href: "/ventas", texto: usuario?.rol === "admin" ? "Ventas" : "Mis ventas" }, { texto: v.numero }]}
        titulo={`Venta ${v.numero}`}
        descripcion={<span className="flex flex-wrap items-center gap-2"><BadgeComercial estado={estado} /><BadgePago estado={estadoPago} /><span className="text-xs text-slate-500">{fecha(v.fecha)} · registro interno, no tributario</span></span>}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => window.print()}><Printer className="size-4" /> Imprimir</Boton>
            {editable && <EnlaceBoton href={`/ventas/${v.id}/editar`}><Pencil className="size-4" /> Editar</EnlaceBoton>}
            {v.estado === "borrador" && esDuenoOAdmin && <Boton variante="exito" onClick={() => setModal("confirmar")}><CircleCheck className="size-4" /> Confirmar venta</Boton>}
            {v.estado === "confirmada" && saldo > 0 && can(usuario?.rol, "pagos.registrar") && <Boton onClick={() => setModal("pago")}><Banknote className="size-4" /> Registrar abono</Boton>}
            {v.estado === "confirmada" && pendiente > 0 && can(usuario?.rol, "despachos.crear") && <EnlaceBoton href={`/despachos/nuevo?venta=${v.id}`} variante="acento"><Truck className="size-4" /> Programar despacho</EnlaceBoton>}
            {v.estado !== "anulada" && can(usuario?.rol, "ventas.anular") && esDuenoOAdmin && <Boton variante="secundario" onClick={() => setModal("anular")} className="text-red-700"><Ban className="size-4" /> Anular</Boton>}
          </>
        }
      />

      {v.estado === "anulada" && <div className="mb-4"><AvisoPagina tono="error" titulo="Venta anulada">Motivo: {v.motivoAnulacion ?? "no indicado"}. No se contabiliza en ventas, entregas ni cobranza.</AvisoPagina></div>}
      {v.estado === "borrador" && <div className="mb-4"><AvisoPagina tono="info" titulo="Borrador">Aún no cuenta en los indicadores ni permite despachos o pagos. Confírmala para activarla.</AvisoPagina></div>}
      {exceso > 0 && <div className="mb-4"><AvisoPagina tono="alerta" titulo={`Entregado sobre lo vendido: ${m3(exceso)}`}>Se registró volumen adicional con autorización explícita del administrador.</AvisoPagina></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Datos de la venta" />
            <div className="p-4 sm:p-5">
              <ListaDatos
                columnas={3}
                items={[
                  { etiqueta: "Cliente", valor: can(usuario?.rol, "catalogos.ver_clientes") ? <Link className="text-brand-700 hover:underline" href={`/clientes/${v.clienteId}`}>{nombreDe.cliente(data, v.clienteId)}</Link> : nombreDe.cliente(data, v.clienteId) },
                  { etiqueta: "Contacto", valor: [v.contactoNombre, v.contactoTelefono].filter(Boolean).join(" · ") || "—" },
                  { etiqueta: "Vendedor", valor: nombreDe.usuario(data, v.vendedorId) },
                  { etiqueta: "Faena / destino", valor: destinoVenta(data, v) },
                  { etiqueta: "Material", valor: material?.nombre ?? "—" },
                  { etiqueta: "Entrega prevista", valor: fecha(v.fechaEntregaPrevista) },
                  { etiqueta: "Método de pago", valor: metodo(v.metodoPago) },
                  { etiqueta: "Vencimiento del pago", valor: v.fechaVencimiento ? fecha(v.fechaVencimiento) : "Sin vencimiento" },
                  { etiqueta: "Registrada por", valor: `${nombreDe.usuario(data, v.creadoPor)} · ${fechaHora(v.creadoEn)}` },
                  { etiqueta: "Observaciones", valor: v.observaciones || "—" },
                ]}
              />
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Avance de la entrega" subtitulo="El volumen entregado es la suma de los viajes válidos de todos los despachos." />
            <div className="space-y-4 p-4 sm:p-5">
              <div role="img" aria-label={`Entregado ${m3(entregado)} de ${m3(v.cantidadM3)}`} className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-emerald-500" style={{ width: `${pct(entregado)}%` }} />
                <div className="bg-accent-400" style={{ width: `${Math.min(pct(enCurso), 100 - pct(entregado))}%` }} />
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Dato e="Solicitado" v={m3(v.cantidadM3)} />
                <Dato e="Entregado" v={m3(entregado)} color="text-emerald-700" />
                <Dato e="Por entregar en despachos activos" v={m3(enCurso)} color="text-accent-700" />
                <Dato e="Pendiente de entrega" v={m3(pendiente)} />
              </dl>
              <p className="text-xs text-slate-500">Una venta solo figura como «Entregada» cuando el volumen acumulado de viajes válidos alcanza lo vendido.</p>
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo={`Despachos (${despachos.length})`} acciones={v.estado === "confirmada" && pendiente > 0 && can(usuario?.rol, "despachos.crear") ? <EnlaceBoton href={`/despachos/nuevo?venta=${v.id}`} tamano="sm" variante="secundario">Programar</EnlaceBoton> : undefined} />
            <TablaDatos
              columnas={colsDesp}
              filas={despachos}
              clave={(d) => d.id}
              alHacerClic={(d) => router.push(`/despachos/${d.id}`)}
              vacio={<EstadoVacio icono={<Truck className="size-6" />} titulo="Sin despachos aún" descripcion={v.estado === "confirmada" ? "Programa un despacho para comenzar la entrega." : "Solo las ventas confirmadas pueden despacharse."} />}
            />
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo={`Pagos (${pagos.filter((p) => !p.anulado).length})`} subtitulo="Cada abono es un movimiento separado; el saldo se calcula a partir de ellos." />
            {pagos.length === 0 ? (
              <EstadoVacio icono={<Banknote className="size-6" />} titulo="Sin pagos registrados" descripcion="El material entregado no implica que la venta esté pagada." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-sm">
                  <thead><tr className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-2.5 text-left font-semibold">Fecha</th><th className="px-3 py-2.5 text-right font-semibold">Monto</th><th className="px-3 py-2.5 text-left font-semibold">Método</th><th className="px-3 py-2.5 text-left font-semibold">Nota</th><th className="px-3 py-2.5 text-left font-semibold">Registró</th><th className="px-3 py-2.5" />
                  </tr></thead>
                  <tbody>
                    {pagos.map((p) => (
                      <tr key={p.id} className={`border-b border-slate-100 last:border-0 ${p.anulado ? "text-slate-400 line-through" : ""}`}>
                        <td className="px-3 py-2.5">{fecha(p.fecha)}</td>
                        <td className="tabular px-3 py-2.5 text-right font-medium">{clp(p.monto)}</td>
                        <td className="px-3 py-2.5">{metodo(p.metodo)}</td>
                        <td className="px-3 py-2.5">{p.anulado ? <span className="no-underline">Anulado: {p.motivoAnulacion}</span> : p.nota ?? "—"}</td>
                        <td className="px-3 py-2.5">{nombreDe.usuario(data, p.creadoPor)}</td>
                        <td className="px-3 py-2.5 text-right">{!p.anulado && can(usuario?.rol, "pagos.anular") && <button type="button" onClick={() => setPagoAnular(p.id)} className="text-xs font-medium text-red-600 hover:underline">Anular</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        </div>

        <aside className="space-y-5">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Importes" />
            <dl className="space-y-2 p-4 text-sm sm:p-5">
              <Linea e="Cantidad" v={m3(v.cantidadM3)} />
              <Linea e="Precio neto por m³" v={clp(v.precioUnitario)} />
              <Linea e="Precio de referencia (al vender)" v={clp(v.precioReferencia)} suave />
              {Math.abs(dif) > 0.05 && <Linea e="Diferencia pactada" v={`${dif > 0 ? "+" : ""}${num(dif, 1)} %`} suave />}
              <hr className="border-slate-100" />
              <Linea e="Subtotal bruto" v={clp(t.brutoSinDescuento)} />
              {t.descuento > 0 && <Linea e={`Descuento (${num(v.descuentoPct, 1)} %)`} v={`− ${clp(t.descuento)}`} />}
              <Linea e="Subtotal neto" v={clp(t.neto)} />
              <Linea e={`IVA (${num(v.ivaPct, 1)} %)`} v={clp(t.iva)} />
              <div className="flex items-baseline justify-between rounded-lg bg-navy-900 px-3 py-2.5 text-white"><span>Total con IVA</span><span className="tabular text-lg font-semibold">{clp(t.total)}</span></div>
              {v.estado === "confirmada" && (
                <>
                  <Linea e="Cobrado" v={clp(cobrado)} />
                  <div className="flex items-baseline justify-between"><dt className="font-medium text-slate-800">Saldo pendiente</dt><dd className={`tabular text-base font-semibold ${saldo > 0 ? "text-accent-700" : "text-emerald-700"}`}>{clp(saldo)}</dd></div>
                </>
              )}
            </dl>
          </Tarjeta>
          <Tarjeta>
            <EncabezadoTarjeta titulo="Historial de cambios" subtitulo="Venta, despachos y pagos asociados" />
            {historial.length === 0 ? <p className="p-4 text-sm text-slate-500">Sin movimientos registrados.</p> : (
              <ol className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {historial.map((c) => (
                  <li key={c.id} className="px-4 py-2.5 text-sm sm:px-5">
                    <div className="flex items-center justify-between gap-2"><Insignia tono="gris">{c.accion}</Insignia><span className="text-[11px] text-slate-500">{fechaHora(c.fecha)}</span></div>
                    <p className="mt-1 text-slate-800">{c.detalle}</p>
                    <p className="text-xs text-slate-500">{nombreDe.usuario(data, c.userId)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>
        </aside>
      </div>

      {modal === "pago" && <ModalAbono ventaId={v.id} saldo={saldo} metodoInicial={v.metodoPago} fechaMin={v.fecha} onCerrar={() => setModal(null)} />}
      {modal === "anular" && (
        <ConfirmarDialogo peligro titulo={`Anular ${v.numero}`} mensaje="La venta quedará anulada y no contará en indicadores. Se conserva el historial. No se puede anular con entregas o pagos registrados." textoConfirmar="Anular venta" pideMotivo={{ etiqueta: "Motivo de la anulación" }} onCancelar={() => setModal(null)}
          onConfirmar={(m) => { const r = correr((d, c) => anularVenta(d, c, v.id, m), { exito: "Venta anulada." }); if (r.ok) setModal(null); }} />
      )}
      {modal === "confirmar" && (
        <ConfirmarDialogo titulo={`Confirmar ${v.numero}`} mensaje="Al confirmar, la venta cuenta en los indicadores y podrá despacharse y cobrarse." textoConfirmar="Confirmar venta" onCancelar={() => setModal(null)}
          onConfirmar={() => { const r = correr((d, c) => confirmarVenta(d, c, v.id), { exito: "Venta confirmada." }); if (r.ok) setModal(null); }} />
      )}
      {pagoAnular && (
        <ConfirmarDialogo peligro titulo="Anular pago" mensaje="El pago se marcará como anulado (no se borra) y el saldo de la venta se recalculará." textoConfirmar="Anular pago" pideMotivo={{ etiqueta: "Motivo de la anulación" }} onCancelar={() => setPagoAnular(null)}
          onConfirmar={(m) => { const r = correr((d, c) => anularPago(d, c, pagoAnular, m), { exito: "Pago anulado." }); if (r.ok) setPagoAnular(null); }} />
      )}
    </>
  );
}

function Dato({ e, v, color }: { e: string; v: string; color?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs text-slate-600">{e}</dt>
      <dd className={`tabular mt-0.5 text-lg font-semibold ${color ?? "text-navy-900"}`}>{v}</dd>
    </div>
  );
}
function Linea({ e, v, suave }: { e: string; v: string; suave?: boolean }) {
  return (
    <div className="flex justify-between gap-3"><dt className={suave ? "text-slate-500" : "text-slate-700"}>{e}</dt><dd className={`tabular text-right ${suave ? "text-slate-500" : "font-medium text-slate-900"}`}>{v}</dd></div>
  );
}

function ModalAbono({ ventaId, saldo, metodoInicial, fechaMin, onCerrar }: { ventaId: string; saldo: number; metodoInicial: string; fechaMin: string; onCerrar: () => void }) {
  const data = useData();
  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [metodo, setMetodo] = useState(metodoInicial);
  const [nota, setNota] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  function guardar() {
    const n = parseNum(monto);
    if (n == null) { setErr({ monto: "Escribe el monto del abono." }); return; }
    const r = correr((d, c) => registrarPago(d, c, ventaId, { monto: n, fecha: fechaPago, metodo, nota }), { silencioso: true });
    if (!r.ok) { setErr({ [r.campo ?? "monto"]: r.error }); return; }
    notificar("exito", `Abono de ${clp(n)} registrado.`);
    onCerrar();
  }
  return (
    <Modal titulo="Registrar abono" descripcion={`Saldo pendiente: ${clp(saldo)}`} onCerrar={onCerrar} pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Registrar abono</Boton></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CampoNumero etiqueta="Monto" unidad="CLP" obligatorio value={monto} onChange={(e) => setMonto(e.target.value)} error={err.monto} autoFocus />
          <button type="button" className="mt-1.5 text-xs font-medium text-brand-600 hover:underline" onClick={() => setMonto(String(saldo))}>Pagar el saldo completo ({clp(saldo)})</button>
        </div>
        <CampoTexto etiqueta="Fecha del pago" type="date" obligatorio value={fechaPago} min={fechaMin} max={hoyISO()} onChange={(e) => setFechaPago(e.target.value)} error={err.fecha} />
        <CampoSelect etiqueta="Método" value={metodo} onChange={(e) => setMetodo(e.target.value)} error={err.metodo}>
          {data.config.metodosPago.filter((m) => m.activo || m.id === metodo).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </CampoSelect>
        <CampoTexto claseCampo="sm:col-span-2" etiqueta="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
    </Modal>
  );
}

