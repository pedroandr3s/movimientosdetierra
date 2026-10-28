"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEstadoStore, descartarAviso } from "@/lib/store";
import { idx } from "@/lib/calc";
import { NAV, inicioDeRol } from "@/lib/permisos";
import { puedeVerRuta } from "@/lib/rutas";
import { ETIQUETAS } from "@/lib/types";
import { SelectorUsuario } from "./SelectorUsuario";
import { cn } from "./ui/cn";
import { Cargando, EnlaceBoton } from "./ui/base";
import { AvisoPagina, EstadoVacio } from "./ui/datos";
import { IconoNav, Menu, ShieldCheck, Truck, X } from "./ui/icons";

export function InsigniaDemo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-medium text-accent-700 ring-1 ring-inset ring-accent-100", className)}>
      <span className="size-1.5 rounded-full bg-accent-500" aria-hidden />
      Modo demostración · Datos de ejemplo
    </span>
  );
}

export function Marca({ claro }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-accent-500 text-white shadow-sm"><Truck className="size-5" aria-hidden /></span>
      <div className="leading-tight">
        <p className={cn("text-sm font-semibold", claro ? "text-white" : "text-navy-900")}>Movimiento de Tierra</p>
        <p className={cn("text-[11px]", claro ? "text-navy-200" : "text-slate-500")}>CR SPA · Ventas y flota</p>
      </div>
    </div>
  );
}

/** Aviso de errores de persistencia / datos restaurados. */
export function AvisosGlobales() {
  const e = useEstadoStore();
  if (e.status !== "listo") return null;
  return (
    <div className="no-imprimir mb-4 space-y-2">
      {e.errorPersistencia && (
        <AvisoPagina tono="error" titulo="No se pudieron guardar los cambios en este navegador" accion={<button type="button" className="text-xs font-medium underline" onClick={() => descartarAviso("persistencia")}>Ocultar</button>}>
          {e.errorPersistencia} Los cambios seguirán visibles mientras no cierres la pestaña; exporta una copia desde Configuración y datos.
        </AvisoPagina>
      )}
      {e.avisoCarga && (
        <AvisoPagina tono="alerta" titulo="Se restauraron los datos de demostración" accion={<button type="button" className="text-xs font-medium underline" onClick={() => descartarAviso("carga")}>Entendido</button>}>
          {e.avisoCarga}
        </AvisoPagina>
      )}
    </div>
  );
}

export function AccesoRestringido() {
  const e = useEstadoStore();
  const rol = e.status === "listo" && e.userId ? idx(e.data).usuarios.get(e.userId)?.rol : undefined;
  return (
    <EstadoVacio
      icono={<ShieldCheck className="size-6" aria-hidden />}
      titulo="Esta sección no está disponible para tu rol"
      descripcion={`Con el rol ${rol ? ETIQUETAS.rol[rol] : "actual"} no puedes ver esta página. Puedes cambiar de usuario de demostración desde la esquina superior derecha.`}
      accion={rol ? <EnlaceBoton href={inicioDeRol(rol)} variante="primario">Ir a mi inicio</EnlaceBoton> : undefined}
    />
  );
}

/** Verifica sesión y permisos de ruta; entrega usuario y datos ya cargados. */
export function useSesionProtegida() {
  const e = useEstadoStore();
  const router = useRouter();
  const ruta = usePathname();
  const sinSesion = e.status === "listo" && !e.userId;
  useEffect(() => {
    if (sinSesion) router.replace("/");
  }, [sinSesion, router]);
  if (e.status !== "listo" || !e.userId) return { listo: false as const };
  const usuario = idx(e.data).usuarios.get(e.userId);
  if (!usuario) return { listo: false as const };
  return { listo: true as const, data: e.data, usuario, permitido: puedeVerRuta(usuario.rol, ruta), ruta };
}

export function AppShell({ children }: { children: ReactNode }) {
  const s = useSesionProtegida();
  const [menu, setMenu] = useState(false);

  if (!s.listo) return <Cargando texto="Cargando la demostración…" />;
  const { usuario, data, ruta, permitido } = s;
  const items = NAV[usuario.rol];
  const grupos = [...new Set(items.map((i) => i.grupo))];

  const activo = (href: string) => {
    if (href === "/admin" || href === "/vendedor") return ruta === href;
    return ruta === href || ruta.startsWith(`${href}/`);
  };

  const navegacion = (
    <nav aria-label="Navegación principal" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {grupos.map((g) => (
        <div key={g}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-200/70">{g}</p>
          <ul className="space-y-0.5">
            {items.filter((i) => i.grupo === g).map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={() => setMenu(false)}
                  aria-current={activo(i.href) ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors", activo(i.href) ? "bg-white/10 font-medium text-white shadow-[inset_3px_0_0_var(--color-accent-500)]" : "text-navy-100 hover:bg-white/5 hover:text-white")}
                >
                  <IconoNav nombre={i.icono} className="size-[18px] shrink-0" />
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="no-imprimir sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-navy-900 lg:flex">
        <div className="border-b border-white/10 px-5 py-4"><Marca claro /></div>
        {navegacion}
        <div className="border-t border-white/10 p-4 text-[11px] leading-relaxed text-navy-200/80">
          Demostración con datos ficticios guardados solo en este navegador.
        </div>
      </aside>

      {menu && (
        <div className="no-imprimir fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/50" onClick={() => setMenu(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy-900 animar-aparecer">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <Marca claro />
              <button type="button" onClick={() => setMenu(false)} aria-label="Cerrar menú" className="rounded-md p-1.5 text-navy-100 hover:bg-white/10"><X className="size-5" /></button>
            </div>
            {navegacion}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-imprimir sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setMenu(true)} aria-label="Abrir menú" className="rounded-md p-2 text-navy-800 hover:bg-slate-100 lg:hidden"><Menu className="size-5" /></button>
          <InsigniaDemo className="hidden sm:inline-flex" />
          <InsigniaDemo className="max-w-[9.5rem] truncate sm:hidden" />
          <div className="ml-auto"><SelectorUsuario data={data} usuario={usuario} /></div>
        </header>
        <main className="contenedor-impresion mx-auto w-full max-w-[1440px] flex-1 px-3 py-5 sm:px-6 sm:py-6">
          <AvisosGlobales />
          {permitido ? children : <AccesoRestringido />}
        </main>
      </div>
    </div>
  );
}
