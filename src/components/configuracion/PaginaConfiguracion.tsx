"use client";
import { useRef, useState } from "react";
import { actualizarConfig } from "@/lib/actions";
import { hoyISO } from "@/lib/fecha";
import { exportarDatos, importarDatos, restaurarDemo, useData } from "@/lib/store";
import type { Config } from "@/lib/types";
import { Boton, EncabezadoTarjeta, Tarjeta } from "@/components/ui/base";
import { AvisoPagina, EncabezadoPagina } from "@/components/ui/datos";
import { CampoNumero, CampoTexto, Casilla, numATexto, parseNum } from "@/components/ui/form";
import { Download, Plus, RotateCcw, Upload } from "@/components/ui/icons";
import { ConfirmarDialogo, notificar } from "@/components/ui/overlay";
import { descargarTexto } from "@/lib/csv";
import { correr } from "@/components/acciones";

const UMBRALES: { clave: keyof Config["umbrales"]; etiqueta: string; unidad: string; ayuda: string }[] = [
  { clave: "consumoMaxCamionL100km", etiqueta: "Consumo máximo de camiones", unidad: "L/100 km", ayuda: "Sobre este valor se genera una alerta. Es un parámetro de demostración, no una recomendación." },
  { clave: "consumoMaxMaquinaLh", etiqueta: "Consumo máximo de maquinaria", unidad: "L/h", ayuda: "Parámetro de demostración." },
  { clave: "maxKmPorRegistro", etiqueta: "Kilómetros máximos por registro", unidad: "km", ayuda: "Sobre este valor la lectura se considera anómala y no entra en rendimientos." },
  { clave: "maxHorasPorRegistro", etiqueta: "Horas máximas por registro", unidad: "h", ayuda: "Ídem para horómetro." },
  { clave: "diasAvisoRevision", etiqueta: "Aviso de revisión con anticipación", unidad: "días", ayuda: "Días antes de la próxima revisión para alertar." },
];

