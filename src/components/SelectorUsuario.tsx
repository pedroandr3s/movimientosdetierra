"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppData, Usuario } from "@/lib/types";
import { ETIQUETAS } from "@/lib/types";
import { inicioDeRol } from "@/lib/permisos";
import { cerrarSesion, iniciarSesion } from "@/lib/store";
import { iniciales } from "@/lib/formato";
import { cn } from "./ui/cn";
import { ChevronDown, LogOut, Check } from "./ui/icons";
import { Insignia } from "./ui/base";

/** Cambio de usuario/rol de demostración, siempre visible. No cierra sesión: solo cambia de rol. */
export function SelectorUsuario({ data, usuario, compacto }: { data: AppData; usuario: Usuario; compacto?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const activos = data.usuarios.filter((u) => u.activo);
  const principales = activos.filter((u) => u.demoLabel);
  const otros = activos.filter((u) => !u.demoLabel);

  function elegir(u: Usuario) {
    setAbierto(false);
    iniciarSesion(u.id);
    router.push(inicioDeRol(u.rol));
  }

  const Fila = ({ u }: { u: Usuario }) => (
    <li>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={u.id === usuario.id}
        onClick={() => elegir(u)}
        className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50", u.id === usuario.id && "bg-brand-50")}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-800">{iniciales(u.nombre)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">{u.demoLabel ?? u.nombre}</span>
          <span className="block truncate text-xs text-slate-500">{u.demoLabel ? `${u.nombre} · ` : ""}{ETIQUETAS.rol[u.rol]}</span>
        </span>
        {u.id === usuario.id && <Check className="size-4 text-brand-600" aria-hidden />}
      </button>
    </li>
  );

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-2 hover:bg-slate-50"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-navy-800 text-xs font-semibold text-white">{iniciales(usuario.nombre)}</span>
        {!compacto && (
          <span className="hidden text-left sm:block">
            <span className="block text-[13px] font-medium leading-tight text-slate-900">{usuario.nombre}</span>
            <span className="block text-[11px] leading-tight text-slate-500">{ETIQUETAS.rol[usuario.rol]}</span>
          </span>
        )}
        <Insignia tono={usuario.rol === "admin" ? "navy" : usuario.rol === "vendedor" ? "azul" : "naranja"} className="sm:hidden">{ETIQUETAS.rol[usuario.rol]}</Insignia>
        <ChevronDown className="size-4 text-slate-500" aria-hidden />
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animar-aparecer">
          <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">Cambiar usuario de demostración</p>
          <ul className="max-h-[60dvh] overflow-y-auto py-1">
            {principales.map((u) => <Fila key={u.id} u={u} />)}
            {otros.length > 0 && <li className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Otros usuarios</li>}
            {otros.map((u) => <Fila key={u.id} u={u} />)}
          </ul>
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              cerrarSesion();
              router.push("/");
            }}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="size-4" aria-hidden /> Volver a la pantalla de ingreso
          </button>
        </div>
      )}
    </div>
  );
}
