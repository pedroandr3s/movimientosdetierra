"use client";
import { useMemo, useState } from "react";
import { eliminarCarga, eliminarInsumo, guardarCarga, guardarInsumo } from "@/lib/actions";
import { rangoDePreset, resumenFlota, despachosEnPeriodo } from "@/lib/calc";
import { nombreDe } from "@/lib/calc";
import { construirCSV, descargarTexto } from "@/lib/csv";
import { hoyISO } from "@/lib/fecha";
import { clp, fecha, horas, km, litros, num } from "@/lib/formato";
import { can } from "@/lib/permisos";
import { useData, useUsuario } from "@/lib/store";
import { ETIQUETAS, type CargaCombustible, type InsumoMantenimiento, type TipoInsumo } from "@/lib/types";
import { Boton, Tarjeta } from "@/components/ui/base";
import { AvisoPagina, BarraFiltros, EncabezadoPagina, EstadoVacio, Pestanas, TablaDatos, TarjetaKpi, type Columna } from "@/components/ui/datos";
import { CampoNumero, CampoSelect, CampoTexto, SelectFiltro, parseNum } from "@/components/ui/form";
import { Download, Fuel, Plus } from "@/components/ui/icons";
import { ConfirmarDialogo, Modal, notificar } from "@/components/ui/overlay";
import { correr } from "@/components/acciones";

type Pestana = "cargas" | "insumos" | "consumo";

