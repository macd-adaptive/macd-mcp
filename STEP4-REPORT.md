# STEP4 — improvement4: interoperabilidad

Estado: parche preparado; prueba focal real y smoke Inspector PASS. CI remoto y revisión exact-head pendientes.

## Archivos exactos del parche

| Archivo | Cambio |
| --- | --- |
| `test/proxy-interop.test.mjs` | Nuevo: 3 casos de servidor HTTP local y CLI real; recorrido de sesión y dos caracterizaciones de JSON inválido. |
| `.github/workflows/tests.yml` | Modificado: matriz Node 20/22/24, `fail-fast: false`, smoke público desactivado. Conserva nombre, job, etiqueta inglesa y ambos SHA de actions. |
| `docs/INTEROPERABILITY.md` | Nuevo: contratos, limitaciones, reproducción, alcance de contrapresión y smoke externo verificado. |
| `STEP4-REPORT.md` | Nuevo: este informe y resultados de validación. |

No se necesitan fixtures adicionales: la herramienta `echo_constellation` y
la metadata de inicialización son ficticias e internas al nuevo test. No se
modifican README, proxy, CLI, tests anteriores, `package.json`, datos de negocio
ni metadata o configuración de producción. El script existente `node --test`
incluye automáticamente el nuevo archivo en `npm test`, sin dependencias.

El recorrido principal exige 7 POST, estados `[200,202,200,404,200,202,200]`,
5 líneas JSON exactas, ids numéricos y de texto, recorrido de la versión de
fixture y cabeceras de sesión completas. Cada uno de los dos SSE se emite en
8 fragmentos de bytes, con cortes dentro de UTF-8. El 404 borra la sesión sin
reintentar; la nueva inicialización no envía sesión y establece una fresca.
Los dos casos de JSON inválido exigen 2 POST y 2 líneas cada uno: el proxy
reenvía texto inválido sin validarlo y sigue con la respuesta válida. Esto
documenta la limitación actual; no se modifica ni se declara cumplimiento MCP.

El helper usa únicamente loopback literal, puerto efímero y variables explícitas
para el CLI. Tiene timeout, errores visibles y cleanup con muerte del hijo y
cierre de conexiones. Los fragmentos se coordinan mediante callbacks de
escritura y turnos de I/O, sin sleeps arbitrarios. No se afirma que fetch reciba
exactamente los mismos límites de fragmentos que escribe el servidor.

## Validación enfocada

Entorno: Node **v22.22.1**, npm **9.2.0**. No se ejecutó la suite completa.

| Comando | Resultado exacto |
| --- | --- |
| `MACD_MCP_LIVE_SMOKE=0 npm test -- test/proxy-interop.test.mjs` | Exit 1: el runner aislado muestra 1 archivo fallido, sin detalle de los casos internos. |
| `MACD_MCP_LIVE_SMOKE=0 npm test -- --experimental-test-isolation=none test/proxy-interop.test.mjs` | **3 casos: 0 pass, 3 fail, 0 skipped, 0 cancelled**. Los tres fallan en `listen EPERM: operation not permitted 127.0.0.1`, antes de spawn. |
| `MACD_MCP_LIVE_SMOKE=0 npm test -- --test-name-pattern='slow stdout prevents subsequent forwarding\|a failed stdout write stops forwarding' test/proxy-security.test.mjs` | Exit 0: el runner aislado muestra 1 archivo aprobado, sin totales internos de casos. |
| `MACD_MCP_LIVE_SMOKE=0 npm test -- --experimental-test-isolation=none --test-name-pattern='slow stdout prevents subsequent forwarding\|a failed stdout write stops forwarding' test/proxy-security.test.mjs` | **2 casos existentes: 2 pass, 0 fail, 0 skipped, 0 cancelled**. No demuestra contrapresión de un pipe real. |
| `node --check test/proxy-interop.test.mjs` | Exit 0, sintaxis válida. |
| Comprobación local de alcance y SHA-256 contra snapshot previo | Exactamente 1 archivo existente modificado y 3 nuevos; los otros **22 archivos existentes** conservan sus bytes. SHA de actions, etiquetas, matriz y espacios finales comprobados. |

Las ejecuciones sin aislamiento son diagnósticas de Node 22, para obtener los
recuentos reales; no son ejecuciones adicionales de otros casos. Se han intentado
**3 casos nuevos** y comprobado **2 casos existentes**, sin sumar dos veces las
invocaciones del mismo conjunto. La matriz remota queda pendiente; las ejecuciones locales posteriores se registran abajo.

## Pendiente y alcance

- CI remoto y Auditoría exact-head.
- Caracterización del comportamiento actual, no conformidad integral MCP.
- Sin cambios de producción, commits, push ni publicación.


## Validación posterior, 27/10 03:01 WET

Prueba focal real: `node --test test/proxy-interop.test.mjs`, 3/3 PASS, 0 fail, tanto en host Node22.22.1 como en contenedores Node20.20.2,22.23.3 y24.22.1. Sin endpoint público. No es la suite completa ni una ejecución de GitHub Actions. Node18 no verificado.

Inspector0.16.2: versión y ayuda CLI comprobadas, instalado con `--ignore-scripts` en imagen aislada. Smoke real: Inspector CLI → proxy real stdio → fixture HTTP ficticia loopback. Exit0, stderr vacío, tools/list devolvió `echo_constellation`. Secuencia: initialize sin sesión, notifications/initialized y tools/list con sesión de fixture. Runtime con networknone, read-only, cap-drop ALL, no-new-privileges y sin credenciales ni home host. La construcción descargó dependencias; la ejecución no tuvo red externa. La versión se fija por reproducibilidad, no se afirma que sea la última. El harness y JSON se entregan como evidencia separada. No demuestra conformidad integral MCP.
