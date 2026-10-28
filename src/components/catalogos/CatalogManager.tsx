"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { eliminarEntidad, guardarEntidad } from "@/lib/actions";
import { construirCSV, descargarTexto } from "@/lib/csv";
import { hoyISO } from "@/lib/fecha";
import { can } from "@/lib/permisos";
import { useData, useUsuario } from "@/lib/store";
import { Boton, Tarjeta } from "@/components/ui/base";
import { AvisoPagina, BarraFiltros, EncabezadoPagina, EstadoVacio, TablaDatos } from "@/components/ui/datos";
import { CampoNumero, CampoSelect, CampoTexto, CampoTextoLargo, Casilla, EntradaFiltro, parseNum } from "@/components/ui/form";
import { Download, Plus, Search } from "@/components/ui/icons";
import { ConfirmarDialogo, Modal, notificar } from "@/components/ui/overlay";
import { correr } from "@/components/acciones";
import { DEF_CLIENTES, DEF_FAENAS, DEF_MATERIALES, DEF_USUARIOS, DEF_VEHICULOS, type CampoDef, type ClaveDef, type DefCatalogo, type Valores } from "./definiciones";

const DEFS: Record<ClaveDef, DefCatalogo<{ id: string }>> = {
  clientes: DEF_CLIENTES as unknown as DefCatalogo<{ id: string }>,
  faenas: DEF_FAENAS as unknown as DefCatalogo<{ id: string }>,
  vehiculos: DEF_VEHICULOS as unknown as DefCatalogo<{ id: string }>,
  materiales: DEF_MATERIALES as unknown as DefCatalogo<{ id: string }>,
  usuarios: DEF_USUARIOS as unknown as DefCatalogo<{ id: string }>,
};

function aValores(x: Record<string, unknown>, def: DefCatalogo<{ id: string }>): Valores {
  const base = def.inicial();
  const v: Valores = { ...base };
  for (const k of Object.keys(base)) {
    const val = x[k];
    if (typeof base[k] === "boolean") v[k] = val !== false;
    else v[k] = val == null ? "" : typeof val === "number" ? String(val).replace(".", ",") : String(val);
  }
  return v;
}

export function CatalogManager({ catalogo }: { catalogo: ClaveDef }) {
  const def = DEFS[catalogo];
  const data = useData();
  const usuario = useUsuario();
  const router = useRouter();
  const lista = data[catalogo] as unknown as { id: string }[];
  const puedeAdministrar = can(usuario?.rol, "catalogos.administrar");
  const puedeEditar = puedeAdministrar || (catalogo === "clientes" && can(usuario?.rol, "catalogos.editar_clientes"));
  const [q, setQ] = useState("");
  const [verInactivos, setVerInactivos] = useState(true);
  const [edicion, setEdicion] = useState<null | { id?: string; valores: Valores }>(null);
  const [borrar, setBorrar] = useState<{ id: string; nombre: string } | null>(null);

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return lista.filter((x) => (verInactivos || !def.activo || def.activo(x)) && (!t || def.texto(data, x).toLowerCase().includes(t)));
  }, [lista, q, verInactivos, def, data]);

  const columnas = def.columnas(data).filter((c) => !(usuario?.rol === "vendedor" && catalogo === "clientes" && (c.clave === "s" || c.clave === "v")));
  const hayInactivos = def.activo ? lista.some((x) => !def.activo!(x)) : false;

  function exportar() {
    const campos = def.campos(data, def.inicial()).map((c) => c);
    const cabeceras = campos.map((c) => c.etiqueta);
    const rows = filas.map((x) => campos.map((c) => { const v = (x as Record<string, unknown>)[c.clave]; return typeof v === "boolean" ? (v ? "Sí" : "No") : (v as string | number | null | undefined) ?? ""; }));
    descargarTexto(`${catalogo}_${hoyISO()}.csv`, construirCSV(cabeceras, rows));
  }

  return (
    <>
      <EncabezadoPagina
        titulo={def.titulo}
        descripcion={def.descripcion}
        acciones={
          <>
            <Boton variante="secundario" onClick={exportar} disabled={filas.length === 0}><Download className="size-4" /> Exportar CSV</Boton>
            {puedeEditar && <Boton variante="acento" onClick={() => setEdicion({ valores: def.inicial() })}><Plus className="size-4" /> Nuevo {def.singular}</Boton>}
          </>
        }
      />
      {!puedeEditar && <div className="mb-4"><AvisoPagina tono="info">Solo puedes consultar este catálogo con tu rol.</AvisoPagina></div>}
      <Tarjeta>
        <div className="border-b border-slate-100 p-3 sm:p-4">
          <BarraFiltros>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden />
              <EntradaFiltro etiqueta={`Buscar ${def.titulo.toLowerCase()}`} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64 pl-8" />
            </div>
            {hayInactivos && <Casilla etiqueta="Mostrar inactivos" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />}
            <span className="ml-auto text-xs text-slate-500">{filas.length} de {lista.length}</span>
          </BarraFiltros>
        </div>
        <TablaDatos
          columnas={columnas}
          filas={filas}
          clave={(x) => x.id}
          alHacerClic={(x) => (def.ficha ? router.push(def.ficha(x)) : puedeEditar ? setEdicion({ id: x.id, valores: aValores(x as Record<string, unknown>, def) }) : undefined)}
          tamanoPagina={12}
          ariaEtiqueta={def.titulo}
          vacio={<EstadoVacio titulo={lista.length === 0 ? `Aún no hay ${def.titulo.toLowerCase()}` : "Sin resultados"} descripcion={lista.length === 0 ? `Crea el primer ${def.singular}.` : "Prueba con otra búsqueda."} accion={puedeEditar && lista.length === 0 ? <Boton onClick={() => setEdicion({ valores: def.inicial() })}>Crear {def.singular}</Boton> : undefined} />}
        />
      </Tarjeta>

      {edicion && (
        <FormularioEntidad
          def={def}
          inicial={edicion.valores}
          id={edicion.id}
          puedeEliminar={puedeAdministrar && !!edicion.id}
          onCerrar={() => setEdicion(null)}
          onEliminar={(nombre) => { setBorrar({ id: edicion.id as string, nombre }); }}
        />
      )}
      {borrar && (
        <ConfirmarDialogo
          peligro
          titulo={`Eliminar ${def.singular}`}
          mensaje={<>Se eliminará <strong>{borrar.nombre}</strong>. Si tiene historial asociado no podrá eliminarse: en ese caso desactívalo.</>}
          textoConfirmar="Eliminar"
          onCancelar={() => setBorrar(null)}
          onConfirmar={() => {
            const r = correr((d, c) => eliminarEntidad(d, c, def.cat, borrar.id), { exito: `${def.singular[0].toUpperCase()}${def.singular.slice(1)} eliminado.` });
            setBorrar(null);
            if (r.ok) setEdicion(null);
          }}
        />
      )}
    </>
  );
}

