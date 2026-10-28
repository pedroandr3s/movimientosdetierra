import { generarDatosDemo } from "../src/lib/seed";
import { estadoComercialVenta, estadoPagoVenta, volumenEntregadoVenta, totalesVenta, cobradoVenta, trabajoDespacho, calcularKpis, rangoDePreset, resumenFlota } from "../src/lib/calc";
import { generarAlertas } from "../src/lib/alertas";

const hoy = process.argv[2] ?? "2026-10-27";
const d = generarDatosDemo(hoy);
const cuenta = (arr: string[]) => arr.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
console.log("ventas", d.ventas.length, "despachos", d.despachos.length, "viajes", d.viajes.length, "pagos", d.pagos.length, "registros", d.registros.length, "cargas", d.cargas.length, "insumos", d.insumos.length, "cambios", d.cambios.length);
console.log("estado comercial", cuenta(d.ventas.map((v) => estadoComercialVenta(d, v))));
console.log("estado pago", cuenta(d.ventas.map((v) => String(estadoPagoVenta(d, v, hoy)))));
console.log("estado despacho", cuenta(d.despachos.map((x) => x.estado)));
console.log("registros", cuenta(d.registros.map((r) => r.estado)));
let problemas = 0;
for (const v of d.ventas) {
  const ent = volumenEntregadoVenta(d, v.id);
  if (ent > v.cantidadM3 + 1e-9) { problemas++; console.log("EXCESO", v.numero, ent, v.cantidadM3); }
  const cob = cobradoVenta(d, v.id);
  if (cob > totalesVenta(v).total) { problemas++; console.log("SOBREPAGO", v.numero, cob, totalesVenta(v).total); }
}
for (const x of d.despachos) {
  const veh = d.vehiculos.find((q) => q.id === x.vehiculoId);
  if (!veh) { problemas++; console.log("VEH?", x.numero); }
  if (!d.usuarios.find((u) => u.id === x.conductorId)) { problemas++; console.log("COND?", x.numero); }
  if (x.ventaId && !d.ventas.find((v) => v.id === x.ventaId)) { problemas++; console.log("VENTA?", x.numero); }
}
for (const v of d.viajes) {
  const dd = d.despachos.find((x) => x.id === v.despachoId);
  if (!dd) { problemas++; console.log("VIAJE huérfano", v.id); continue; }
  const cap = d.vehiculos.find((q) => q.id === v.vehiculoId)?.capacidadM3 ?? 0;
  if (v.cantidadM3 > cap + 1e-9) { problemas++; console.log("VIAJE sobre capacidad", v.id, v.cantidadM3, cap); }
}
// lecturas monótonas por vehículo (despachos no programados, orden por número)
for (const veh of d.vehiculos) {
  let prev = -1;
  for (const x of d.despachos.filter((q) => q.vehiculoId === veh.id && q.lecturaInicial != null)) {
    if (prev >= 0 && x.lecturaInicial! < prev - 0.001) { problemas++; console.log("LECTURA retrocede", veh.codigo, x.numero, prev, x.lecturaInicial); }
    prev = x.lecturaFinal != null && x.lecturaFinal > x.lecturaInicial! ? x.lecturaFinal : x.lecturaInicial!;
  }
}
console.log("trabajo inválido:", cuenta(d.despachos.filter((x) => x.estado === "finalizado").map((x) => { const t = trabajoDespacho(d, x); return t.valida ? "valida" : t.motivo ?? "?"; })));
console.log("vehículos", d.vehiculos.map((v) => `${v.codigo}:${v.lecturaActual}:${v.estado}`).join(" | "));
const k = calcularKpis(d, { preset: "30d" }, rangoDePreset("30d", hoy), hoy);
console.log("KPI 30d", k);
console.log("flota 30d", resumenFlota(d, d.despachos.filter((x) => x.fecha >= "2026-09-28")));
const al = generarAlertas(d, hoy);
console.log("alertas", al.length, cuenta(al.map((a) => a.tipo)));
al.slice(0, 14).forEach((a) => console.log(" -", a.severidad, a.titulo, "|", a.detalle));
console.log("problemas:", problemas);
