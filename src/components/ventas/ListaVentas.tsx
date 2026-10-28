"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { anularVenta, puedeEditarVenta } from "@/lib/actions";
import { destinoVenta, estadoComercialVenta, estadoPagoVenta, nombreDe, saldoVenta, totalesVenta, volumenEntregadoVenta } from "@/lib/calc";
import { construirCSV, descargarTexto } from "@/lib/csv";
import { hoyISO } from "@/lib/fecha";
import { clp, fecha, m3 } from "@/lib/formato";
import { can } from "@/lib/permisos";
import { useData, useUsuario, contexto } from "@/lib/store";
import { ETIQUETAS, type EstadoComercial, type EstadoPago, type Venta } from "@/lib/types";
import { Boton, EnlaceBoton, Tarjeta } from "@/components/ui/base";
import { EncabezadoPagina, BarraFiltros, EstadoVacio, TablaDatos, type Columna } from "@/components/ui/datos";
import { EntradaFiltro, SelectFiltro } from "@/components/ui/form";
import { ConfirmarDialogo } from "@/components/ui/overlay";
import { Ban, Download, Eye, Pencil, Plus, Search, Receipt } from "@/components/ui/icons";
import { correr } from "@/components/acciones";
import { columnasVentas } from "./columnas";

const ESTADOS: EstadoComercial[] = ["borrador", "confirmada", "en_despacho", "parcial", "entregada", "anulada"];
const PAGOS: EstadoPago[] = ["pendiente", "parcial", "pagada", "vencida"];

