# Interoperabilidad del proxy stdio / HTTP

Improvement4 añade contratos de transporte reproducibles con un servidor HTTP
local y el CLI real. No acredita conformidad completa con MCP, una versión nueva
del protocolo ni compatibilidad con clientes externos. El proxy y el CLI
conservan sus bytes de improvement1/2.

## Prueba local sin dependencias

```sh
MACD_MCP_LIVE_SMOKE=0 npm test -- test/proxy-interop.test.mjs
```

`npm test` descubre también este archivo mediante el `node --test` existente;
no se modifica `package.json` ni se instala nada. El test abre primero un servidor
en `127.0.0.1` con puerto efímero y después lanza `bin/macd-mcp.mjs` usando el
mismo ejecutable Node. El hijo recibe únicamente `MACD_MCP_URL` con ese endpoint
y `MACD_MCP_ALLOW_LOOPBACK_HTTP=1`. No hereda variables, credenciales, opciones de
preload ni configuración de proxies. No usa el endpoint público ni DNS.

El recorrido principal comprueba exactamente **7 POST y 5 líneas JSON de
salida**, en este orden:

| POST | Mensaje | Sesión enviada | HTTP | Salida stdio |
| --- | --- | --- | --- | --- |
| 1 | `initialize`, id `0` | Ausente | 200, sesión `fixture-old` | Resultado con el mismo id y versión |
| 2 | `notifications/initialized` | `fixture-old` | 202 sin cuerpo | Ninguna |
| 3 | `tools/list`, id `list-é🌍` | `fixture-old` | 200 SSE fragmentado | Inventario ficticio |
| 4 | `tools/list`, id `expired` | `fixture-old` | 404 con cabecera de sesión que debe ignorarse | Error local `-32603` con el mismo id |
| 5 | Nuevo `initialize`, id `fresh-initialize` | Ausente | 200, sesión `fixture-fresh` | Resultado de inicialización |
| 6 | `notifications/initialized` | `fixture-fresh` | 202 sin cuerpo | Ninguna |
| 7 | `tools/list`, id `4` | `fixture-fresh` | 200 SSE fragmentado | Inventario ficticio |

El cliente de prueba envía explícitamente la reinicialización; el proxy no la
inventa ni reintenta el POST del 404. Se comparan todos los cuerpos JSON de
petición como texto exacto, método, ruta, cabeceras `Content-Type`, `Accept` y
`Mcp-Session-Id`, secuencia de estados y stdout completo, incluido su LF final.
Los recuentos corresponden a mensajes HTTP y líneas stdio, no a paquetes TCP.
La versión `2025-03-26` es un valor fijo de la fixture cuyo recorrido se
comprueba; no demuestra negociación general ni conformidad con esa versión.

Cada respuesta SSE se escribe en **8 fragmentos Buffer reales** sobre HTTP,
con cortes dentro de `data:`, un carácter UTF-8 de dos bytes, otro de cuatro
bytes y el CRLF final. Se incluyen comentario heartbeat y metadatos SSE, que
no deben aparecer en stdout. Se espera el callback de cada escritura y se cede
el turno de I/O con `setImmediate`, sin pausas de duración arbitraria. El sistema
operativo o fetch pueden agrupar lecturas: el test verifica los cortes de bytes
emitidos por el servidor y el resultado reconstruido, no los límites internos
de cada lectura de fetch. Tampoco afirma entrega incremental: el proxy actual
acumula la respuesta HTTP antes de extraer los eventos SSE.

La única herramienta del inventario, `echo_constellation`, es ficticia. No se
leen fixtures de inventario público ni se incluyen precios o datos de clientes.
El nombre y versión de servidor pertenecen exclusivamente a la fixture local;
no se cambia metadata de ningún servidor de producción.

## JSON de respuesta inválido: limitación caracterizada

Hay **dos casos adicionales**, uno para `application/json` y otro para
`text/event-stream`. Cada uno realiza exactamente **2 POST** y obtiene dos
líneas: primero texto JSON truncado, después una respuesta válida.

El proxy actual **no valida el JSON recibido**. Reenvía el cuerpo JSON o el
payload `data:` inválido a stdout, sin fabricar un error JSON-RPC. Los tests
exigen ese texto exacto y que `JSON.parse` lo rechace; después comprueban que la
siguiente respuesta válida se conserva. Es una caracterización de una
limitación existente, no un PASS de cumplimiento del protocolo ni una garantía
general de que stdout siempre contenga JSON válido. Cambiar esa conducta
queda fuera de improvement4.

## Límites y contrapresión

Cada intercambio tiene un plazo de 6 segundos con diagnóstico explícito. El
cleanup mata el hijo con `SIGKILL` si sigue activo, espera su cierre y cierra el
servidor y todas sus conexiones; las esperas de cleanup tienen plazos de
1,5 segundos. Los temporizadores se eliminan incluso al fallar. Los tests tienen
un límite exterior de 10 segundos y no omiten fallos de listen o spawn.

La contrapresión se comprueba en los tests existentes de
`test/proxy-security.test.mjs`: un `Writable` retiene el callback de escritura y
demuestra que no sale el siguiente POST hasta liberar stdout; otro test verifica
que una escritura fallida detiene el reenvío. Su alcance es la librería con
streams controlados y fetch inyectado. Este nuevo recorrido HTTP consume stdout
normalmente y no acredita presión de un pipe real ni comportamiento bajo carga.

En Node 22 puede aislarse esa comprobación existente así:

```sh
MACD_MCP_LIVE_SMOKE=0 npm test -- --experimental-test-isolation=none --test-name-pattern='slow stdout prevents subsequent forwarding|a failed stdout write stops forwarding' test/proxy-security.test.mjs
```

## Matriz y validación pendiente

El workflow mantiene el nombre `tests`, el job `unit`, el texto inglés del paso
y los SHA fijados de checkout/setup-node. Configura Node **20, 22 y 24**, sin
instalación de dependencias y con el smoke público desactivado. La matriz está
configurada, pero no se ha ejecutado GitHub Actions en este trabajo.
`engines.node >=18` permanece intacto. **Node 18 no está cubierto por la matriz
ni se ha probado aquí; no se afirma compatibilidad verificada con Node 18.**

## Validación posterior, 27/10 03:01 WET

Prueba focal real: `node --test test/proxy-interop.test.mjs`, 3/3 PASS, 0 fail, tanto en host Node22.22.1 como en contenedores Node20.20.2,22.23.3 y24.22.1. Sin endpoint público. No es la suite completa ni una ejecución de GitHub Actions. Node18 no verificado.

Inspector0.16.2: versión y ayuda CLI comprobadas, instalado con `--ignore-scripts` en imagen aislada. Smoke real: Inspector CLI → proxy real stdio → fixture HTTP ficticia loopback. Exit0, stderr vacío, tools/list devolvió `echo_constellation`. Secuencia: initialize sin sesión, notifications/initialized y tools/list con sesión de fixture. Runtime con networknone, read-only, cap-drop ALL, no-new-privileges y sin credenciales ni home host. La construcción descargó dependencias; la ejecución no tuvo red externa. La versión se fija por reproducibilidad, no se afirma que sea la última. El harness y JSON se entregan como evidencia separada. No demuestra conformidad integral MCP.

Comando Inspector verificado, con fixture previamente abierta en loopback:

```sh
MACD_MCP_ALLOW_LOOPBACK_HTTP=1 MACD_MCP_URL=http://127.0.0.1:8080/mcp \
  npx --yes @modelcontextprotocol/inspector@0.16.2 --cli \
  node ./bin/macd-mcp.mjs --method tools/list
```
