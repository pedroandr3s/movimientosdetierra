"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { crearVenta, editarVenta, registrarPago } from "@/lib/actions";
import { idx, totalesVenta } from "@/lib/calc";
import { hoyISO, siguienteHabil } from "@/lib/fecha";
import { clp, fecha, num } from "@/lib/formato";
import { useData, useUsuario } from "@/lib/store";
import { can } from "@/lib/permisos";
import { vencimientoPorDefecto, type VentaInput } from "@/lib/validaciones";
import { Boton, Tarjeta, EncabezadoTarjeta, Cargando } from "@/components/ui/base";
import { AvisoPagina, EncabezadoPagina, EstadoVacio } from "@/components/ui/datos";
import { CampoNumero, CampoSelect, CampoTexto, CampoTextoLargo, numATexto, parseNum } from "@/components/ui/form";
import { Plus, Save } from "@/components/ui/icons";
import { notificar } from "@/components/ui/overlay";
import { ClienteRapido } from "@/components/ClienteRapido";
import { correr } from "@/components/acciones";
import { puedeEditarVenta } from "@/lib/actions";
import { contexto } from "@/lib/store";

type Errores = Record<string, string>;

/** Formulario de alta y edición de ventas. Los totales se recalculan en tiempo real. */
function clienteDeUrl(data: { clientes: { id: string; activo: boolean }[] }): string {
  if (typeof window === "undefined") return "";
  const id = new URLSearchParams(window.location.search).get("cliente") ?? "";
  return data.clientes.some((c) => c.id === id && c.activo) ? id : "";
}