export function ListaVentas() {
  const data = useData();
  const usuario = useUsuario();
  const router = useRouter();
  const params = useSearchParams();
  const hoy = hoyISO();
  const esAdmin = usuario?.rol === "admin";

  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(params.get("estado") ?? "");
  const [pago, setPago] = useState(params.get("pago") ?? "");
  const [material, setMaterial] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [aAnular, setAAnular] = useState<Venta | null>(null);

  const propias = useMemo(() => data.ventas.filter((v) => esAdmin || v.vendedorId === usuario?.id), [data.ventas, esAdmin, usuario]);

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return propias.filter((v) => {
      if (estado && estadoComercialVenta(data, v) !== estado) return false;
      if (pago && estadoPagoVenta(data, v, hoy) !== pago) return false;
      if (material && v.materialId !== material) return false;
      if (vendedor && v.vendedorId !== vendedor) return false;
      if (desde && v.fecha < desde) return false;
      if (hasta && v.fecha > hasta) return false;
      if (t) {
        const texto = `${v.numero} ${nombreDe.cliente(data, v.clienteId)} ${destinoVenta(data, v)} ${nombreDe.material(data, v.materialId)} ${v.observaciones ?? ""}`.toLowerCase();
        if (!texto.includes(t)) return false;
      }
      return true;
    });
  }, [propias, data, q, estado, pago, material, vendedor, desde, hasta, hoy]);

  const cols = useMemo<Columna<Venta>[]>(() => {
    const base = columnasVentas(data, hoy, { vendedor: esAdmin });
    const ctx = contexto();
    base.push({
      clave: "acc",
      titulo: "",
      alinear: "der",
      celda: (v) => {
        const editable = ctx ? puedeEditarVenta(data, ctx, v) === null : false;
        const anulable = v.estado !== "anulada" && can(usuario?.rol, "ventas.anular") && (esAdmin || v.vendedorId === usuario?.id);
        return (
          <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Link href={`/ventas/${v.id}`} aria-label={`Ver ${v.numero}`} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"><Eye className="size-4" /></Link>
            {editable && <Link href={`/ventas/${v.id}/editar`} aria-label={`Editar ${v.numero}`} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"><Pencil className="size-4" /></Link>}
            {anulable && <button type="button" aria-label={`Anular ${v.numero}`} onClick={() => setAAnular(v)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Ban className="size-4" /></button>}
          </span>
        );
      },
    });
    return base;
  }, [data, hoy, esAdmin, usuario]);

  const totales = useMemo(() => {
    const validas = filas.filter((v) => v.estado === "confirmada");
    return { n: filas.length, total: validas.reduce((s, v) => s + totalesVenta(v).total, 0), saldo: validas.reduce((s, v) => s + saldoVenta(data, v), 0) };
  }, [filas, data]);

  function exportar() {
    const enc = ["N° venta", "Fecha", "Cliente", "Vendedor", "Material", "Destino", "Cantidad solicitada (m³)", "Cantidad entregada (m³)", "Neto (CLP)", "IVA (CLP)", "Total (CLP)", "Saldo pendiente (CLP)", "Estado de despacho", "Estado de pago"];
    const rows = filas.map((v) => {
      const t = totalesVenta(v);
      return [v.numero, v.fecha, nombreDe.cliente(data, v.clienteId), nombreDe.usuario(data, v.vendedorId), nombreDe.material(data, v.materialId), destinoVenta(data, v), v.cantidadM3, volumenEntregadoVenta(data, v.id), t.neto, t.iva, t.total, v.estado === "confirmada" ? saldoVenta(data, v) : "", ETIQUETAS.estadoComercial[estadoComercialVenta(data, v)], estadoPagoVenta(data, v, hoy) ? ETIQUETAS.estadoPago[estadoPagoVenta(data, v, hoy) as EstadoPago] : ""];
    });
    descargarTexto(`ventas_${hoy}.csv`, construirCSV(enc, rows));
  }

  const limpiar = () => { setQ(""); setEstado(""); setPago(""); setMaterial(""); setVendedor(""); setDesde(""); setHasta(""); };
  const hayFiltros = !!(q || estado || pago || material || vendedor || desde || hasta);

  return (
    <>
      <EncabezadoPagina
        titulo={esAdmin ? "Ventas" : "Mis ventas"}
        descripcion="Registro comercial interno (no es un documento tributario). El estado de despacho y el estado de pago son independientes."
        acciones={
          <>
            <Boton variante="secundario" onClick={exportar} disabled={filas.length === 0}><Download className="size-4" /> Exportar CSV</Boton>
            {can(usuario?.rol, "ventas.crear") && <EnlaceBoton href="/ventas/nueva" variante="acento"><Plus className="size-4" /> Nueva venta</EnlaceBoton>}
          </>
        }
      />
      <Tarjeta>
        <div className="border-b border-slate-100 p-3 sm:p-4">
          <BarraFiltros>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden />
              <EntradaFiltro etiqueta="Buscar ventas" placeholder="Buscar por número, cliente, destino…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64 pl-8" />
            </div>
            <SelectFiltro etiqueta="Estado de despacho" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((s) => <option key={s} value={s}>{ETIQUETAS.estadoComercial[s]}</option>)}
            </SelectFiltro>
            <SelectFiltro etiqueta="Estado de pago" value={pago} onChange={(e) => setPago(e.target.value)}>
              <option value="">Todos los pagos</option>
              {PAGOS.map((s) => <option key={s} value={s}>{ETIQUETAS.estadoPago[s]}</option>)}
            </SelectFiltro>
            <SelectFiltro etiqueta="Material" value={material} onChange={(e) => setMaterial(e.target.value)}>
              <option value="">Todos los materiales</option>
              {data.materiales.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </SelectFiltro>
            {esAdmin && (
              <SelectFiltro etiqueta="Vendedor" value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
                <option value="">Todos los vendedores</option>
                {data.usuarios.filter((u) => u.rol === "vendedor").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </SelectFiltro>
            )}
            <EntradaFiltro etiqueta="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <EntradaFiltro etiqueta="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            {hayFiltros && <Boton tamano="sm" variante="fantasma" onClick={limpiar}>Limpiar</Boton>}
          </BarraFiltros>
        </div>
        <TablaDatos
          columnas={cols}
          filas={filas}
          clave={(v) => v.id}
          alHacerClic={(v) => router.push(`/ventas/${v.id}`)}
          ordenInicial={{ clave: "fecha", dir: "desc" }}
          tamanoPagina={12}
          ariaEtiqueta="Listado de ventas"
          vacio={
            <EstadoVacio
              icono={<Receipt className="size-6" />}
              titulo={propias.length === 0 ? "Aún no hay ventas" : "Ninguna venta coincide con los filtros"}
              descripcion={propias.length === 0 ? "Registra la primera venta para comenzar." : "Prueba con otros filtros o límpialos."}
              accion={hayFiltros ? <Boton variante="secundario" onClick={limpiar}>Limpiar filtros</Boton> : <EnlaceBoton href="/ventas/nueva" variante="primario">Nueva venta</EnlaceBoton>}
            />
          }
        />
        {filas.length > 0 && (
          <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600 sm:px-5">
            {totales.n} {totales.n === 1 ? "venta" : "ventas"} · Total de ventas confirmadas: <strong className="text-slate-900">{clp(totales.total)}</strong> · Saldo por cobrar: <strong className="text-slate-900">{clp(totales.saldo)}</strong>
          </p>
        )}
      </Tarjeta>
      {aAnular && (
        <ConfirmarDialogo
          peligro
          titulo={`Anular ${aAnular.numero}`}
          mensaje={<>La venta quedará anulada y conservará su historial. No podrá anularse si ya tiene entregas o pagos registrados. Fecha de la venta: {fecha(aAnular.fecha)} · {m3(aAnular.cantidadM3)}.</>}
          textoConfirmar="Anular venta"
          pideMotivo={{ etiqueta: "Motivo de la anulación" }}
          onCancelar={() => setAAnular(null)}
          onConfirmar={(motivo) => {
            const id = aAnular.id;
            const r = correr((d, c) => anularVenta(d, c, id, motivo), { exito: "Venta anulada." });
            if (r.ok) setAAnular(null);
          }}
        />
      )}
    </>
  );
}
