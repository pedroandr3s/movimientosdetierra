"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { crearDespacho } from "@/lib/actions";
import { destinoVenta, idx, nombreDe, redondear, volumenEntregadoVenta, volumenPendienteVenta, volumenProgramadoVenta } from "@/lib/calc";
import { hoyISO } from "@/lib/fecha";
import { fecha, m3 } from "@/lib/formato";
import { can } from "@/lib/permisos";
import { useData, useUsuario } from "@/lib/store";
import type { Resultado, TipoDespacho } from "@/lib/types";
import { Boton, Tarjeta, EncabezadoTarjeta } from "@/components/ui/base";
import { AvisoPagina, EncabezadoPagina, ListaDatos } from "@/components/ui/datos";
import { CampoNumero, CampoSelect, CampoTexto, CampoTextoLargo, parseNum } from "@/components/ui/form";
import { ConfirmarDialogo, notificar } from "@/components/ui/overlay";
import { correr } from "@/components/acciones";

type Modo = "venta" | "independiente" | "maquinaria";

export function FormularioDespacho() {
  const data = useData();
  const usuario = useUsuario();
  const router = useRouter();
  const params = useSearchParams();
  const hoy = hoyISO();
  const i = idx(data);
  const esAdmin = usuario?.rol === "admin";

  const ventasElegibles = data.ventas
    .filter((v) => v.estado === "confirmada" && volumenPendienteVenta(data, v) > 0 && (esAdmin || v.vendedorId === usuario?.id))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const ventaInicial = params.get("venta") ?? "";
  const [modo, setModo] = useState<Modo>("venta");
  const [f, setF] = useState({
    ventaId: ventasElegibles.some((v) => v.id === ventaInicial) ? ventaInicial : "",
    fecha: hoy,
    vehiculoId: "",
    conductorId: "",
    volumen: "",
    viajes: null as string | null,
    observaciones: "",
    motivo: "",
    materialId: "",
    clienteId: "",
    faenaId: "",
    referenciaDestino: "",
  });
  const [condTocado, setCondTocado] = useState(false);
  const [volTocado, setVolTocado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [excepcion, setExcepcion] = useState<{ codigo: "exceso" | "vehiculo"; mensaje: string } | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const entrada = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value as never);

  const venta = f.ventaId ? i.ventas.get(f.ventaId) : undefined;
  const veh = f.vehiculoId ? i.vehiculos.get(f.vehiculoId) : undefined;
  const disponible = venta ? Math.max(0, redondear(venta.cantidadM3 - volumenProgramadoVenta(data, venta.id))) : 0;
  // El volumen sugerido sigue al saldo por programar mientras el usuario no lo escriba
  const volumenTxt = volTocado || !venta ? f.volumen : String(disponible).replace(".", ",");
  const volNum = parseNum(volumenTxt);
  const cap = veh?.capacidadM3 ?? 0;
  const viajesAuto = modo !== "maquinaria" && cap > 0 && volNum && volNum > 0 ? Math.max(1, Math.ceil(volNum / cap - 1e-9)) : 1;
  const viajesTxt = f.viajes ?? String(viajesAuto);

  const conductores = data.usuarios.filter((u) => u.rol === "conductor" && u.activo);
  const vehiculosOpc = data.vehiculos.filter((v) => (modo === "maquinaria" ? v.tipo === "maquinaria" : v.tipo !== "maquinaria"));

  function elegirVehiculo(id: string) {
    const v = i.vehiculos.get(id);
    setF((s) => ({ ...s, vehiculoId: id, conductorId: !condTocado && v?.conductorHabitualId ? v.conductorHabitualId : s.conductorId }));
  }

  function enviar(opciones: { autorizarExceso?: boolean; autorizarVehiculo?: boolean } = {}) {
    setErrorGeneral(null);
    const tipo: TipoDespacho = modo === "maquinaria" ? "trabajo_maquinaria" : "transporte";
    const r: Resultado<{ id: string; numero: string }> = correr(
      (d, c) =>
        crearDespacho(
          d,
          c,
          {
            tipo,
            ventaId: modo === "venta" ? f.ventaId : undefined,
            motivoIndependiente: modo === "venta" ? undefined : f.motivo,
            clienteId: modo === "venta" ? undefined : f.clienteId || undefined,
            faenaId: modo === "venta" ? undefined : f.faenaId || undefined,
            referenciaDestino: modo === "venta" ? undefined : f.referenciaDestino,
            materialId: modo === "independiente" ? f.materialId : undefined,
            fecha: f.fecha,
            vehiculoId: f.vehiculoId,
            conductorId: f.conductorId,
            volumenSolicitadoM3: modo === "maquinaria" ? 0 : (volNum ?? NaN),
            viajesPlanificados: modo === "maquinaria" ? undefined : parseNum(viajesTxt) ?? undefined,
            observaciones: f.observaciones,
          },
          opciones,
        ),
      { silencioso: true },
    );
    if (r.ok) {
      notificar("exito", `Despacho ${r.numero} programado.`);
      router.push(`/despachos/${r.id}`);
      return;
    }
    setExcepcion(null);
    if (r.codigo === "exceso" || r.codigo === "vehiculo") {
      setExcepcion({ codigo: r.codigo, mensaje: r.error });
      setErrores(r.campo ? { [r.campo]: r.error } : {});
      return;
    }
    setErrores(r.campo ? { [r.campo]: r.error } : {});
    setErrorGeneral(r.error);
  }

  if (!can(usuario?.rol, "despachos.crear")) return <AvisoPagina tono="alerta" titulo="Sin permiso">Tu rol no permite programar despachos.</AvisoPagina>;

  return (
    <>
      <EncabezadoPagina titulo="Nuevo despacho" descripcion="Un despacho puede cubrir parte de una venta; el volumen entregado se calcula con los viajes que registre el conductor." migas={[{ href: "/despachos", texto: "Despachos" }, { texto: "Nuevo" }]} />
      {errorGeneral && <div className="mb-4"><AvisoPagina tono="error" titulo="No se pudo programar el despacho">{errorGeneral}</AvisoPagina></div>}
      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {esAdmin && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Tipo de operación" />
              <div className="p-4 sm:p-5">
                <CampoSelect etiqueta="¿Qué se va a programar?" value={modo} onChange={(e) => { setModo(e.target.value as Modo); setF((s) => ({ ...s, vehiculoId: "", conductorId: "" })); setErrores({}); }}>
                  <option value="venta">Entrega de material de una venta</option>
                  <option value="independiente">Operación de transporte sin venta (requiere motivo)</option>
                  <option value="maquinaria">Trabajo de maquinaria (requiere motivo)</option>
                </CampoSelect>
              </div>
            </Tarjeta>
          )}

          {modo === "venta" ? (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Venta asociada" subtitulo="Solo aparecen ventas confirmadas con volumen pendiente." />
              <div className="space-y-4 p-4 sm:p-5">
                <CampoSelect etiqueta="Venta" obligatorio value={f.ventaId} onChange={(e) => { set("ventaId", e.target.value); setVolTocado(false); }} error={errores.ventaId}>
                  <option value="">Selecciona una venta…</option>
                  {ventasElegibles.map((v) => <option key={v.id} value={v.id}>{v.numero} · {nombreDe.cliente(data, v.clienteId)} · {m3(volumenPendienteVenta(data, v))} pendientes</option>)}
                </CampoSelect>
                {ventasElegibles.length === 0 && <AvisoPagina tono="info">No hay ventas confirmadas con volumen pendiente por despachar.</AvisoPagina>}
                {venta && (
                  <div className="rounded-lg bg-slate-50 p-3">
                    <ListaDatos columnas={3} items={[
                      { etiqueta: "Cliente", valor: nombreDe.cliente(data, venta.clienteId) },
                      { etiqueta: "Destino", valor: destinoVenta(data, venta) },
                      { etiqueta: "Material", valor: nombreDe.material(data, venta.materialId) },
                      { etiqueta: "Vendido", valor: m3(venta.cantidadM3) },
                      { etiqueta: "Entregado", valor: m3(volumenEntregadoVenta(data, venta.id)) },
                      { etiqueta: "Disponible para programar", valor: <strong>{m3(disponible)}</strong> },
                      { etiqueta: "Entrega prevista", valor: fecha(venta.fechaEntregaPrevista) },
                    ]} />
                  </div>
                )}
              </div>
            </Tarjeta>
          ) : (
            <Tarjeta>
              <EncabezadoTarjeta titulo={modo === "maquinaria" ? "Trabajo de maquinaria" : "Operación sin venta"} subtitulo="Se deja constancia del motivo en el historial." />
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                <CampoTextoLargo claseCampo="sm:col-span-2" etiqueta="Motivo" obligatorio value={f.motivo} onChange={entrada("motivo")} error={errores.motivoIndependiente} />
                {modo === "independiente" && (
                  <CampoSelect etiqueta="Material transportado" obligatorio value={f.materialId} onChange={entrada("materialId")} error={errores.materialId}>
                    <option value="">Selecciona un material…</option>
                    {data.materiales.filter((m) => m.activo).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </CampoSelect>
                )}
                <CampoSelect etiqueta="Cliente (opcional)" value={f.clienteId} onChange={entrada("clienteId")}>
                  <option value="">Sin cliente</option>
                  {data.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </CampoSelect>
                <CampoSelect etiqueta="Faena de destino" value={f.faenaId} onChange={entrada("faenaId")}>
                  <option value="">Otra referencia (escribir)</option>
                  {data.faenas.filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </CampoSelect>
                {!f.faenaId && <CampoTexto etiqueta="Referencia del destino" value={f.referenciaDestino} onChange={entrada("referenciaDestino")} />}
              </div>
            </Tarjeta>
          )}

          <Tarjeta>
            <EncabezadoTarjeta titulo="Asignación" />
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <CampoTexto etiqueta="Fecha del despacho" type="date" obligatorio value={f.fecha} onChange={entrada("fecha")} error={errores.fecha} min={venta?.fecha} />
              <CampoSelect etiqueta={modo === "maquinaria" ? "Maquinaria" : "Camión"} obligatorio value={f.vehiculoId} onChange={(e) => elegirVehiculo(e.target.value)} error={errores.vehiculoId}>
                <option value="">Selecciona…</option>
                {vehiculosOpc.map((v) => <option key={v.id} value={v.id}>{v.codigo}{v.patente ? ` · ${v.patente}` : ""}{v.capacidadM3 ? ` · ${v.capacidadM3} m³` : ""}{v.estado !== "disponible" ? ` (${v.estado.replace(/_/g, " ")})` : ""}</option>)}
              </CampoSelect>
              <CampoSelect etiqueta="Conductor" obligatorio value={f.conductorId} onChange={(e) => { setCondTocado(true); set("conductorId", e.target.value); }} error={errores.conductorId}>
                <option value="">Selecciona un conductor…</option>
                {conductores.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </CampoSelect>
              {modo !== "maquinaria" && (
                <>
                  <CampoNumero etiqueta="Volumen para este despacho" unidad="m³" obligatorio value={volumenTxt} onChange={(e) => { setVolTocado(true); set("volumen", e.target.value); }} error={errores.volumenSolicitadoM3} ayuda={cap ? `Capacidad del camión: ${m3(cap, 0)} por viaje.` : undefined} />
                  <CampoNumero etiqueta="Viajes planificados" value={viajesTxt} onChange={(e) => set("viajes", e.target.value)} ayuda="Se calcula según la capacidad; puedes ajustarlo." />
                </>
              )}
              <CampoTextoLargo claseCampo="sm:col-span-2" etiqueta="Observaciones para el conductor (opcional)" value={f.observaciones} onChange={entrada("observaciones")} />
            </div>
          </Tarjeta>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Resumen" />
            <div className="space-y-3 p-4 text-sm sm:p-5">
              <p className="text-slate-600">{venta ? <>Se creará un despacho de <strong>{volNum ? m3(volNum) : "—"}</strong> para <strong>{venta.numero}</strong>.</> : "Completa los datos para programar el despacho."}</p>
              {veh && <p className="text-slate-600">Vehículo: <strong>{veh.codigo}</strong> · {veh.estado.replace(/_/g, " ")}</p>}
              <div className="flex flex-col gap-2 pt-1">
                <Boton type="submit" tamano="lg" bloque>Programar despacho</Boton>
                <Boton variante="fantasma" bloque onClick={() => router.back()}>Cancelar</Boton>
              </div>
            </div>
          </Tarjeta>
        </aside>
      </form>

      {excepcion && (
        <ConfirmarDialogo
          peligro
          titulo={excepcion.codigo === "exceso" ? "Volumen sobre lo pendiente" : "Vehículo no disponible"}
          mensaje={<>{excepcion.mensaje}{esAdmin ? <p className="mt-2 font-medium">¿Autorizas explícitamente esta excepción? Quedará registrada en el historial.</p> : <p className="mt-2 font-medium">Solicita la autorización de un administrador.</p>}</>}
          textoConfirmar={esAdmin ? "Autorizar y programar" : "Entendido"}
          onCancelar={() => setExcepcion(null)}
          onConfirmar={() => {
            const c = excepcion.codigo;
            if (!esAdmin) { setExcepcion(null); return; }
            enviar({ autorizarExceso: c === "exceso" ? true : undefined, autorizarVehiculo: c === "vehiculo" ? true : undefined });
          }}
        />
      )}
    </>
  );
}
