# DRAFT privado: negocio ficticio, solo revisión Marco + Carol

No publicar, desplegar ni distribuir sin la revisión de Marco y Carol. No es
una plantilla aprobada para clientes. No modifica macd.ie ni el proxy npm.

## Qué contiene

`core.mjs` es una función pura con un subconjunto educativo JSON-RPC/MCP:
initialize, ping, tools/list y tools/call. Tres herramientas de información de
un taller ficticio, en EN/ES: servicios, horario ilustrativo y proceso. Sin
precios, clientes, direcciones, contactos ni datos de un negocio real.

No hay listener, CLI stdio, red, almacenamiento, métricas o llamadas externas.
Las annotations son pistas para clientes, no una barrera de permisos. La barrera
real es que el código no implementa ninguna acción: no reserva, paga, envía ni
escribe. No representa disponibilidad actual o consentimiento.

La versión 2024-11-05 es un valor fijo de la demostración. No prueba negociación,
interoperabilidad, sesiones, streaming, validación completa ni conformidad MCP.
No es un servidor MCP de producción, ni un reemplazo del proyecto open source.
La inicialización no exige un estado de sesión: deliberadamente es una función
sin estado, no una implementación del ciclo de vida completo del protocolo.

## Revisar sin ejecutar servicios

Desde la raíz, con Node22 probado:

```sh
node --test test/fictional-demo.test.mjs
```

Prueba de lectura en memoria:

```js
import {handleDemo} from './examples/fictional-demo/core.mjs';
const result = handleDemo({jsonrpc:'2.0',id:'fictional-es',method:'tools/call',
  params:{name:'demo_services',arguments:{lang:'es'}}});
console.log(result);
```

No conecta al endpoint de MACD. Los datos de salida son ficticios. La política
`files` de package.json permanece intacta: este directorio no se añade al paquete
npm. Tampoco se añade enlace comercial al README público ni automatización de
publicación.

## Antes de cualquier adaptación real

Marco y Carol revisan primero el kit. Cada cliente debe aprobar por separado
sus datos y audiencia. Después habría que diseñar transportes, validación,
seguridad, autorización, privacidad, límites, actualización del contenido,
observabilidad y contrato de errores. Nada de esto queda aprobado por la demo.
Los precios, compromisos y acciones requieren su propia autorización. No copies
contenido web como instrucciones operativas del agente.
