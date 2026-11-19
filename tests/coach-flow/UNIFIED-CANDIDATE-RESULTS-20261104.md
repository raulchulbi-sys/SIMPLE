# Coach sobre el candidato unificado — 04/11/2026

Árbol de integración recibido: `3d2315444454f5617620e34e4a7d4ee3300a8095`.
Base `b2f77c6f86318a4bf11d2b6754b2e3bbd7263ac6`. Componentes fijados para
las comprobaciones de alcance:

- Comercial `7b9d5709add382a47f35712c80d6744b09955ebd`.
- Coach `94c06d4e90bdb4449fde41fd6e6675e4db9d7e47`.
- Hosting `d613ba9489e02900761395d62ca245df85327cf0`.

**477/477 comprobaciones distintas superadas sobre la composición.** Son 426
regresiones existentes, siete nuevas comprobaciones del preview offline y 44
casos nuevos de integración sobre los dos defectos reproducidos y corregidos.
No se añaden los resultados históricos de las tres ramas independientes.

## Defectos de producto reproducidos y corregidos

La revisión final encontró dos defectos adicionales a las incompatibilidades del
arnés. Se corrigieron únicamente `assets/coach.js` y
`assets/coach-premium-chat.js`, con dos referencias de caché en `index.html`.

1. **Basic:** una admisión previa al piloto no equivale a autorización comercial
   para generar. Ahora se vuelve a leer `get_my_coach_access` antes de guardar un
   intake enviado y antes de invocar la Edge. `authorized` y `can_generate` deben
   ser exactamente `true`; `false`, strings, ausencia del dato o error de lectura
   detienen la operación antes de cualquier escritura. La primera pantalla indica
   el cierre. Se conserva «Elegir Basic» como ruta de lectura del contexto, las
   propuestas existentes y la recuperación de un intake ya enviado; no se eliminan
   rutinas, respuestas ni historial. La protección SQL sigue siendo la autoridad
   final: el frontend no elimina una posible carrera posterior a esta lectura.
2. **Premium:** `applyState` borraba el marcador incierto cuando la lectura no
   contenía mensajes pendientes, antes de restaurarlo desde sessionStorage. Ahora
   se restaura primero y sólo se elimina por pérdida/cambio del contexto autorizado
   o confirmación terminal del mensaje identificado. Una lectura vacía u otro
   mensaje del historial no prueban que el envío no ocurrió. El ID de mensaje real
   lo asigna el backend: se adopta únicamente desde una respuesta correlacionada al
   envío explícito. Tampoco se muestra una confirmación ni se vacía el formulario
   por encontrar otro mensaje histórico con el mismo texto y revisión.

El marcador mantiene únicamente los tres campos existentes `key`, `message_id` y
`revision_id`; no guarda texto, credenciales ni tokens. Tras una recarga, si no se
conoce todavía el ID del servidor, el usuario debe volver a escribir la misma
pregunta para un reintento explícito con la clave conservada. No hay reenvío
automático. La prueba demuestra retención de clave/contexto e identificación
correcta, **no un doble gasto real previo ni un acceso JWT conectado**.
La persistencia comprobada corresponde a recargas en la misma pestaña/origen con
sessionStorage disponible; no acredita conservación al borrar almacenamiento,
cerrar la pestaña o impedir su uso. La protección de idempotencia del servidor no
se modifica ni se sustituye por ese almacenamiento del navegador.

SHA-256 de fuentes con LF:

| Archivo | SHA-256 |
|---|---|
| `assets/coach.js` | `00f1edda86e420e1e6c7f94fef10f04c53513b28d2557992bbcc9590667f377f` |
| `assets/coach-premium-chat.js` | `52aa54f238fa1e9cb0ae8d3c44f98d0ca4b228835f38363430c9bb63fc998c0d` |
| `index.html` | `923ccba54762258d125aa960328db426a9f60ff47eb0bc65d2de0fffb4a1b168` |

El diff de producto respecto al árbol recibido es de tres archivos, +15/-7 líneas.
Las versiones de caché son `basic-commercial-gate-20261104` y
`premium-chat-reload-20261104`. No se cambian SQL, modelo, generación V5,
presupuestos, cuotas, guards ni configuración comercial.

## Adaptaciones de arnés

1. `contracts.cjs` conserva 21 comprobaciones. Auth se compara con el blob de
   hosting aprobado; tema con el comercial. Los demás recursos protegidos siguen
   comparándose con main. La lista completa de archivos y sus cuerpos debe coincidir
   con la unión de los tres commits fijados, no con una captura de HEAD. Un recurso
   inesperado o una diferencia desconocida falla. Los dos fixes adicionales quedan
   fijados por los hashes exactos anteriores; no se permite cualquier cambio de esos
   archivos. El HTML debe coincidir exactamente con hosting/suscripción salvo las
   dos referencias de caché indicadas.
2. El control v36 conserva sus 17 casos. Su última comprobación exige que SQL,
   configuración y workflow coincidan con la capa comercial aprobada, permitiendo
   exclusivamente los dos archivos fuente de Edge reconciliados. No exige volver
   al SQL anterior de main ni ignora los cuerpos instalados de seguridad.
