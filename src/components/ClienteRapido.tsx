"use client";
import { useState } from "react";
import { guardarEntidad } from "@/lib/actions";
import { Boton } from "@/components/ui/base";
import { CampoTexto } from "@/components/ui/form";
import { Modal, notificar } from "@/components/ui/overlay";
import { correr } from "./acciones";

/** Alta rápida de cliente desde el formulario de venta. */
export function ClienteRapido({ onCreado, onCerrar }: { onCreado: (id: string) => void; onCerrar: () => void }) {
  const [v, setV] = useState({ nombre: "", rut: "", telefono: "", email: "", contacto: "" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  function guardar() {
    const r = correr((d, c) => guardarEntidad(d, c, "clientes", { ...v, activo: true }), { silencioso: true });
    if (!r.ok) {
      setErrores({ [r.campo ?? "nombre"]: r.error });
      return;
    }
    notificar("exito", "Cliente registrado.");
    onCreado(r.id);
  }

  return (
    <Modal titulo="Registrar cliente" descripcion="Usa datos ficticios en la demostración." onCerrar={onCerrar} pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Guardar cliente</Boton></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto claseCampo="sm:col-span-2" etiqueta="Nombre o razón social" obligatorio value={v.nombre} onChange={set("nombre")} error={errores.nombre} autoFocus />
        <CampoTexto etiqueta="RUT (opcional)" value={v.rut} onChange={set("rut")} error={errores.rut} placeholder="76.123.456-7" />
        <CampoTexto etiqueta="Teléfono" value={v.telefono} onChange={set("telefono")} error={errores.telefono} placeholder="+56 9 1234 5678" />
        <CampoTexto etiqueta="Correo electrónico" type="email" value={v.email} onChange={set("email")} error={errores.email} />
        <CampoTexto etiqueta="Persona de contacto" value={v.contacto} onChange={set("contacto")} error={errores.contacto} />
      </div>
    </Modal>
  );
}
