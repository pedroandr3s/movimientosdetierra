import type { EstadoComercial, EstadoDespacho, EstadoPago, EstadoRegistro, EstadoVehiculo } from "@/lib/types";
import { ETIQUETAS } from "@/lib/types";
import { Insignia, type Tono } from "./ui/base";

const COMERCIAL: Record<EstadoComercial, Tono> = {
  borrador: "gris",
  confirmada: "azul",
  en_despacho: "naranja",
  parcial: "amarillo",
  entregada: "verde",
  anulada: "rojo",
};
const PAGO: Record<EstadoPago, Tono> = { pendiente: "gris", parcial: "amarillo", pagada: "verde", vencida: "rojo" };
const DESPACHO: Record<EstadoDespacho, Tono> = { programado: "azul", en_curso: "naranja", finalizado: "verde", incidencia: "rojo", anulado: "gris" };
const REGISTRO: Record<EstadoRegistro, Tono> = { pendiente: "amarillo", validado: "verde", devuelto: "rojo" };
const VEHICULO: Record<EstadoVehiculo, Tono> = { disponible: "verde", en_operacion: "naranja", en_mantenimiento: "amarillo", fuera_de_servicio: "rojo" };

export const BadgeComercial = ({ estado }: { estado: EstadoComercial }) => <Insignia tono={COMERCIAL[estado]}>{ETIQUETAS.estadoComercial[estado]}</Insignia>;
export const BadgePago = ({ estado }: { estado: EstadoPago | null }) => (estado ? <Insignia tono={PAGO[estado]}>{ETIQUETAS.estadoPago[estado]}</Insignia> : <span className="text-slate-400">—</span>);
export const BadgeDespacho = ({ estado }: { estado: EstadoDespacho }) => <Insignia tono={DESPACHO[estado]}>{ETIQUETAS.estadoDespacho[estado]}</Insignia>;
export const BadgeRegistro = ({ estado }: { estado: EstadoRegistro }) => <Insignia tono={REGISTRO[estado]}>{ETIQUETAS.estadoRegistro[estado]}</Insignia>;
export const BadgeVehiculo = ({ estado }: { estado: EstadoVehiculo }) => <Insignia tono={VEHICULO[estado]}>{ETIQUETAS.estadoVehiculo[estado]}</Insignia>;
