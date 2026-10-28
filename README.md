# ERP de ventas, despacho y control de flota — Movimiento de Tierra CR SPA

Demostración interactiva (frontend) de un sistema para vender áridos, despachar camiones y controlar flota y combustible.
**No es un sistema de producción:** no tiene backend ni seguridad real. Todos los datos son ficticios, se generan de forma
determinista y se guardan solo en el `localStorage` del navegador. Un distintivo permanente en pantalla indica
«Modo demostración · Datos de ejemplo».

## Cómo ejecutarlo

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run typecheck` | Revisión de tipos (`tsc --noEmit`) |
| `npm run lint` | ESLint sobre `src` |
| `npm test` | Pruebas unitarias (Vitest) de reglas de negocio, datos de ejemplo, acciones y reportes |
| `npm run build` | Compilación de producción |
| `npm start` | Sirve la compilación (`npm run build` antes) |
| `npm run check` | typecheck + lint + test + build |

## Usuarios de demostración

Al abrir la app se elige un perfil; luego se puede cambiar en cualquier momento desde el selector de la esquina superior
derecha, sin cerrar sesión.

| Rol | Usuario | Qué ve |
|---|---|---|
| Administrador | Carolina Muñoz | Todo: 4 dashboards, ventas, despachos, registros diarios, combustible, catálogos, reportes, historial, configuración |
| Vendedor | Camila Fuentes | Solo sus ventas y los despachos de ellas, clientes, precios, su historial. No modifica combustible ni odómetros |
| Conductor | Héctor Valdés | Vista móvil simple: sus entregas del día, flujo de 3 pasos, historial propio |

> La separación de roles es una **simulación de interfaz**. No es seguridad: ver `docs/LIMITACIONES.md`.

## Qué incluye

- **Dashboards del administrador** (general, comercial, operacional, flota y combustible) con filtros globales que realmente
  recalculan indicadores, comparación con el periodo anterior, gráficos, alertas derivadas y accesos rápidos.
- **Ventas**: numeración automática, precio congelado al momento de la venta, descuento con tope por rol, IVA configurable,
  pagos como movimientos independientes, estado de pago independiente del estado de entrega.
- **Despachos y viajes**: una venta puede tener varios despachos y varios viajes; el volumen entregado es la suma de viajes
  válidos; el exceso exige autorización explícita; las anulaciones quedan registradas y recalculan todo.
  Talonario imprimible con conformidad (nombre y fecha/hora, no firma) y validación del supervisor.
- **Vista del conductor**: elegir entrega → registrar operación (lecturas, viajes, combustible consumido y cargado,
  insumos opcionales) → revisar y finalizar. Permite «Guardar avance».
- **Registro diario** por vehículo: consolida sin duplicar, el supervisor valida o devuelve; editar un registro validado exige
  indicar quién, cuándo y por qué.
- **Combustible e insumos**, **catálogos** (clientes, faenas, vehículos, materiales, usuarios), **12 reportes** con
  exportación CSV de las filas filtradas y vista imprimible, **historial de cambios**.
- **Configuración y datos**: IVA, descuentos, umbrales de alertas, métodos de pago; exportar/importar JSON; restaurar datos de demo.

## Estructura del código

```
src/
  app/                    Rutas (App Router). (app)/ = administración y vendedor, (conductor)/ = vista móvil
  components/
    ui/                   Kit de componentes (botones, tablas, formularios, diálogos, iconos)
    dash/  ventas/  despachos/  registros/  combustible/  conductor/  catalogos/  reportes/  configuracion/  historial/
  lib/
    types.ts              Modelo de datos (AppData es la única fuente de verdad)
    calc.ts               Cálculos y métricas puras (totales, volúmenes, estados, KPI, rendimientos)
    actions.ts            Operaciones de negocio puras: (datos, contexto, entrada) → Resultado
    validaciones.ts       Validaciones de entrada
    permisos.ts / rutas.ts  Matriz de permisos de interfaz y acceso por ruta
    alertas.ts            Alertas derivadas de los datos
    reportes.ts           Definición y generación de los 12 reportes
    seed.ts               Datos de ejemplo deterministas
    store.ts / persist.ts Estado en memoria + persistencia en localStorage
tests/                    Pruebas (Vitest)
docs/                     FORMULAS.md, REGLAS-DE-NEGOCIO.md, LIMITACIONES.md
```

Las operaciones de negocio son funciones puras separadas de la interfaz, para poder trasladarlas a un backend
(ver `docs/LIMITACIONES.md`, sección «Hacia un backend real»).

## Datos y restauración

- Los datos se guardan en las claves `cr-erp-demo:datos:v1` y `cr-erp-demo:sesion:v1` de `localStorage`.
- En **Configuración y datos** se puede exportar/importar un JSON o **restaurar los datos de demostración** (pide confirmación).
- Si el almacenamiento del navegador falla o los datos están corruptos, la app avisa y vuelve a los datos de ejemplo.
- Los datos de ejemplo se generan con una semilla fija, relativa a la fecha actual: siempre hay actividad reciente.

## Documentación

- `docs/FORMULAS.md` — definición de cada métrica e indicador.
- `docs/REGLAS-DE-NEGOCIO.md` — estados, permisos y reglas de operación.
- `docs/LIMITACIONES.md` — qué es y qué no es esta demo.
