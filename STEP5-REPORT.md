# MCP5 - ejemplos EN/ES

DRAFT. Base del proxy 33a2228, copia aislada con 1/2 congelados. Delta propio:
README enlace, docs/EXAMPLES.md, docs/examples/read-only.json,
test/examples.test.mjs y este informe. No publicación ni cambios runtime.

18 peticiones sintéticas cubren 9 herramientas en EN/ES. No se guardan respuestas
ni precios; no se llama al endpoint público. Schema de entrada proviene de la
fixture capturada26/10. Validación sintáctica y de contrato local, no conformidad
MCP integral ni certeza del inventario actual.

El test corre por node --test dentro de npm test; sin nuevas dependencias.
CI remoto y Auditoría exact-head pendientes. MCP3 estructurado no se supone activo.

27/10 03:03 WET: Node22.22.1, node --test test/examples.test.mjs: 3/3 PASS,0fail. Matriz18peticiones y rechazo de argumentos inválidos. Validación focal porque todavía no existe ejecución CI de este delta; no suite completa ni pruebas de respuestas.
