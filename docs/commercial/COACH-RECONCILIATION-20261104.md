# Coach: derivada frontend independiente — 04/11/2026

**APTO PARA REVISIÓN LOCAL DEL DELTA FRONTEND. No es una reconciliación completa
de la Edge ni un artefacto autorizado de despliegue.**

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

Se conservan seis arneses offline ya existentes de PR #2 y se añade un orquestador
local con lista cerrada. No se copian ejecutores conectados, recibos, perfiles,
credenciales ni evidencias privadas. No cambia `scripts/ci-offline.cjs` ni workflows.

## Relación con Coach v36 y partes excluidas

El recibo local histórico del checkpoint B registra `simple-coach-mock` v36,
JWT obligatorio y bundle SHA-256
`0de5d740f29f5615cfea2e1678f95f25f7528d6bea996e50ee1e5e543e3f4c20`.
Esta tarea no consulta Supabase; ese recibo es evidencia histórica, no una lectura
actual. No se dispone aquí del bundle efectivo v36 completo y no se puede afirmar
una comparación byte a byte de todas sus dependencias.

La PR #2 contiene el guard de costes y el evaluador que se probaron en v32/v33,
pero su entrypoint procede de una rama anterior. El diff respecto a main añade
`generateStaging` y el recibo saneado, mientras que las versiones posteriores
desplegadas tienen también cambios de integración y orígenes. Reponer ciegamente
el entrypoint de PR #2 no está justificado por un número de versión o por metadatos.

Por ello esta derivada NO cambia `supabase/`, el evaluador deportivo, los modelos,
el contrato V5, los CORS, JWT, guard de coste ni configuración de generación.
El evaluador contextual y las evidencias deportivas siguen conservados en PR #2,
sin descartarlos ni declarar que hayan sido integrados aquí. El siguiente delta
de Edge exige capturar por lectura autorizada su fuente efectiva, verificar todas
las dependencias y preparar una comparación independiente. No exige desplegarlo
si ya coincide y funciona.

Esta rama es un **delta frontend sobre main**, no una copia que deba reemplazar el
árbol comercial ni el backend configurado. Al incorporarla a la composición
#5/#8/#7/#6 se aplican sus cambios, preservando tema, recursos de suscripción y las
tres huellas de seguridad de PR #7. No ejecutar los SQL históricos de esta base.

## Verificación efectivamente ejecutada

Node 24.19.0; Chromium (Edge headless) y WebKit en perfiles efímeros. SDK/servidor
de datos simulados, llamadas de navegador ajenas a loopback bloqueadas. No hay
sesión Auth real, JWT real, llamada Edge real ni acceso a proveedores.

| Comando | Aserciones distintas | Resultado |
|---|---:|---|
| `node tests/coach-flow/contracts.cjs` | 23 | PASS |
| `node tests/coach-flow/reload-uncertain.cjs` | 20 | PASS |
| `node tests/coach-flow/reload-context.cjs` | 54 | PASS |
| `node tests/coach-flow/recovery.cjs` | 111 | PASS |
| `node tests/coach-flow/journey.cjs` | 40 | PASS |
| `node tests/coach-flow/premium-retry.cjs` | 8 | PASS |
| **Total distinto de esta ejecución** | **256** | **256/256** |

Son regresiones existentes ejecutadas sobre el nuevo corte, no 256 casos nuevos.
No se suman las reejecuciones o análisis sintácticos. El primer arranque restringido
de Edge falló antes de ejecutar aserciones; el mismo comando completó la suite con
el permiso normal de ejecución local, sin cambiar comprobaciones del navegador.

`reconciled-browser.cjs shared` coordinó el preview y las tres últimas suites;
`reconciled-browser.cjs all` reproduce las seis sin repetir manualmente servidores.
Puertos 4266/4273 exclusivamente loopback. Servidores cerrados al terminar y ausencia
de listeners comprobada. `git diff --check` pasó. Resultados y capturas sintéticos
permanecen ignorados en `tests/coach-flow/results/`; no entran en el commit.

Los 23 contratos usan la base de producto anterior (idéntica en lo protegido) y
certifican este corte. Al componerlo con #8/#6 hay que adaptar explícitamente la
comparación del conjunto autorizado; no omitir esos cambios ni degradar aserciones.

## Riesgos, rollback y próximo paso

- P1 operativo: desplegar la Edge histórica o ejecutar el SQL de esta rama sobre
  staging podría recuperar componentes anteriores. Este corte no los publica.
- P2: los cambios frontend aún necesitan prueba conjunta con la composición
  comercial final y su artefacto de hosting; los recorridos de aquí usan esta rama.
- Pendientes separados: revocación Basic con el mismo JWT real, habilitación
  comercial supervisada y calidad deportiva de nuevas generaciones. No resueltos
  mediante mocks ni autorizados por este documento.
- Rollback frontend: revertir este commit; no borrar operaciones, historiales,
  reservas, claves de idempotencia ni datos persistidos por un servidor.
- Próximo paso local: aplicar únicamente este delta al candidato comercial en una
  derivada, resolver las dos referencias HTML sin perder assets de suscripción,
  comprobar de nuevo los tres RPC y repetir las suites afectadas. Publicación,
  despliegue y validación conectada requieren autorizaciones independientes.

Ningún cambio externo, sesión conectada, push, merge, despliegue o llamada OpenAI.
