# Reglas de negocio implementadas

La lógica vive en `src/lib/actions.ts` (operaciones) y `src/lib/calc.ts` (cálculos). Cada operación es una función pura
`(datos, contexto, entrada) → { ok, … } | { ok:false, error }` que valida permisos y datos, y registra el cambio en el historial.

## Roles

| Rol | Puede | No puede |
|---|---|---|
| Administrador | Todo, incluyendo anular, autorizar excepciones, validar registros, editar catálogos y configuración | — |
| Vendedor | Crear, confirmar y anular **sus** ventas; registrar pagos de ellas (no anularlos); crear despachos de ellas; ver clientes y precios; ver su historial; descuento hasta el tope configurado (5 %) y variación de precio hasta ±10 % | Ver ventas ajenas; modificar combustible, odómetros o registros; autorizar exceso; configuración |
| Conductor | Ver sus entregas; iniciar, registrar viajes, lecturas, combustible, insumos; informar incidencias; finalizar | Ver ventas, precios, montos ni otras secciones |

La interfaz oculta lo que no corresponde y las operaciones lo vuelven a verificar. **Es una simulación, no seguridad real.**

## Ventas

- Número correlativo automático. Estados guardados: borrador, confirmada, anulada. El resto del estado comercial se deriva (ver `FORMULAS.md`).
- Precio unitario congelado al crear; un precio fuera de la variación permitida o un descuento sobre el tope requieren permiso de administrador.
- Los pagos son movimientos separados (fecha, monto, método, nota). Un abono no puede superar el saldo pendiente ni estar fechado antes de la venta. Solo el administrador anula pagos.
- Anular una venta exige motivo. El administrador anula cualquiera; el vendedor, solo las suyas. No se puede anular una venta con volumen entregado (primero se anulan los despachos o viajes) ni con pagos vigentes (un administrador anula antes los pagos).
- Pagos anulados se conservan con motivo y no cuentan en ningún total.

## Despachos y viajes

- Una venta puede tener varios despachos; un despacho, varios viajes. Se puede crear un despacho independiente (sin venta) con motivo.
- El volumen solicitado de un despacho no puede superar el saldo por programar de la venta.
- Estados: programado → en curso → finalizado (o incidencia / anulado).
- Un viaje no puede superar la capacidad del vehículo ni el saldo de la venta; el **exceso** solo se permite con autorización
  explícita de un administrador y queda marcado.
- Un vehículo en mantenimiento o fuera de servicio no se puede asignar salvo excepción autorizada por un administrador.
- Los trabajos de maquinaria y las operaciones sin venta (con motivo) las crea solo el administrador. El despacho no puede ser anterior a la fecha de la venta.
- Solo el administrador agrega viajes manualmente o anula viajes. El vendedor solo puede anular un despacho de su venta si aún está programado y sin viajes.
- Anular un viaje o un despacho exige motivo, conserva el registro y recalcula entregado, pendiente y estado comercial.
- Talonario: conformidad del cliente por **nombre y fecha/hora** (no es firma); validación de supervisor aparte.

## Conductor

- El conductor solo ve despachos asignados a él. «Guardar avance» conserva lo ingresado sin finalizar.
- Para finalizar se exigen: viajes con volumen (en transporte), lectura inicial y final con final > inicial, combustible consumido (puede ser 0) y confirmación con nombre; el sistema lista lo que falta.
- Si el vehículo está en mantenimiento o fuera de servicio, el conductor no puede operar y debe avisar al administrador.
- Km (camiones) y horómetro (maquinaria) se distinguen en etiquetas y validación.
- Combustible consumido lo escribe el conductor; combustible cargado es otro dato. Insumos de mantención son opcionales.

## Registro diario

- Un registro por vehículo y día, que **consolida** los despachos sin duplicar datos.
- Estados: pendiente → validado, o devuelto (con comentario de qué corregir). Solo se valida si todas las operaciones están finalizadas; si hay datos incompletos o inconsistentes se pide confirmación explícita y quedan excluidos de rendimientos. Al validar se actualiza la lectura actual del vehículo.
- Editar un registro ya validado exige indicar motivo; quedan registrados quién, cuándo y por qué.

## Historial

Cada cambio relevante (ventas, pagos, despachos, viajes, registros, catálogos, configuración) se anota con usuario, fecha y detalle.
El vendedor solo ve los cambios sobre sus propias ventas, despachos y pagos.