export function PaginaCombustible() {
  const data = useData();
  const usuario = useUsuario();
  const hoy = hoyISO();
  const editar = can(usuario?.rol, "combustible.editar");
  const [pestana, setPestana] = useState<Pestana>("cargas");
  const [vehiculo, setVehiculo] = useState("");
  const [modal, setModal] = useState<null | { tipo: "carga"; item?: CargaCombustible } | { tipo: "insumo" }>(null);
  const [borrar, setBorrar] = useState<null | { tipo: "carga" | "insumo"; id: string }>(null);

  const cargas = useMemo(() => data.cargas.filter((c) => !vehiculo || c.vehiculoId === vehiculo).sort((a, b) => b.fecha.localeCompare(a.fecha)), [data.cargas, vehiculo]);
  const insumos = useMemo(() => data.insumos.filter((c) => !vehiculo || c.vehiculoId === vehiculo).sort((a, b) => b.fecha.localeCompare(a.fecha)), [data.insumos, vehiculo]);

  // Período: últimos 30 días, igual que el panel de flota
  const rango = rangoDePreset("30d", hoy);
  const ds = despachosEnPeriodo(data, { preset: "30d", vehiculoId: vehiculo || undefined }, rango);
  const cargadoPeriodo = data.cargas.filter((c) => c.fecha >= rango.desde && c.fecha <= rango.hasta && (!vehiculo || c.vehiculoId === vehiculo)).reduce((s, c) => s + c.litros, 0);
  const res = resumenFlota(data, ds);

  const colsCarga: Columna<CargaCombustible>[] = [
    { clave: "f", titulo: "Fecha", celda: (c) => fecha(c.fecha), orden: (c) => c.fecha },
    { clave: "v", titulo: "Vehículo", celda: (c) => nombreDe.vehiculo(data, c.vehiculoId), orden: (c) => nombreDe.vehiculo(data, c.vehiculoId) },
    { clave: "c", titulo: "Conductor", celda: (c) => (c.conductorId ? nombreDe.usuario(data, c.conductorId) : "—"), ocultarEnMovil: true },
    { clave: "l", titulo: "Litros cargados", alinear: "der", celda: (c) => litros(c.litros), orden: (c) => c.litros },
    { clave: "p", titulo: "Precio por litro", alinear: "der", celda: (c) => (c.precioPorLitro != null ? clp(c.precioPorLitro) : "—"), ocultarEnMovil: true },
    { clave: "t", titulo: "Costo", alinear: "der", celda: (c) => (c.precioPorLitro != null ? clp(Math.round(c.litros * c.precioPorLitro)) : "—"), ocultarEnMovil: true },
    { clave: "e", titulo: "Estación", celda: (c) => c.estacion ?? "—", ocultarEnMovil: true },
    {
      clave: "a", titulo: "", alinear: "der",
      celda: (c) => editar ? (
        <span className="flex justify-end gap-1">
          <Boton tamano="sm" variante="fantasma" onClick={() => setModal({ tipo: "carga", item: c })}>Editar</Boton>
          <Boton tamano="sm" variante="fantasma" className="text-red-700" onClick={() => setBorrar({ tipo: "carga", id: c.id })}>Eliminar</Boton>
        </span>
      ) : null,
    },
  ];
  const colsInsumo: Columna<InsumoMantenimiento>[] = [
    { clave: "f", titulo: "Fecha", celda: (c) => fecha(c.fecha), orden: (c) => c.fecha },
    { clave: "v", titulo: "Vehículo", celda: (c) => nombreDe.vehiculo(data, c.vehiculoId) },
    { clave: "t", titulo: "Insumo", celda: (c) => ETIQUETAS.tipoInsumo[c.tipo] },
    { clave: "q", titulo: "Cantidad", alinear: "der", celda: (c) => `${num(c.cantidad, 1)} ${c.unidad}` },
    { clave: "co", titulo: "Costo", alinear: "der", celda: (c) => (c.costo != null ? clp(c.costo) : "—"), ocultarEnMovil: true },
    { clave: "n", titulo: "Nota", celda: (c) => c.nota ?? "—", ocultarEnMovil: true },
    { clave: "a", titulo: "", alinear: "der", celda: (c) => editar ? <Boton tamano="sm" variante="fantasma" className="text-red-700" onClick={() => setBorrar({ tipo: "insumo", id: c.id })}>Eliminar</Boton> : null },
  ];

  // Consumo registrado por vehículo (período)
  const filasConsumo = data.vehiculos
    .filter((v) => !vehiculo || v.id === vehiculo)
    .map((v) => {
      const dv = ds.filter((d) => d.vehiculoId === v.id);
      const r = resumenFlota(data, dv);
      const cargado = data.cargas.filter((c) => c.vehiculoId === v.id && c.fecha >= rango.desde && c.fecha <= rango.hasta).reduce((s, c) => s + c.litros, 0);
      return { v, r, cargado, n: dv.length };
    });
  type FilaConsumo = (typeof filasConsumo)[number];
  const colsConsumo: Columna<FilaConsumo>[] = [
    { clave: "v", titulo: "Vehículo", celda: (f) => f.v.codigo, orden: (f) => f.v.codigo },
    { clave: "o", titulo: "Operaciones", alinear: "der", celda: (f) => f.n },
    { clave: "cons", titulo: "Consumido", alinear: "der", celda: (f) => (f.r.litrosConsumidos > 0 ? litros(f.r.litrosConsumidos) : "Sin dato"), orden: (f) => f.r.litrosConsumidos },
    { clave: "carg", titulo: "Cargado", alinear: "der", celda: (f) => (f.cargado > 0 ? litros(f.cargado) : "—"), orden: (f) => f.cargado },
    { clave: "m", titulo: "Km / horas válidos", alinear: "der", celda: (f) => (f.v.medidor === "km" ? (f.r.km > 0 ? km(f.r.km, 1) : "—") : f.r.horas > 0 ? horas(f.r.horas) : "—") },
    { clave: "r", titulo: "Rendimiento", alinear: "der", celda: (f) => (f.v.medidor === "km" ? (f.r.l100km != null ? `${f.r.l100km.toFixed(1).replace(".", ",")} L/100 km` : "Sin datos suficientes") : f.r.lh != null ? `${f.r.lh.toFixed(1).replace(".", ",")} L/h` : "Sin datos suficientes") },
  ];

  function exportar() {
    if (pestana === "cargas") descargarTexto(`cargas_combustible_${hoy}.csv`, construirCSV(["Fecha", "Vehículo", "Conductor", "Litros cargados", "Precio por litro", "Estación"], cargas.map((c) => [c.fecha, nombreDe.vehiculo(data, c.vehiculoId), c.conductorId ? nombreDe.usuario(data, c.conductorId) : "", c.litros, c.precioPorLitro ?? "", c.estacion ?? ""])));
    else if (pestana === "insumos") descargarTexto(`insumos_${hoy}.csv`, construirCSV(["Fecha", "Vehículo", "Insumo", "Cantidad", "Unidad", "Costo", "Nota"], insumos.map((c) => [c.fecha, nombreDe.vehiculo(data, c.vehiculoId), ETIQUETAS.tipoInsumo[c.tipo], c.cantidad, c.unidad, c.costo ?? "", c.nota ?? ""])));
    else descargarTexto(`consumo_por_vehiculo_${hoy}.csv`, construirCSV(["Vehículo", "Operaciones", "Consumido (L)", "Cargado (L)", "Km válidos", "Horas válidas", "L/100 km", "L/h"], filasConsumo.map((f) => [f.v.codigo, f.n, f.r.litrosConsumidos, f.cargado, f.r.km, f.r.horas, f.r.l100km ?? "", f.r.lh ?? ""])));
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Combustible e insumos"
        descripcion="El combustible cargado (compras) y el consumido (lo que informa el conductor en cada operación) son datos distintos y nunca se mezclan."
        acciones={
          <>
            <Boton variante="secundario" onClick={exportar}><Download className="size-4" /> Exportar CSV</Boton>
            {editar && pestana !== "consumo" && <Boton variante="acento" onClick={() => setModal(pestana === "cargas" ? { tipo: "carga" } : { tipo: "insumo" })}><Plus className="size-4" /> {pestana === "cargas" ? "Registrar carga" : "Registrar insumo"}</Boton>}
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <TarjetaKpi titulo="Consumido (30 días)" valor={res.litrosConsumidos > 0 ? litros(res.litrosConsumidos) : "Sin datos suficientes"} detalle={`${res.despachosConCombustible} operaciones con dato`} icono={<Fuel className="size-5" />} sinComparacion />
        <TarjetaKpi titulo="Cargado (30 días)" valor={cargadoPeriodo > 0 ? litros(cargadoPeriodo) : "Sin cargas"} detalle="Compras registradas" icono={<Fuel className="size-5" />} sinComparacion />
        <TarjetaKpi titulo="Rendimiento de camiones" valor={res.l100km != null ? `${res.l100km.toFixed(1).replace(".", ",")} L/100 km` : "Sin datos suficientes"} detalle={res.l100km != null ? `Sobre ${km(res.kmParaRendimiento)} con consumo informado` : "Requiere km válidos y consumo"} icono={<Fuel className="size-5" />} sinComparacion />
      </div>
      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3 sm:p-4">
          <Pestanas valor={pestana} onCambiar={setPestana} opciones={[{ valor: "cargas", etiqueta: "Cargas", conteo: cargas.length }, { valor: "insumos", etiqueta: "Insumos", conteo: insumos.length }, { valor: "consumo", etiqueta: "Consumo registrado" }]} />
          <BarraFiltros>
            <SelectFiltro etiqueta="Vehículo" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)}>
              <option value="">Todos los vehículos</option>
              {data.vehiculos.map((v) => <option key={v.id} value={v.id}>{v.codigo}</option>)}
            </SelectFiltro>
          </BarraFiltros>
        </div>
        {pestana === "cargas" && <TablaDatos columnas={colsCarga} filas={cargas} clave={(c) => c.id} ordenInicial={{ clave: "f", dir: "desc" }} ariaEtiqueta="Cargas de combustible" vacio={<EstadoVacio icono={<Fuel className="size-6" />} titulo="Sin cargas registradas" descripcion="Registra las compras de combustible para comparar lo cargado con lo consumido." />} />}
        {pestana === "insumos" && <TablaDatos columnas={colsInsumo} filas={insumos} clave={(c) => c.id} ordenInicial={{ clave: "f", dir: "desc" }} ariaEtiqueta="Insumos de mantenimiento" vacio={<EstadoVacio titulo="Sin insumos registrados" descripcion="Aquí aparecen los aceites, grasas y filtros informados por los conductores o cargados por el administrador." />} />}
        {pestana === "consumo" && (
          <>
            <div className="p-4"><AvisoPagina tono="info">Últimos 30 días. El rendimiento usa solo operaciones con lectura válida y consumo informado; el resto se excluye en vez de inferirse.</AvisoPagina></div>
            <TablaDatos columnas={colsConsumo} filas={filasConsumo} clave={(f) => f.v.id} ariaEtiqueta="Consumo por vehículo" />
          </>
        )}
      </Tarjeta>

      {modal?.tipo === "carga" && <ModalCarga item={modal.item} onCerrar={() => setModal(null)} />}
      {modal?.tipo === "insumo" && <ModalInsumo onCerrar={() => setModal(null)} />}
      {borrar && (
        <ConfirmarDialogo
          peligro
          titulo={borrar.tipo === "carga" ? "Eliminar carga de combustible" : "Eliminar insumo"}
          mensaje="El registro se eliminará y el cambio quedará en el historial."
          textoConfirmar="Eliminar"
          onCancelar={() => setBorrar(null)}
          onConfirmar={() => { const r = correr((x, c) => (borrar.tipo === "carga" ? eliminarCarga(x, c, borrar.id) : eliminarInsumo(x, c, borrar.id)), { exito: "Registro eliminado." }); if (r.ok) setBorrar(null); }}
        />
      )}
    </>
  );
}

