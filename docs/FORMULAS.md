# Fórmulas y definiciones de métricas

Todas las métricas se calculan en `src/lib/calc.ts` a partir de los datos (nada está escrito a mano en pantalla).
Cuando no hay datos suficientes para un cálculo, la app muestra **«Sin datos suficientes»** en vez de un 0 engañoso.

## Ventas

| Concepto | Definición |
|---|---|
| Bruto | `round(cantidad m³ × precio unitario neto)` |
| Descuento | `round(bruto × descuento % / 100)` |
| Neto | `bruto − descuento` |
| IVA | `round(neto × IVA % / 100)` (IVA configurable; por defecto 19 %) |
| Total | `neto + IVA`. Es el importe que se cobra |
| Precio unitario | Se copia (snapshot) del precio vigente al crear la venta; cambios posteriores del catálogo no la alteran |
| Venta válida para indicadores | Estado guardado `confirmada`. Borradores y anuladas no cuentan |

Todos los montos se redondean a pesos enteros (CLP sin decimales).

## Entrega

| Concepto | Definición |
|---|---|
| Viaje efectivo | Viaje con estado `válido` cuyo despacho no está anulado |
| Volumen entregado (despacho) | Suma de m³ de sus viajes efectivos |
| Volumen entregado (venta) | Suma del entregado de todos sus despachos (sin duplicar) |
| Volumen programado | Suma del volumen solicitado de despachos no anulados |
| Volumen pendiente | `max(0, vendido − entregado)`; solo para ventas confirmadas |
| Exceso | `max(0, entregado − vendido)`; solo posible con autorización explícita |
| Viajes planificados | `ceil(volumen solicitado / capacidad del camión)` |

### Estado comercial (derivado, no se puede forzar)

1. `borrador` o `anulada` si así está guardado.
2. `entregada` si entregado > 0 y entregado ≥ vendido.
3. `parcial` si 0 < entregado < vendido.
4. `en despacho` si no hay entregado pero existe algún despacho no anulado.
5. `confirmada` en otro caso.

Anular un viaje o un despacho recalcula automáticamente este estado.

## Cobranza

| Concepto | Definición |
|---|---|
| Cobrado | Suma de pagos no anulados de la venta |
| Saldo | `max(0, total − cobrado)` |
| Estado de pago | Prioridad: **pagada** (saldo ≤ 0) → **vencida** (hay vencimiento anterior a hoy y saldo > 0) → **parcial** (cobrado > 0) → **pendiente** |
| Plazo de crédito | Por defecto 30 días desde la fecha de venta (configurable) |
| Cobrado en el periodo (KPI) | Pagos no anulados con fecha dentro del periodo, de ventas que cumplen los filtros |
| Ventas pendientes de pago (KPI) | Ventas del periodo con saldo > 0: cantidad y suma de saldos |

El estado de pago es independiente del estado de entrega: se puede cobrar antes de entregar y entregar antes de cobrar.

## Flota y combustible

| Concepto | Definición |
|---|---|
| Trabajo de un despacho | `lectura final − lectura inicial` del medidor del vehículo (**km** para camiones, **horas** para maquinaria) |
| Lectura válida | Ambas lecturas presentes, diferencia > 0 y ≤ umbral máximo (450 km o 14 h por registro, configurables). Si no, se marca *incompleta*, *inconsistente* o *anómala* y **se excluye** de rendimientos |
| Combustible consumido | Litros **ingresados por el conductor** en el despacho. Nunca se infiere ni se calcula |
| Combustible cargado | Litros cargados en estación (movimiento aparte). **No es lo mismo que consumido** |
| Rendimiento camiones | `litros consumidos / km × 100` (L/100 km), solo con despachos que tienen km válidos **y** combustible registrado |
| Consumo maquinaria | `litros consumidos / horas` (L/h), solo con horas válidas **y** combustible registrado |
| Km de flota / Horas de maquinaria | Suma de trabajo válido de despachos no anulados del periodo |
| Registros excluidos | Despachos finalizados sin lectura válida o sin combustible: se cuentan aparte, no se tratan como cero |
| Última lectura de un vehículo | Mayor valor entre la lectura actual del vehículo y las lecturas finales de despachos no anulados. La lectura actual del vehículo se actualiza solo al **validar** un registro diario |

## Indicadores (KPI) y comparación

- Los 10 KPI de los dashboards respetan los filtros globales (periodo, vendedor, cliente, material, vehículo, etc.).
- **Variación vs periodo anterior** = `(actual − anterior) / |anterior| × 100`. Periodo anterior: para «Este mes», el mismo tramo del mes previo; para «Mes anterior», el mes anterior a ese;
  para «Este año», el mismo tramo del año previo; en el resto de los casos, un periodo de igual duración inmediatamente anterior. Si no hay base (anterior = 0 o sin datos) se muestra «—», no un porcentaje inventado.
- **Entregas pendientes**: despachos en estado programado, en curso o con incidencia, con fecha ≤ fin del periodo.
- **Ventas del periodo**: se asignan por fecha de venta; **volumen entregado** y **viajes**, por fecha del viaje; **pagos**, por fecha de pago.
- Gráficos: la granularidad se elige según el largo del periodo: hasta 45 días por día, hasta 200 por semana, más por mes.

## Alertas (derivadas)

Se calculan cada vez desde los datos con umbrales de la configuración (valores de demostración, editables):

- Incidencias abiertas; entregas con retraso (programadas o en curso con fecha anterior a hoy).
- Volumen pendiente de ventas con fecha de entrega vencida y sin despacho activo.
- Registros diarios sin validar (y los devueltos al conductor).
- Lecturas anómalas o inconsistentes; consumo sobre 55 L/100 km (camiones) o 16 L/h (maquinaria).
- Vehículos con revisión vencida o próxima (aviso 15 días) y vehículos en mantenimiento/fuera de servicio.
- Información incompleta en despachos finalizados; cobranza vencida; exceso de volumen en ventas.
