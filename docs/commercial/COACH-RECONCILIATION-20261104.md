# Coach: frontend y fuentes v36 reconciliados — 04/11/2026

**APTO PARA REVISIÓN LOCAL. Dos capas auditables: recuperación frontend y
reconciliación de fuentes v36. No es una autorización de despliegue.**

Rama `codex/coach-reconciled-20261104`, base exacta
`b2f77c6f86318a4bf11d2b6754b2e3bbd7263ac6`. La PR #2 continúa independiente;
su HEAD remoto consultado por el coordinador es
`49ef741d5ba9fb58e38732fe7a031e7034d907dd`. Su ancestro común con la base es
`0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663`. No se hizo merge de toda la PR.

## Corte de integración

Se extraen exactamente tres archivos funcionales de ese HEAD:

| Archivo | SHA-256 bytes LF |
|---|---|
| `assets/coach.js` | `087ef9f8c98b178300ee9d2e9259f59d9af183415ccae905c051c4acec340d15` |
| `assets/coach-premium-chat.js` | `c8523a35d267241f52b3dfe915f94e84f6d804cac9556606e8b55682fd307d1f` |
| `index.html` | `cf09555213bfce4f58e1be068802d7df95a5907ab346758d3ab5f2926dc1d719` |

`index.html` cambia únicamente las dos referencias de caché. La programación,
prescripción, aceptación, historial y guardado de entrenamiento no se modifican.
El cambio de main posterior a la base de PR #2 no alteró estos tres archivos,
por lo que no se han perdido modificaciones de producto al componer este corte.

- Basic conserva el propietario/intake de un envío incierto; recuperación mediante
  lecturas filtradas y verificadas, sin envío automático ni nuevo guardado.
- Tras recarga completa, el intake `submitted` sin operación correspondiente se
  considera incierto aunque ya exista una rutina anterior. Un borrador normal
  sigue siendo editable. No se persiste ningún token ni marcador en almacenamiento.
- Las respuestas tardías están vinculadas al propietario y a la apertura de diálogo.
  Logout limpia la incertidumbre de esa identidad.
- Premium conserva clave e ID de mensaje para el reintento explícito del mismo
  contexto; contenido o revisión incompatible sigue sujeto al rechazo del servidor.
  No amplía cuotas, ejecuta reintentos automáticos ni sustituye la idempotencia SQL.

El primer commit `4d8aa11c6546cc2c3ea0e8b9530e54a80f75c84c` conserva seis
arneses offline ya existentes de PR #2 y añade un orquestador local con lista
cerrada. El segundo añade las fuentes y pruebas de v36 descritas debajo. No se
copian ejecutores conectados, recibos de gasto, perfiles privados ni credenciales.
No cambia `scripts/ci-offline.cjs` ni workflows.

## Comparación completa con las fuentes observadas de Coach v36

El recibo local histórico del checkpoint B registra `simple-coach-mock` v36,
JWT obligatorio y bundle SHA-256
`0de5d740f29f5615cfea2e1678f95f25f7528d6bea996e50ee1e5e543e3f4c20`.
Esta tarea no consulta Supabase; es evidencia histórica, no una lectura actual.
Durante el trabajo se recuperaron también las once fuentes completas que el
coordinador conservaba en memoria de la revisión anterior del 04/11. Se preservaron
localmente, sin modificar sus originales ni abrir una conexión nueva.

Comparación exhaustiva con PR #2: nueve de los once archivos coinciden al convertir
CRLF a LF; el guard coincide incluso por bytes originales. `contract-v5.mjs`
contiene exactamente un LF final adicional, sin otra diferencia. El único cambio
sustantivo del entrypoint v36 frente a PR #2 es su allowlist de CORS staging:
conserva los puertos 4194/4195, añade 4280 y los dos orígenes Cloudflare previamente
observados. La rama de producción sigue permitiendo sólo el origen GitHub Pages.
No se elimina ningún origen autorizado ni se añade uno no observado.

La segunda capa incorpora el entrypoint completo observado, su guard y el
evaluador contextual de PR #2 que ya estaba en v36. El contrato V5 conserva su
archivo canónico versionado: el LF adicional observado se registra como excepción
exclusiva y se comprueba añadiendo exactamente un LF al calcular su huella observada,
sin `trim` general ni tolerar otro cambio. Evita añadir una línea en blanco que
`git diff --check` señala al final del archivo. Los once archivos efectivos quedan
verificados con hashes del repositorio y los bytes observados, además de sus
variantes LF, en `tests/coach-flow/observed-v36-source.json`. No se afirma identidad
de bytes CRLF/LF ni que su hash conjunto sea el hash interno del eszip.

No cambia ninguna regla de generación, modelo, prompt, cuestionario, catálogo,
prescripción, configuración JWT o SQL. La revisión deportiva sigue siendo
informativa y la generación depende de la reserva/autorización de backend. El
gate comercial y el reviewer no se activan desde este código. Modelo fijo
`gpt-5.4-2026-03-05`, contrato `basic-initial-v5`, guard staging: 16.384 bytes,
12.000 tokens contados, 5.120 de salida, default, store=false, truncation=disabled,
un conteo/una generación como máximo y cero reintentos automáticos.