function ModalCarga({ item, onCerrar }: { item?: CargaCombustible; onCerrar: () => void }) {
  const data = useData();
  const [f, setF] = useState({ fecha: item?.fecha ?? hoyISO(), vehiculoId: item?.vehiculoId ?? "", conductorId: item?.conductorId ?? "", litros: item ? String(item.litros).replace(".", ",") : "", precio: item?.precioPorLitro != null ? String(item.precioPorLitro) : "", estacion: item?.estacion ?? "" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  function guardar() {
    const r = correr((x, c) => guardarCarga(x, c, { id: item?.id, fecha: f.fecha, vehiculoId: f.vehiculoId, conductorId: f.conductorId || undefined, litros: parseNum(f.litros) ?? NaN, precioPorLitro: f.precio.trim() ? parseNum(f.precio) ?? NaN : undefined, estacion: f.estacion.trim() || undefined }), { silencioso: true });
    if (r.ok) { notificar("exito", item ? "Carga actualizada." : "Carga registrada."); onCerrar(); } else setErrores({ [r.campo ?? "_"]: r.error });
  }
  return (
    <Modal titulo={item ? "Editar carga de combustible" : "Registrar carga de combustible"} descripcion="Es una compra o abastecimiento; no equivale al consumo de la operación." onCerrar={onCerrar} pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {errores._ && <div className="sm:col-span-2"><AvisoPagina tono="error">{errores._}</AvisoPagina></div>}
        <CampoTexto etiqueta="Fecha" type="date" obligatorio value={f.fecha} onChange={set("fecha")} error={errores.fecha} max={hoyISO()} />
        <CampoSelect etiqueta="Vehículo" obligatorio value={f.vehiculoId} onChange={set("vehiculoId")} error={errores.vehiculoId}>
          <option value="">Selecciona…</option>
          {data.vehiculos.map((v) => <option key={v.id} value={v.id}>{v.codigo}</option>)}
        </CampoSelect>
        <CampoNumero etiqueta="Litros cargados" unidad="L" obligatorio value={f.litros} onChange={set("litros")} error={errores.litros} />
        <CampoNumero etiqueta="Precio por litro (opcional)" unidad="$/L" value={f.precio} onChange={set("precio")} error={errores.precioPorLitro} />
        <CampoSelect etiqueta="Conductor (opcional)" value={f.conductorId} onChange={set("conductorId")}>
          <option value="">Sin conductor</option>
          {data.usuarios.filter((u) => u.rol === "conductor").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </CampoSelect>
        <CampoTexto etiqueta="Estación (opcional)" value={f.estacion} onChange={set("estacion")} />
      </div>
    </Modal>
  );
}

function ModalInsumo({ onCerrar }: { onCerrar: () => void }) {
  const data = useData();
  const [f, setF] = useState({ fecha: hoyISO(), vehiculoId: "", tipo: "aceite_motor" as TipoInsumo, cantidad: "", unidad: "L" as "L" | "kg" | "un", costo: "", nota: "" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value as never }));
  function guardar() {
    const r = correr((x, c) => guardarInsumo(x, c, { fecha: f.fecha, vehiculoId: f.vehiculoId, tipo: f.tipo, cantidad: parseNum(f.cantidad) ?? NaN, unidad: f.unidad, costo: f.costo.trim() ? parseNum(f.costo) ?? NaN : undefined, nota: f.nota.trim() || undefined }), { silencioso: true });
    if (r.ok) { notificar("exito", "Insumo registrado."); onCerrar(); } else setErrores({ [r.campo ?? "_"]: r.error });
  }
  return (
    <Modal titulo="Registrar insumo de mantenimiento" onCerrar={onCerrar} pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {errores._ && <div className="sm:col-span-2"><AvisoPagina tono="error">{errores._}</AvisoPagina></div>}
        <CampoTexto etiqueta="Fecha" type="date" obligatorio value={f.fecha} onChange={set("fecha")} error={errores.fecha} />
        <CampoSelect etiqueta="Vehículo" obligatorio value={f.vehiculoId} onChange={set("vehiculoId")} error={errores.vehiculoId}>
          <option value="">Selecciona…</option>
          {data.vehiculos.map((v) => <option key={v.id} value={v.id}>{v.codigo}</option>)}
        </CampoSelect>
        <CampoSelect etiqueta="Insumo" value={f.tipo} onChange={set("tipo")}>
          {(Object.keys(ETIQUETAS.tipoInsumo) as TipoInsumo[]).map((t) => <option key={t} value={t}>{ETIQUETAS.tipoInsumo[t]}</option>)}
        </CampoSelect>
        <div className="grid grid-cols-2 gap-2">
          <CampoNumero etiqueta="Cantidad" obligatorio value={f.cantidad} onChange={set("cantidad")} error={errores.cantidad} />
          <CampoSelect etiqueta="Unidad" value={f.unidad} onChange={set("unidad")}><option value="L">L</option><option value="kg">kg</option><option value="un">un</option></CampoSelect>
        </div>
        <CampoNumero etiqueta="Costo (opcional)" unidad="$" value={f.costo} onChange={set("costo")} error={errores.costo} />
        <CampoTexto etiqueta="Nota (opcional)" value={f.nota} onChange={set("nota")} />
      </div>
    </Modal>
  );
}