export function FormularioEntidad({ def, inicial, id, puedeEliminar, onCerrar, onEliminar }: { def: DefCatalogo<{ id: string }>; inicial: Valores; id?: string; puedeEliminar?: boolean; onCerrar: () => void; onEliminar?: (nombre: string) => void }) {
  const data = useData();
  const [v, setV] = useState<Valores>(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const campos = def.campos(data, v);

  function cambiar(clave: string, valor: string | boolean) {
    setV((s) => {
      const n = { ...s, [clave]: valor };
      if (def.cat === "vehiculos" && clave === "tipo") n.medidor = valor === "maquinaria" ? "horas" : "km";
      return n;
    });
  }

  function guardar() {
    const reg: Record<string, unknown> = id ? { id } : {};
    for (const c of campos) {
      if (c.visible && !c.visible(v)) continue;
      const val = v[c.clave];
      if (c.tipo === "numero") reg[c.clave] = typeof val === "string" && val.trim() !== "" ? parseNum(val) ?? NaN : undefined;
      else reg[c.clave] = val;
    }
    const r = correr((d, ctx) => guardarEntidad(d, ctx, def.cat, reg), { silencioso: true });
    if (r.ok) { notificar("exito", id ? "Cambios guardados." : `${def.singular[0].toUpperCase()}${def.singular.slice(1)} creado.`); onCerrar(); return; }
    setErrores({ [r.campo ?? "_"]: r.error });
  }

  return (
    <Modal
      titulo={id ? `Editar ${def.singular}` : `Nuevo ${def.singular}`}
      ancho="lg"
      onCerrar={onCerrar}
      pie={
        <>
          {puedeEliminar && onEliminar && <Boton variante="fantasma" className="mr-auto text-red-700" onClick={() => onEliminar(String(v.nombre || v.codigo))}>Eliminar</Boton>}
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar}>Guardar</Boton>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} noValidate className="grid gap-4 sm:grid-cols-2">
        {errores._ && <div className="sm:col-span-2"><AvisoPagina tono="error">{errores._}</AvisoPagina></div>}
        {campos.filter((c) => !c.visible || c.visible(v)).map((c) => (
          <CampoGenerico key={c.clave} c={c} valor={v[c.clave]} error={errores[c.clave]} onCambio={(x) => cambiar(c.clave, x)} />
        ))}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

function CampoGenerico({ c, valor, error, onCambio }: { c: CampoDef; valor: string | boolean; error?: string; onCambio: (v: string | boolean) => void }) {
  const claseCampo = c.ancho ? "sm:col-span-2" : undefined;
  if (c.tipo === "bool") return <div className={claseCampo}><Casilla etiqueta={c.etiqueta} checked={valor === true} onChange={(e) => onCambio(e.target.checked)} /></div>;
  const s = typeof valor === "string" ? valor : "";
  if (c.tipo === "select") {
    return (
      <CampoSelect claseCampo={claseCampo} etiqueta={c.etiqueta} obligatorio={c.obligatorio} value={s} onChange={(e) => onCambio(e.target.value)} error={error} ayuda={c.ayuda}>
        {c.opciones?.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </CampoSelect>
    );
  }
  if (c.tipo === "largo") return <CampoTextoLargo claseCampo={claseCampo} etiqueta={c.etiqueta} obligatorio={c.obligatorio} value={s} onChange={(e) => onCambio(e.target.value)} error={error} ayuda={c.ayuda} />;
  if (c.tipo === "numero") return <CampoNumero claseCampo={claseCampo} etiqueta={c.etiqueta} obligatorio={c.obligatorio} unidad={c.unidad} value={s} onChange={(e) => onCambio(e.target.value)} error={error} ayuda={c.ayuda} />;
  if (c.tipo === "fecha") return <CampoTexto claseCampo={claseCampo} etiqueta={c.etiqueta} obligatorio={c.obligatorio} type="date" value={s} onChange={(e) => onCambio(e.target.value)} error={error} ayuda={c.ayuda} />;
  return <CampoTexto claseCampo={claseCampo} etiqueta={c.etiqueta} obligatorio={c.obligatorio} value={s} onChange={(e) => onCambio(e.target.value)} error={error} ayuda={c.ayuda} />;
}

export { aValores, DEFS };