3. El runtime real de hosting rechaza correctamente `/demo` en 4266/4273 porque
   esos destinos no están configurados. El preview anterior dependía de sustituir
   constantes que ahora proceden del runtime. Se crea `preview-offline.cjs`: página
   unificada real, SDK simulado, configuración explícitamente sintética y congelada,
   clave `SYNTHETIC_NOT_A_KEY`, `billingTest=false`, CSP `connect-src 'none'` y
   `form-action 'none'`. No tiene ruta de login real ni acceso a ficheros privados.
   Los tres ejecutores que administran servidor usan ahora este preview.

Estas tres adaptaciones responden a incompatibilidades del arnés con los componentes
integrados. Son distintas de los dos defectos de producto documentados arriba;
no se relajaron protecciones para superar las pruebas.

## Ejecuciones reales en local

| Comando/suite | Casos | Resultado |
|---|---:|---|
| `node tests/coach-flow/contracts.cjs` | 21 | PASS |
| `node --test tests/coach-flow/edge-v36-reconciliation.test.mjs` | 17 | PASS |
| `node tests/coach-flow/basic-cost-guard.cjs` | 44 | PASS |
| `node tests/coach-flow/sports-review.cjs` | 30 | PASS |
| `node tests/coach-quality-v5/unit.cjs` | 35 | PASS |
| `node tests/coach-pilot-v2/edge-http.mjs` | 20 | PASS |
| `node tests/coach-flow/reload-uncertain.cjs` | 20 | PASS |
| `node tests/coach-flow/reload-context.cjs` | 54 | PASS |
| `node tests/coach-flow/recovery.cjs` | 111 | PASS |
| `node tests/coach-flow/journey.cjs` | 40 | PASS |
| `node tests/coach-flow/premium-retry.cjs` | 8 | PASS |
| `node tests/coach-flow/sports-review-ui.cjs` | 26 | PASS |
| `node --test tests/coach-flow/preview-offline.test.mjs` | 7 | PASS |
| `node tests/coach-flow/integration-boundaries.cjs` | 44 | PASS |
| **Total único Coach** | **477** | **477/477** |

`node tests/coach-flow/reconciled-browser.cjs all` ejecutó contratos y las cinco
primeras suites de navegador administrando sus servidores. Las siete pruebas nuevas
verifican contenido exacto de la página, CSP, configuración sintética inmutable,
SDK simulado, denegación de rutas privadas/login real, métodos de escritura y
traversal de rutas. El intento inicial de esas siete pruebas no pudo conectar al
loopback por `EACCES`; el mismo comando pasó mediante la aprobación normal del
entorno, sin cambiar las aserciones. No se cuenta como siete casos adicionales.

La nueva regresión se ejecutó primero sobre los assets anteriores de este mismo
worktree aislado: **12/38 PASS, 26 FAIL**. El flag `--baseline` sólo elige el nombre
del recibo; no cambia producto, comportamiento ni expectativas. Después se añadieron,
por motor, una comprobación de historial ajeno y dos del caso «mismo texto, distinto
ID» (seis casos adicionales). Ese último caso falló antes de retirar el fallback textual (**42/44 PASS,
2 FAIL**). Los recibos anteriores permanecen en `results/` ignorado por Git; el
resultado final es **44/44**. No se editaron otros worktrees para reproducirlos.

Tras modificar producto se ejecutaron las 233 regresiones de navegador Coach y los
21 contratos. Tras el ajuste final de confirmación Premium se repitieron los casos
afectados de contexto y navegador, sin añadir esas reejecuciones al total. Las
26 comprobaciones de reviewer UI se reutilizan de esta ejecución sobre la misma
composición: el módulo reviewer/evaluador no cambió con estos fixes.

**Deduplicación con CI:** `basic-cost-guard.cjs` (44), `edge-http.mjs` (20) y
`preview-offline.test.mjs` (7) también están en la lista consolidada de CI. Si se
contabilizan allí, este bloque aporta **406 casos adicionales**, no 477.
Las reejecuciones y comprobaciones de sintaxis
no aumentan esos totales.

## Evidencia y límites

- Chromium/Edge headless y WebKit, perfiles temporales, backend simulado. Las
  rutas de navegador bloquean toda petición ajena a loopback; la prueba aislada
  del reviewer bloquea incluso esas conexiones.
- El handler TypeScript real se ejecuta con transportes sintéticos. La prueba del
  guard sustituye el proveedor: no existe conteo ni generación OpenAI reales.
- Historial, permisos, JWT y idempotencia probados aquí son simulaciones. No son
  evidencia de sesiones conectadas, SQL de staging, Stripe, OAuth ni revocación
  con un JWT real.
- Estas suites Coach usan un runtime de prueba deliberado. La validez del artefacto
  y runtime reales, y el recorrido de suscripción habilitado explícitamente en
  staging, corresponden a las pruebas cruzadas del frente hosting/comercial.
- Todos los servidores de estas suites terminaron; ausencia de listeners 4266 y
  4273 comprobada. `git diff --check -- tests/coach-flow` pasó.
- Recibos y capturas sintéticos están en directorios `results/` ignorados. No se
  incorporan contraseñas, tokens, sesiones, datos personales ni volcados.

No se creó ningún commit desde este frente en el worktree compartido; el
coordinador consolida los cambios. Las ramas independientes originales, entornos
conectados, automatizaciones, usuarios y datos permanecen fuera de esta ejecución.
