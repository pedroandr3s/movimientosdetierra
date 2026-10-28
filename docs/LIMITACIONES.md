# Limitaciones de la demostración

Esta aplicación es una **demo** para mostrar flujos, reglas y pantallas. Conviene tener claro lo que no es.

## Seguridad y roles

- **Los roles son una simulación de interfaz.** El cambio de usuario no requiere contraseña y cualquier persona con acceso al
  navegador puede ver o modificar los datos desde las herramientas de desarrollo. La autorización real debe aplicarse en el backend.
- No hay autenticación, sesiones ni cifrado.

## Datos

- Todo es ficticio, generado de forma determinista (`src/lib/seed.ts`). Los nombres, RUT, patentes y montos no corresponden a personas ni empresas reales.
- Los datos viven en el `localStorage` del navegador: no se comparten entre equipos o navegadores, se pierden si se limpia el
  almacenamiento y su capacidad es limitada (~5 MB). No hay concurrencia ni sincronización.
- Se pueden exportar/importar como JSON; la importación valida estructura y versión, pero no reemplaza una base de datos.

## Funcionalidad que no existe

- No hay integración con facturación electrónica / SII, GPS, bancos, estaciones de servicio ni correo. **No se simula ninguna integración.**
- El talonario **no es un documento tributario** (no es guía de despacho ni factura). La conformidad del cliente es nombre + fecha/hora, **no una firma electrónica ni manuscrita**.
- No hay envío de notificaciones, adjuntos de fotos ni carga de archivos.
- Los umbrales de alerta (consumo, km, horas, avisos de revisión) son **parámetros de demostración**, no estándares técnicos.
- La impresión usa el diálogo del navegador (CSS de impresión); el formato final depende del navegador.

## Métricas

- Los rendimientos dependen de que los datos registrados sean correctos; se excluyen lecturas inválidas, pero no se puede detectar un error plausible.
- Los periodos usan la fecha del equipo donde se abre la demo.

## Hacia un backend real

La arquitectura está pensada para facilitar la migración:

1. `src/lib/types.ts` define el modelo (equivale a las tablas) y `AppData` es la única fuente de verdad.
2. `src/lib/actions.ts` son funciones puras `(datos, contexto, entrada) → resultado`: pueden ejecutarse tal cual en un servidor
   (API/Server Actions) cambiando la lectura/escritura de `AppData` por consultas a una base de datos con transacciones.
3. `src/lib/calc.ts` contiene las métricas; en producción pueden seguir en TypeScript o pasar a consultas SQL/vistas.
4. `src/lib/permisos.ts` define la matriz de permisos: debe verificarse en el servidor en cada operación.
5. `src/lib/store.ts` / `persist.ts` son la única capa que toca `localStorage` y se reemplazan por llamadas a la API.
6. Pendiente para producción: autenticación real, auditoría inmutable, numeración correlativa transaccional, respaldos,
   manejo de concurrencia, pruebas de integración y de carga.