export function FormularioVenta({ ventaId }: { ventaId?: string }) {
  const data = useData();
  const usuario = useUsuario();
  const router = useRouter();
  const hoy = hoyISO();
  const i = idx(data);
  const existente = ventaId ? i.ventas.get(ventaId) : undefined;
  const esAdmin = usuario?.rol === "admin";

  const [f, setF] = useState(() => {
    const v = existente;
    const metodoInicial = v?.metodoPago ?? (data.config.metodosPago.find((m) => m.activo)?.id ?? "");
    return {
      clienteId: v?.clienteId ?? clienteDeUrl(data),
      vendedorId: v?.vendedorId ?? usuario?.id ?? "",
      contactoNombre: v?.contactoNombre ?? "",
      contactoTelefono: v?.contactoTelefono ?? "",
      faenaId: v ? (v.faenaId ?? "") : "",
      referenciaFaena: v?.referenciaFaena ?? "",
      materialId: v?.materialId ?? "",
      cantidad: v ? numATexto(v.cantidadM3) : "",
      precio: v ? numATexto(v.precioUnitario) : "",
      descuento: v ? numATexto(v.descuentoPct) : "0",
      metodoPago: metodoInicial,
      fechaEntrega: v?.fechaEntregaPrevista ?? siguienteHabil(hoy),
      fechaVenc: v ? (v.fechaVencimiento ?? "") : (vencimientoPorDefecto(data, metodoInicial, hoy) ?? ""),
      observaciones: v?.observaciones ?? "",
      abono: "",
    };
  });
  const [vencTocado, setVencTocado] = useState(!!existente);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const entrada = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value);

  const material = f.materialId ? i.materiales.get(f.materialId) : undefined;
  const refPrecio = existente && existente.materialId === f.materialId ? existente.precioReferencia : material?.precioReferencia;
  const ivaPct = existente?.ivaPct ?? data.config.ivaPct;
  const t = totalesVenta({ cantidadM3: parseNum(f.cantidad) ?? 0, precioUnitario: parseNum(f.precio) ?? 0, descuentoPct: parseNum(f.descuento) ?? 0, ivaPct });

  const clientes = data.clientes.filter((c) => c.activo || c.id === f.clienteId);
  const faenasCliente = useMemo(() => data.faenas.filter((x) => x.activo && x.clienteId === f.clienteId), [data.faenas, f.clienteId]);
  const otrasFaenas = useMemo(() => data.faenas.filter((x) => x.activo && x.clienteId !== f.clienteId), [data.faenas, f.clienteId]);
  const metodos = data.config.metodosPago.filter((m) => m.activo || m.id === f.metodoPago);
  const vendedores = data.usuarios.filter((u) => (u.rol === "vendedor" || u.rol === "admin") && u.activo);

  if (ventaId && !existente) return <EstadoVacio titulo="La venta no existe" descripcion="Es posible que haya sido eliminada al restaurar los datos." />;
  const ctx = contexto();
  if (existente && ctx) {
    const bloqueo = puedeEditarVenta(data, ctx, existente);
    if (bloqueo) {
      return (
        <>
          <EncabezadoPagina titulo={`Editar ${existente.numero}`} migas={[{ href: "/ventas", texto: "Ventas" }, { href: `/ventas/${existente.id}`, texto: existente.numero }, { texto: "Editar" }]} />
          <AvisoPagina tono="alerta" titulo="No puedes editar esta venta">{bloqueo}</AvisoPagina>
        </>
      );
    }
  }
  if (!usuario) return <Cargando />;
  if (!existente && !can(usuario.rol, "ventas.crear")) return <AvisoPagina tono="alerta" titulo="Sin permiso">Tu rol no permite registrar ventas.</AvisoPagina>;

  function alCambiarCliente(id: string) {
    const propias = data.faenas.filter((x) => x.activo && x.clienteId === id);
    setF((s) => ({ ...s, clienteId: id, faenaId: propias.length && !propias.some((x) => x.id === s.faenaId) ? propias[0].id : s.faenaId }));
  }
  function alCambiarMaterial(id: string) {
    const m = i.materiales.get(id);
    setF((s) => ({ ...s, materialId: id, precio: m && (!existente || existente.materialId !== id) ? numATexto(m.precioReferencia) : existente && existente.materialId === id ? numATexto(existente.precioUnitario) : s.precio }));
  }
  function alCambiarMetodo(id: string) {
    setF((s) => ({ ...s, metodoPago: id, fechaVenc: vencTocado ? s.fechaVenc : (vencimientoPorDefecto(data, id, existente?.fecha ?? hoy) ?? "") }));
  }

  function enviar(estado: "borrador" | "confirmada") {
    setGuardando(true);
    setErrorGeneral(null);
    const cant = parseNum(f.cantidad);
    const precio = parseNum(f.precio);
    const desc = parseNum(f.descuento) ?? 0;
    const errs: Errores = {};
    if (f.cantidad.trim() && cant == null) errs.cantidadM3 = "Escribe un número válido (por ejemplo 12,5).";
    if (f.precio.trim() && precio == null) errs.precioUnitario = "Escribe un número válido.";
    if (f.descuento.trim() && parseNum(f.descuento) == null) errs.descuentoPct = "Escribe un número válido.";
    const abono = parseNum(f.abono);
    if (f.abono.trim() && abono == null) errs.abono = "Escribe un monto válido.";
    if (Object.keys(errs).length) {
      setErrores(errs);
      setGuardando(false);
      return;
    }
    const input: VentaInput = {
      clienteId: f.clienteId,
      vendedorId: esAdmin ? f.vendedorId : undefined,
      contactoNombre: f.contactoNombre,
      contactoTelefono: f.contactoTelefono,
      faenaId: f.faenaId || undefined,
      referenciaFaena: f.faenaId ? undefined : f.referenciaFaena,
      materialId: f.materialId,
      cantidadM3: cant ?? NaN,
      precioUnitario: precio ?? NaN,
      descuentoPct: desc,
      metodoPago: f.metodoPago,
      fechaEntregaPrevista: f.fechaEntrega,
      fechaVencimiento: f.fechaVenc || undefined,
      observaciones: f.observaciones,
      estado,
    };
    if (existente) {
      const r = correr((d, c) => editarVenta(d, c, existente.id, input), { silencioso: true });
      setGuardando(false);
      if (!r.ok) {
        setErrores(r.campo ? { [r.campo]: r.error } : {});
        setErrorGeneral(r.error);
        return;
      }
      notificar("exito", `Venta ${existente.numero} actualizada.`);
      router.push(`/ventas/${existente.id}`);
      return;
    }
    const r = correr((d, c) => crearVenta(d, c, input), { silencioso: true });
    if (!r.ok) {
      setGuardando(false);
      setErrores(r.campo ? { [r.campo]: r.error } : {});
      setErrorGeneral(r.error);
      return;
    }
    if (abono && abono > 0 && estado === "confirmada") {
      const p = correr((d, c) => registrarPago(d, c, r.id, { monto: abono, metodo: f.metodoPago, nota: "Pago recibido al registrar la venta" }), { silencioso: true });
      if (!p.ok) notificar("error", `La venta se registró, pero el abono no: ${p.error}`);
    }
    notificar("exito", estado === "borrador" ? `Borrador ${r.numero} guardado.` : `Venta ${r.numero} confirmada.`);
    router.push(`/ventas/${r.id}`);
  }

  const limites = usuario.rol === "vendedor" && refPrecio
    ? `Rango permitido: ${clp(refPrecio * (1 - data.config.variacionPrecioVendedorPct / 100))} – ${clp(refPrecio * (1 + data.config.variacionPrecioVendedorPct / 100))}`
    : undefined;

  return (
    <>
      <EncabezadoPagina
        titulo={existente ? `Editar ${existente.numero}` : "Nueva venta"}
        descripcion="Registro comercial interno. No es un documento tributario electrónico."
        migas={[{ href: "/ventas", texto: "Ventas" }, { texto: existente ? `Editar ${existente.numero}` : "Nueva venta" }]}
      />
      {errorGeneral && <div className="mb-4"><AvisoPagina tono="error" titulo="No se pudo guardar">{errorGeneral}</AvisoPagina></div>}
      <form onSubmit={(e) => { e.preventDefault(); enviar("confirmada"); }} noValidate className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Cliente y entrega" />
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <div className="sm:col-span-2">
                <div className="flex items-end gap-2">
                  <CampoSelect claseCampo="flex-1" etiqueta="Cliente" obligatorio value={f.clienteId} onChange={(e) => alCambiarCliente(e.target.value)} error={errores.clienteId}>
                    <option value="">Selecciona un cliente…</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.activo ? "" : " (inactivo)"}</option>)}
                  </CampoSelect>
                  <Boton variante="secundario" onClick={() => setNuevoCliente(true)}><Plus className="size-4" /> Nuevo</Boton>
                </div>
              </div>
              <CampoTexto etiqueta="Persona de contacto" value={f.contactoNombre} onChange={entrada("contactoNombre")} />
              <CampoTexto etiqueta="Teléfono de contacto" value={f.contactoTelefono} onChange={entrada("contactoTelefono")} error={errores.contactoTelefono} placeholder="+56 9 1234 5678" />
              <CampoSelect etiqueta="Faena o lugar de entrega" obligatorio value={f.faenaId} onChange={entrada("faenaId")} error={errores.faenaId}>
                <option value="">Otra referencia (escribir abajo)</option>
                {faenasCliente.length > 0 && <optgroup label="Faenas del cliente">{faenasCliente.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</optgroup>}
                <optgroup label={faenasCliente.length ? "Otras faenas" : "Faenas registradas"}>{otrasFaenas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</optgroup>
              </CampoSelect>
              {!f.faenaId ? (
                <CampoTexto etiqueta="Dirección o referencia" obligatorio value={f.referenciaFaena} onChange={entrada("referenciaFaena")} ayuda="Por ejemplo: camino rural km 12, portón azul." error={!f.faenaId ? errores.faenaId : undefined} />
              ) : (
                <div className="self-end pb-2 text-xs text-slate-500">{i.faenas.get(f.faenaId)?.referencia}</div>
              )}
              <CampoTexto etiqueta="Fecha prevista de entrega" type="date" obligatorio value={f.fechaEntrega} onChange={entrada("fechaEntrega")} error={errores.fechaEntregaPrevista} min={existente?.fecha ?? hoy} />
              {esAdmin && (
                <CampoSelect etiqueta="Vendedor responsable" value={f.vendedorId} onChange={entrada("vendedorId")} error={errores.vendedorId}>
                  {vendedores.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </CampoSelect>
              )}
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Material y precio" subtitulo="Al elegir el material se carga su precio de referencia neto. El precio acordado queda guardado en la venta." />
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <CampoSelect etiqueta="Material" obligatorio value={f.materialId} onChange={(e) => alCambiarMaterial(e.target.value)} error={errores.materialId}>
                <option value="">Selecciona un material…</option>
                {data.materiales.filter((m) => m.activo || m.id === f.materialId).map((m) => <option key={m.id} value={m.id}>{m.nombre} — referencia {clp(m.precioReferencia)}/m³</option>)}
              </CampoSelect>
              <CampoNumero etiqueta="Cantidad solicitada" unidad="m³" obligatorio value={f.cantidad} onChange={entrada("cantidad")} error={errores.cantidadM3} placeholder="0" />
              <CampoNumero etiqueta="Precio unitario neto por m³" unidad="CLP" obligatorio value={f.precio} onChange={entrada("precio")} error={errores.precioUnitario} ayuda={limites ?? (refPrecio ? `Referencia: ${clp(refPrecio)}` : undefined)} />
              <CampoNumero etiqueta="Descuento (opcional)" unidad="%" value={f.descuento} onChange={entrada("descuento")} error={errores.descuentoPct} ayuda={usuario.rol === "vendedor" ? `Tu descuento máximo es ${num(data.config.descuentoMaxVendedorPct)} %.` : undefined} />
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Pago y observaciones" subtitulo="El estado de pago es independiente del de entrega: se calcula con los abonos registrados." />
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <CampoSelect etiqueta="Método de pago" obligatorio value={f.metodoPago} onChange={(e) => alCambiarMetodo(e.target.value)} error={errores.metodoPago}>
                {metodos.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </CampoSelect>
              <CampoTexto etiqueta="Fecha de vencimiento del pago" type="date" value={f.fechaVenc} onChange={(e) => { setVencTocado(true); set("fechaVenc", e.target.value); }} error={errores.fechaVencimiento} ayuda="Opcional. Si se deja vacía, el pago no vence." />
              {!existente && (
                <CampoNumero etiqueta="Pago recibido al registrar (opcional)" unidad="CLP" value={f.abono} onChange={entrada("abono")} error={errores.abono} ayuda="Se guarda como un abono separado. Estado de pago inicial: pendiente." />
              )}
              <CampoTextoLargo claseCampo="sm:col-span-2" etiqueta="Observaciones" value={f.observaciones} onChange={entrada("observaciones")} />
            </div>
          </Tarjeta>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Resumen de la venta" />
            <div className="space-y-3 p-4 text-sm sm:p-5">
              <dl className="space-y-2">
                <Fila e="N° de venta" v={existente ? existente.numero : "Se asigna al guardar"} />
                <Fila e="Fecha de creación" v={fecha(existente?.fecha ?? hoy)} />
                <Fila e="Vendedor" v={i.usuarios.get(esAdmin ? f.vendedorId : (existente?.vendedorId ?? usuario.id))?.nombre ?? "—"} />
              </dl>
              <hr className="border-slate-100" />
              <dl className="space-y-2" aria-live="polite">
                <Fila e="Subtotal bruto" v={clp(t.brutoSinDescuento)} />
                {t.descuento > 0 && <Fila e={`Descuento (${num(parseNum(f.descuento) ?? 0, 1)} %)`} v={`− ${clp(t.descuento)}`} />}
                <Fila e="Subtotal neto" v={clp(t.neto)} />
                <Fila e={`IVA (${num(ivaPct, 1)} %)`} v={clp(t.iva)} />
              </dl>
              <div className="flex items-baseline justify-between rounded-lg bg-navy-900 px-3 py-3 text-white">
                <span className="text-sm">Total</span>
                <span className="tabular text-xl font-semibold">{clp(t.total)}</span>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <Boton type="submit" tamano="lg" bloque cargando={guardando}><Save className="size-4" /> {existente ? "Guardar cambios" : "Confirmar venta"}</Boton>
                {!existente && (
                  <Boton variante="secundario" bloque disabled={guardando} onClick={() => enviar("borrador")}>Guardar como borrador</Boton>
                )}
                <Boton variante="fantasma" bloque onClick={() => router.back()}>Cancelar</Boton>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">Registro interno de la demostración; no corresponde a un documento tributario electrónico.</p>
            </div>
          </Tarjeta>
        </aside>
      </form>
      {nuevoCliente && <ClienteRapido onCerrar={() => setNuevoCliente(false)} onCreado={(id) => { setNuevoCliente(false); alCambiarCliente(id); }} />}
    </>
  );
}

function Fila({ e, v }: { e: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-600">{e}</dt>
      <dd className="tabular text-right font-medium text-slate-900">{v}</dd>
    </div>
  );
}
