"use client";
import { useRouter } from "next/navigation";
import { useEstadoStore, iniciarSesion } from "@/lib/store";
import { inicioDeRol } from "@/lib/permisos";
import { ETIQUETAS, type Rol, type Usuario } from "@/lib/types";
import { Cargando } from "@/components/ui/base";
import { InsigniaDemo, Marca, AvisosGlobales } from "@/components/AppShell";
import { ChevronRight, HardHat, Receipt, ShieldCheck, Smartphone, Truck } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

const DESCRIPCION: Record<Rol, { texto: string; puntos: string[]; Icono: typeof Truck; color: string }> = {
  admin: {
    texto: "Gestión completa de la operación",
    puntos: ["Dashboards con filtros e indicadores", "Ventas, despachos y validación de registros", "Flota, combustible, reportes y configuración"],
    Icono: ShieldCheck,
    color: "bg-navy-900 text-white",
  },
  vendedor: {
    texto: "Ventas propias y seguimiento al cliente",
    puntos: ["Panel comercial con sus ventas", "Clientes, precios y cobranza", "Programa despachos de sus ventas"],
    Icono: Receipt,
    color: "bg-brand-600 text-white",
  },
  conductor: {
    texto: "Flujo simple para usar en terreno",
    puntos: ["Entregas asignadas del día", "Registro de viajes, km/horas y combustible", "Pensado para el celular"],
    Icono: Smartphone,
    color: "bg-accent-500 text-white",
  },
};

export default function PaginaIngreso() {
  const e = useEstadoStore();
  const router = useRouter();
  if (e.status !== "listo") return <Cargando texto="Preparando la demostración…" />;

  const principales = e.data.usuarios.filter((u) => u.activo && u.demoLabel);
  const otros = e.data.usuarios.filter((u) => u.activo && !u.demoLabel);

  const entrar = (u: Usuario) => {
    iniciarSesion(u.id);
    router.push(inicioDeRol(u.rol));
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-8 sm:py-12">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Marca claro />
          <InsigniaDemo />
        </header>

        <main className="my-auto py-10">
          <div className="mb-8 max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">ERP de ventas, despacho y control de flota</h1>
            <p className="mt-3 text-base text-navy-100">
              Elige un usuario de demostración para recorrer el sistema. Puedes cambiar de rol en cualquier momento desde la esquina superior derecha.
            </p>
          </div>

          <div className="mb-4"><AvisosGlobales /></div>

          <ul className="grid gap-4 md:grid-cols-3">
            {principales.map((u) => {
              const d = DESCRIPCION[u.rol];
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => entrar(u)}
                    className="group flex h-full w-full flex-col rounded-2xl bg-white p-5 text-left shadow-lg ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <span className={cn("mb-4 flex size-11 items-center justify-center rounded-xl", d.color)}><d.Icono className="size-6" aria-hidden /></span>
                    <span className="text-lg font-semibold text-navy-900">{u.demoLabel}</span>
                    <span className="text-sm text-slate-500">{u.nombre} · {ETIQUETAS.rol[u.rol]}</span>
                    <span className="mt-3 text-sm font-medium text-slate-800">{d.texto}</span>
                    <ul className="mt-2 space-y-1 text-[13px] text-slate-600">
                      {d.puntos.map((p) => (
                        <li key={p} className="flex gap-2"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent-500" aria-hidden />{p}</li>
                      ))}
                    </ul>
                    <span className="mt-5 inline-flex items-center gap-1 pt-1 text-sm font-semibold text-brand-600 group-hover:text-brand-700">
                      Entrar <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {otros.length > 0 && (
            <details className="mt-6 rounded-xl bg-white/5 p-4 text-navy-100 ring-1 ring-white/10">
              <summary className="cursor-pointer text-sm font-medium text-white">Otros usuarios de la demostración ({otros.length})</summary>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {otros.map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => entrar(u)} className="flex w-full items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10">
                      <HardHat className="size-4 shrink-0 text-accent-400" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-white">{u.nombre}</span>
                      <span className="text-xs text-navy-200">{ETIQUETAS.rol[u.rol]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </main>

        <footer className="max-w-3xl text-xs leading-relaxed text-navy-200/80">
          Esta es una demostración con datos ficticios que se guardan solo en este navegador. Los roles se simulan en la interfaz para mostrar los flujos:
          no constituyen seguridad real. En un sistema productivo la autenticación y los permisos deben aplicarse en el servidor.
        </footer>
      </div>
    </div>
  );
}