export function PaginaConfiguracion() {
  const data = useData();
  const c = data.config;
  const [f, setF] = useState(() => ({
    nombre: c.empresa.nombre, giro: c.empresa.giro, rut: c.empresa.rut, direccion: c.empresa.direccion, telefono: c.empresa.telefono, correo: c.empresa.correo,
    iva: numATexto(c.ivaPct), descMax: numATexto(c.descuentoMaxVendedorPct), varPrecio: numATexto(c.variacionPrecioVendedorPct), dias: numATexto(c.diasVencimientoCredito),
  }));
  const [umbrales, setUmbrales] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(c.umbrales).map(([k, v]) => [k, numATexto(v)])));
  const [metodos, setMetodos] = useState(c.metodosPago);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorImport, setErrorImport] = useState<string | null>(null);
  const [pendienteImport, setPendienteImport] = useState<string | null>(null);
  const [restaurar, setRestaurar] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  function guardar() {
    const patch = {
      empresa: { nombre: f.nombre, giro: f.giro, rut: f.rut, direccion: f.direccion, telefono: f.telefono, correo: f.correo },
      ivaPct: parseNum(f.iva) ?? NaN,
      descuentoMaxVendedorPct: parseNum(f.descMax) ?? NaN,
      variacionPrecioVendedorPct: parseNum(f.varPrecio) ?? NaN,
      diasVencimientoCredito: parseNum(f.dias) ?? NaN,
      umbrales: Object.fromEntries(Object.entries(umbrales).map(([k, v]) => [k, parseNum(v) ?? NaN])) as unknown as Config["umbrales"],
      metodosPago: metodos.map((m) => ({ ...m, label: m.label.trim() })).filter((m) => m.label),
    };
    const r = correr((d, ctx) => actualizarConfig(d, ctx, patch), { silencioso: true });
    if (r.ok) { setErrores({}); notificar("exito", "Configuración guardada. Las ventas anteriores conservan su IVA y precios."); return; }
    setErrores({ [r.campo ?? "_"]: r.error });
    notificar("error", r.error);
  }

  function exportar() {
    const json = exportarDatos();
    if (!json) { notificar("error", "No hay datos para exportar todavía."); return; }
    descargarTexto(`respaldo_demo_movimiento_de_tierra_${hoyISO()}.json`, json, "application/json;charset=utf-8");
    notificar("exito", "Respaldo descargado.");
  }

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrorImport(null);
    if (file.size > 8 * 1024 * 1024) { setErrorImport("El archivo es demasiado grande (máximo 8 MB)."); return; }
    setPendienteImport(await file.text());
  }

  function confirmarImport() {
    const r = importarDatos(pendienteImport ?? "");
    setPendienteImport(null);
    if (r.ok) notificar("exito", "Datos importados correctamente."); else setErrorImport(r.error);
  }

  return (
    <>
      <EncabezadoPagina titulo="Configuración y datos" descripcion="Parámetros comerciales y operacionales de la demostración, y administración de los datos guardados en este navegador." acciones={<Boton onClick={guardar}>Guardar configuración</Boton>} />
      {errores._ && <div className="mb-4"><AvisoPagina tono="error">{errores._}</AvisoPagina></div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Datos de la empresa" subtitulo="Aparecen en talonarios e informes. Valores ficticios de demostración." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <CampoTexto claseCampo="sm:col-span-2" etiqueta="Nombre" obligatorio value={f.nombre} onChange={set("nombre")} error={errores["empresa.nombre"]} />
            <CampoTexto claseCampo="sm:col-span-2" etiqueta="Giro" value={f.giro} onChange={set("giro")} />
            <CampoTexto etiqueta="RUT" value={f.rut} onChange={set("rut")} />
            <CampoTexto etiqueta="Teléfono" value={f.telefono} onChange={set("telefono")} />
            <CampoTexto claseCampo="sm:col-span-2" etiqueta="Dirección" value={f.direccion} onChange={set("direccion")} />
            <CampoTexto claseCampo="sm:col-span-2" etiqueta="Correo" value={f.correo} onChange={set("correo")} />
          </div>
        </Tarjeta>

        <Tarjeta>
          <EncabezadoTarjeta titulo="Reglas comerciales" subtitulo="Los cambios aplican a ventas nuevas; las existentes conservan sus valores." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <CampoNumero etiqueta="IVA" unidad="%" value={f.iva} onChange={set("iva")} error={errores.ivaPct} />
            <CampoNumero etiqueta="Plazo de crédito" unidad="días" value={f.dias} onChange={set("dias")} error={errores.diasVencimientoCredito} />
            <CampoNumero etiqueta="Descuento máximo del vendedor" unidad="%" value={f.descMax} onChange={set("descMax")} error={errores.descuentoMaxVendedorPct} ayuda="Sobre este descuento solo el administrador puede vender." />
            <CampoNumero etiqueta="Variación de precio permitida al vendedor" unidad="%" value={f.varPrecio} onChange={set("varPrecio")} error={errores.variacionPrecioVendedorPct} ayuda="Respecto del precio de referencia del material." />
          </div>
        </Tarjeta>

        <Tarjeta>
          <EncabezadoTarjeta titulo="Métodos de pago" acciones={<Boton tamano="sm" variante="secundario" onClick={() => setMetodos((m) => [...m, { id: `mp-${Date.now().toString(36)}`, label: "", activo: true }])}><Plus className="size-4" /> Agregar</Boton>} />
          <ul className="divide-y divide-slate-100 p-2">
            {metodos.map((m, k) => (
              <li key={m.id} className="flex items-center gap-3 px-2 py-2">
                <input aria-label={`Nombre del método ${k + 1}`} value={m.label} placeholder="Nombre del método" onChange={(e) => setMetodos((ms) => ms.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)))} className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                <Casilla etiqueta="Activo" checked={m.activo} onChange={(e) => setMetodos((ms) => ms.map((x) => (x.id === m.id ? { ...x, activo: e.target.checked } : x)))} />
              </li>
            ))}
          </ul>
          {errores.metodosPago && <p role="alert" className="px-4 pb-3 text-sm font-medium text-red-600">{errores.metodosPago}</p>}
        </Tarjeta>

        <Tarjeta>
          <EncabezadoTarjeta titulo="Umbrales operacionales" subtitulo="Parámetros de demostración editables; no son recomendaciones oficiales." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            {UMBRALES.map((u) => (
              <CampoNumero key={u.clave} etiqueta={u.etiqueta} unidad={u.unidad} value={umbrales[u.clave] ?? ""} onChange={(e) => setUmbrales((s) => ({ ...s, [u.clave]: e.target.value }))} error={errores[u.clave]} ayuda={u.ayuda} />
            ))}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta className="mt-5">
        <EncabezadoTarjeta titulo="Gestión de datos" subtitulo="La demo guarda todo solo en este navegador (localStorage). No hay servidor ni base de datos." />
        <div className="space-y-4 p-4 sm:p-5">
          {errorImport && <AvisoPagina tono="error" titulo="No se pudo importar el archivo">{errorImport} Los datos actuales no se modificaron.</AvisoPagina>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="font-medium text-navy-900">Exportar respaldo</p>
              <p className="mb-3 mt-1 text-sm text-slate-600">Descarga todos los datos actuales en un archivo JSON.</p>
              <Boton variante="secundario" onClick={exportar}><Download className="size-4" /> Exportar JSON</Boton>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="font-medium text-navy-900">Importar respaldo</p>
              <p className="mb-3 mt-1 text-sm text-slate-600">Reemplaza los datos actuales por los de un respaldo. Se valida antes de aplicar.</p>
              <input ref={archivo} type="file" accept="application/json,.json" className="hidden" onChange={elegirArchivo} aria-label="Archivo de respaldo JSON" />
              <Boton variante="secundario" onClick={() => archivo.current?.click()}><Upload className="size-4" /> Importar JSON</Boton>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
              <p className="font-medium text-navy-900">Restaurar datos de demostración</p>
              <p className="mb-3 mt-1 text-sm text-slate-600">Descarta los cambios y vuelve a los datos de ejemplo iniciales.</p>
              <Boton variante="peligro" onClick={() => setRestaurar(true)}><RotateCcw className="size-4" /> Restaurar demo</Boton>
            </div>
          </div>
          <AvisoPagina tono="info" titulo="Sobre la simulación de roles">Cambiar de usuario en la parte superior solo simula permisos en la interfaz. No es seguridad real: en un sistema productivo la autenticación y los permisos se aplican en el servidor.</AvisoPagina>
        </div>
      </Tarjeta>

      {pendienteImport !== null && (
        <ConfirmarDialogo peligro titulo="Importar respaldo" mensaje="Se reemplazarán TODOS los datos actuales por los del archivo. Si no es un respaldo válido de esta demostración, se rechazará sin cambios. ¿Continuar?" textoConfirmar="Importar y reemplazar" onCancelar={() => setPendienteImport(null)} onConfirmar={confirmarImport} />
      )}
      {restaurar && (
        <ConfirmarDialogo peligro titulo="Restaurar datos de demostración" mensaje="Se perderán las ventas, despachos y demás cambios que hayas hecho en este navegador. Esta acción no se puede deshacer (exporta un respaldo antes si quieres conservarlos)." textoConfirmar="Sí, restaurar" onCancelar={() => setRestaurar(false)} onConfirmar={() => { restaurarDemo(); setRestaurar(false); notificar("exito", "Datos de demostración restaurados."); }} />
      )}
    </>
  );
}
