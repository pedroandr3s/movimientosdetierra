"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccesoRestringido, AvisosGlobales, InsigniaDemo, Marca, useSesionProtegida } from "./AppShell";
import { SelectorUsuario } from "./SelectorUsuario";
import { Cargando } from "./ui/base";
import { cn } from "./ui/cn";
import { ClipboardList, History } from "./ui/icons";

/** Contenedor móvil del conductor: barra superior simple y navegación inferior con botones grandes. */
export function ConductorShell({ children }: { children: ReactNode }) {
  const s = useSesionProtegida();
  const ruta = usePathname();
  if (!s.listo) return <Cargando texto="Cargando…" />;
  const { usuario, data, permitido } = s;

  const tabs = [
    { href: "/conductor", etiqueta: "Mis entregas", Icono: ClipboardList, activo: ruta === "/conductor" || ruta.startsWith("/conductor/entrega") },
    { href: "/conductor/historial", etiqueta: "Historial", Icono: History, activo: ruta.startsWith("/conductor/historial") },
  ];

  return (
    <div className="min-h-dvh bg-surface pb-24">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-2">
          <Marca />
          <div className="ml-auto"><SelectorUsuario data={data} usuario={usuario} compacto /></div>
        </div>
        <div className="bg-accent-50 px-3 py-1 text-center"><InsigniaDemo className="bg-transparent ring-0" /></div>
      </header>
      <main className="mx-auto w-full max-w-xl px-3 py-4">
        <AvisosGlobales />
        {permitido ? children : <AccesoRestringido />}
      </main>
      <nav aria-label="Navegación del conductor" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-xl grid-cols-2">
          {tabs.map((t) => (
            <li key={t.href}>
              <Link href={t.href} aria-current={t.activo ? "page" : undefined} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium", t.activo ? "text-brand-600 shadow-[inset_0_2px_0_var(--color-accent-500)]" : "text-slate-500")}>
                <t.Icono className="size-6" aria-hidden />
                {t.etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
