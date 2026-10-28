import { describe, expect, it } from "vitest";
import { ADMIN, CONDUCTOR, CONDUCTOR2, VENDEDOR, datos, falla, ok } from "./helpers";
import { eliminarInsumoConductor, registrarInsumoConductor } from "../src/lib/actions";

/** Primer despacho programado/en curso asignado al conductor indicado. */
function entregaAbierta(d: ReturnType<typeof datos>, conductorId: string) {
  const x = d.despachos.find((y) => y.conductorId === conductorId && (y.estado === "programado" || y.estado === "en_curso"));
  if (!x) throw new Error("No hay entrega abierta para la prueba");
  return x;
}

describe("insumos informados por el conductor", () => {
  it("el conductor asignado puede registrar y quitar su insumo", () => {
    const d = datos();
    const e = entregaAbierta(d, "u-cond-1");
    const r = ok(registrarInsumoConductor(d, CONDUCTOR, e.id, { tipo: "aceite_motor", cantidad: 2, unidad: "L", nota: "Reposición" }));
    const nuevo = r.data.insumos.find((x) => x.id === r.id)!;
    expect(nuevo.vehiculoId).toBe(e.vehiculoId);
    expect(nuevo.creadoPor).toBe("u-cond-1");
    expect(r.data.cambios.some((c) => c.entidadId === r.id)).toBe(true);
    const q = ok(eliminarInsumoConductor(r.data, CONDUCTOR, r.id));
    expect(q.data.insumos.some((x) => x.id === r.id)).toBe(false);
  });

  it("rechaza cantidades inválidas", () => {
    const d = datos();
    const e = entregaAbierta(d, "u-cond-1");
    expect(falla(registrarInsumoConductor(d, CONDUCTOR, e.id, { tipo: "grasa", cantidad: 0, unidad: "kg" })).campo).toBe("cantidad");
    expect(falla(registrarInsumoConductor(d, CONDUCTOR, e.id, { tipo: "grasa", cantidad: -3, unidad: "kg" })).campo).toBe("cantidad");
  });

  it("otro conductor, el vendedor y el administrador no pueden usar este flujo en una entrega ajena", () => {
    const d = datos();
    const e = entregaAbierta(d, "u-cond-1");
    expect(falla(registrarInsumoConductor(d, CONDUCTOR2, e.id, { tipo: "filtros", cantidad: 1, unidad: "un" })).error).toMatch(/no está asignada/i);
    expect(falla(registrarInsumoConductor(d, VENDEDOR, e.id, { tipo: "filtros", cantidad: 1, unidad: "un" })).ok).toBe(false);
  });

  it("un conductor no puede quitar el insumo de otra persona", () => {
    const d = datos();
    const e = entregaAbierta(d, "u-cond-1");
    const r = ok(registrarInsumoConductor(d, CONDUCTOR, e.id, { tipo: "otros", cantidad: 1, unidad: "un" }));
    expect(falla(eliminarInsumoConductor(r.data, CONDUCTOR2, r.id)).error).toMatch(/informaste tú/i);
    expect(falla(eliminarInsumoConductor(r.data, ADMIN, r.id)).ok).toBe(false);
  });
});