La captura inicial completa y sus metadatos quedan bajo `.tests-local/`, ignorado.
Sólo se versionan fuentes revisadas, un manifiesto de hashes sin datos privados y
fixtures sintéticas ya públicas. No hace falta redesplegar v36 para reconciliar
Git. Antes de cualquier futuro despliegue se debe renovar la comparación de
fuentes, JWT/CORS, SQL y gates; la lectura histórica no sustituye ese preflight.

Esta rama es un **delta local sobre main**, no una copia que deba reemplazar el
árbol comercial ni el backend configurado. Al incorporarla a la composición
#5/#8/#7/#6 se aplican sus cambios, preservando tema, recursos de suscripción y las
tres huellas de seguridad de PR #7. No ejecutar los SQL históricos de esta base.

## Verificación efectivamente ejecutada

Node 24.19.0; Chromium (Edge headless) y WebKit en perfiles efímeros. SDK/servidor
de datos simulados, llamadas de navegador ajenas a loopback bloqueadas. No hay
sesión Auth real, JWT real, llamada Edge real ni acceso a proveedores.

| Comando | Aserciones distintas | Resultado |
|---|---:|---|
| `node tests/coach-flow/contracts.cjs` | 21 | PASS |
| `node tests/coach-flow/reload-uncertain.cjs` | 20 | PASS |
| `node tests/coach-flow/reload-context.cjs` | 54 | PASS |
| `node tests/coach-flow/recovery.cjs` | 111 | PASS |
| `node tests/coach-flow/journey.cjs` | 40 | PASS |
| `node tests/coach-flow/premium-retry.cjs` | 8 | PASS |
| `node --test tests/coach-flow/edge-v36-reconciliation.test.mjs` | 17 | PASS |
| `node tests/coach-flow/basic-cost-guard.cjs` | 44 | PASS |
| `node tests/coach-flow/sports-review.cjs` | 30 | PASS |
| `node tests/coach-quality-v5/unit.cjs` | 35 | PASS |
| `node tests/coach-pilot-v2/edge-http.mjs` | 20 | PASS |
| `node tests/coach-flow/sports-review-ui.cjs` | 26 | PASS |
| **Total distinto del candidato final** | **426** | **426/426** |

Son 409 regresiones existentes y 17 comprobaciones nuevas de reconciliación de
fuentes. El corte inicial pasó 256; no se suman a los 426 finales. Sus dos
comparaciones que exigían mantener el antiguo evaluador y entrypoint se sustituyen
por la comprobación estricta de las once fuentes v36. Las restantes 21 se conservan
y se declara la lista exacta de cambios autorizados, sin ignorar rutas desconocidas.
No se suman las reejecuciones o análisis sintácticos. El primer arranque restringido
de Edge falló antes de ejecutar aserciones; el mismo comando completó la suite con
el permiso normal de ejecución local, sin cambiar comprobaciones del navegador.

`reconciled-browser.cjs shared` coordinó el preview y las tres últimas suites;
`reconciled-browser.cjs all` reproduce las seis sin repetir manualmente servidores.
Puertos 4266/4273 exclusivamente loopback. Servidores cerrados al terminar y ausencia
de listeners comprobada. `git diff --check` pasó. Resultados y capturas sintéticos
permanecen ignorados en `tests/coach-flow/results/`; no entran en el commit.

Los 21 contratos usan la base de producto anterior (idéntica en lo protegido) y
certifican este corte. Al componerlo con #8/#6 hay que adaptar explícitamente la
comparación del conjunto autorizado; no omitir esos cambios ni degradar aserciones.

## Riesgos, rollback y próximo paso

- P1 operativo: ejecutar SQL histórico de esta base sobre staging podría recuperar
  componentes anteriores. No hay cambios SQL en este delta y no se ejecutan scripts.
- P2 operativo: fuentes v36 concordantes con evidencia previa no acreditan ausencia
  de deriva posterior. Renovar preflight antes de desplegar; no desplegar por inercia.
- P2: los cambios frontend aún necesitan prueba conjunta con la composición
  comercial final y su artefacto de hosting; los recorridos de aquí usan esta rama.
- Pendientes separados: revocación Basic con el mismo JWT real, habilitación
  comercial supervisada y calidad deportiva de nuevas generaciones. No resueltos
  mediante mocks ni autorizados por este documento.
- Rollback frontend: revertir este commit; no borrar operaciones, historiales,
  reservas, claves de idempotencia ni datos persistidos por un servidor.
- Próximo paso local: aplicar únicamente estos dos deltas al candidato comercial en una
  derivada, resolver las dos referencias HTML sin perder assets de suscripción,
  comprobar de nuevo los tres RPC y repetir las suites afectadas. Publicación,
  despliegue y validación conectada requieren autorizaciones independientes.

Ningún cambio externo, sesión conectada, push, merge, despliegue o llamada OpenAI.
