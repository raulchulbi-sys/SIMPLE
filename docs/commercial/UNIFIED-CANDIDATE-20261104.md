# SIMPLE — candidata integral local, 04/11/2026

**APTO PARA REVISIÓN INDEPENDIENTE. Candidata local, no publicada ni lista para
producción por el hecho de superar estas pruebas.**
Este documento sustituye las conclusiones de integración pendiente de los informes
individuales, que se conservan como evidencia histórica. No autoriza publicación.

## Procedencia y composición

Rama nueva: `codex/simple-unified-candidate-20261104`.
Base verificada: `b2f77c6f86318a4bf11d2b6754b2e3bbd7263ac6`.
Commit final de código, pruebas y artefacto:
`fb9246f6f8da8748504f137481b6f0385ec5a8de`.
Árbol de ese commit: `821cfd098aaf3acf2671f61ab72b11d3a0cadeb4`.
El commit posterior añade sólo este informe y el inventario de fuentes; no cambia
los bytes probados ni el artefacto. El SHA de cierre documental se entrega junto
al resultado y queda como HEAD de la rama local.

| Componente aprobado | Commit | Árbol Git verificado |
|---|---|---|
| Comercial (#5, #8, #7, #6) | `7b9d5709add382a47f35712c80d6744b09955ebd` | `92a82d6bce88dcd358200e7e379ad5e165bbe1a1` |
| Coach reconciliado con v36 | `94c06d4e90bdb4449fde41fd6e6675e4db9d7e47` | `bc9e11c2ccea4eb78f37a6bf75441ffa19222773` |
| Hosting reproducible | `d613ba9489e02900761395d62ca245df85327cf0` | `a8d22f79103fadfec593d16d205a720185b4ad22` |

Se creó el worktree desde la base; sólo la rama nueva avanzó hasta comercial.
Se incorporaron las genealogías revisadas mediante dos merges locales:
`2ea74006ace5be72c0ba136664e44290d0f12a43` (Coach) y
`3d2315444454f5617620e34e4a7d4ee3300a8095` (hosting).
No hubo conflictos textuales nuevos. El conflicto de CI de las cuatro PR
comerciales ya estaba resuelto en su candidata aprobada; no se volvió a resolver.

La composición inicial es la unión exacta aprobada, no una sustitución del árbol
por una rama antigua. El HTML conserva runtime, tema, suscripción y las dos
referencias de caché de Coach. Los contratos fijan los cuerpos de los recursos
esperados y rechazan rutas inesperadas; los deltas propios posteriores deben
quedar identificados y cubiertos por regresiones específicas.

Los tres worktrees fuente y el worktree raíz permanecen fuera de las escrituras.
Se conservaron cambios históricos, evidencias privadas y todas las ramas remotas.
El inventario complementario enumera el diff y la procedencia de cada componente.
El commit de código cambia **149 archivos, +11.630/-31 líneas frente a main**:
11 frontend, 22 hosting, 8 Edge, 15 SQL/configuración, 10 herramientas locales,
64 pruebas, 18 documentos y `.gitignore`. No son 149 archivos de producto nuevos:
incluye todos los cambios y evidencia de las candidatas heredadas. El cierre añade
dos documentos: este informe y
[UNIFIED-CANDIDATE-INVENTORY-20261104.json](UNIFIED-CANDIDATE-INVENTORY-20261104.json),
con ruta, categoría, bytes y SHA-256 de los 149 blobs Git.

## Problemas reales de integración del arnés

Se identificaron cuatro incompatibilidades entre los arneses y una integración
necesaria de su ejecutor local. No requieren cambiar SQL, permisos ni contratos
del proveedor:

1. Los contratos Coach comparaban Auth/tema/SQL/HTML con un árbol anterior.
   Ahora comprueban la unión exacta de los tres SHA aprobados y sus cuerpos;
   no se eliminó el control de alcance ni se permitió contenido arbitrario.
2. El test final de Premium suponía que el evaluador V5 no había cambiado desde
   `f2c908f`. Ahora fija su SHA-256 aprobado por Coach; los otros cuatro contratos
   conservan sus preimágenes. La primera ejecución completó 22 casos y falló en
   el último; después pasó 23/23, contabilizado una sola vez.
3. El preview Coach anterior dependía de sustituir constantes que ahora resuelve
   el runtime. El runtime real rechaza correctamente los puertos/ruta de ese
   arnés. Se preparó un preview de pruebas explícitamente sintético, con CSP
   `connect-src 'none'`, SDK doble, clave ficticia y facturación cerrada.
   Siete negativos comprueban sus límites; no se relajó el runtime de producto.
4. El servidor de las pruebas de suscripción recibe también un runtime sintético
   explícito y congelado. El artefacto real se verifica separadamente; un PASS
   de este servidor no se presenta como prueba del runtime de hosting.
5. `scripts/ci-offline.cjs` reúne 24 suites de biblioteca estándar y añade cuatro
   comprobaciones de sintaxis de scripts hosting. No cambió ningún workflow ni
   automatización. Las pruebas que requieren historia Git completa, PostgreSQL,
   motores de navegador o SDK local siguen siendo comandos explícitos.

El intento restringido del nuevo preview no pudo conectar al loopback (`EACCES`);
el mismo comando pasó con el procedimiento normal de aprobación, sin quitar
aserciones. No se contabilizan los reintentos como casos adicionales.

## Hallazgos adicionales del frontend

La revisión independiente detectó y reprodujo dos defectos P2 que no cubrían las
suites históricas. Se corrigieron en tres archivos, **+15/-7 líneas de producto**:

- `assets/coach.js`: una admisión válida no implica poder generar. Ahora explica
  el cierre y vuelve a leer `get_my_coach_access` antes de guardar/enviar; exige
  `authorized === true` y `can_generate === true`. Una lectura fallida o un valor
  de tipo incorrecto tampoco provoca escritura ni dispatch. Conserva controles
  owner/epoch después de la espera, rutina aceptada, consulta y recuperación de
  intake submitted. El servidor sigue siendo la protección frente a carreras;
  la comprobación del navegador no sustituye su autorización transaccional.
- `assets/coach-premium-chat.js`: restaura el marcador antes de conciliar. Una
  lectura vacía o una respuesta histórica no prueba que el envío incierto no ocurrió.
  Conserva la clave para reintento explícito; reconoce el ID propio del servidor
  desde una respuesta correlacionada, y libera el marcador tras confirmación
  terminal o pérdida/cambio de autorización/revisión. Un mensaje anterior con
  idéntico texto y otro ID no borra la clave ni confirma visualmente el envío.
  No añade reenvíos automáticos ni persiste texto, JWT o credenciales.
- `index.html`: sólo las dos referencias de caché correspondientes pasan a
  `basic-commercial-gate-20261104` y `premium-chat-reload-20261104`.

Reproducción inicial: 12/38 PASS y 26 FAIL. La ampliación dirigida alcanzó 40 y
después 44 casos; el caso de historial idéntico produjo 42/44 antes de corregirse.
Final: **44/44** en ambos motores. No se suman esos intentos al total. No se
demostró un bypass del backend ni se produjo un doble cargo real.

Revisión independiente del diff final sin bloqueantes. SHA-256 LF de producto:

| Archivo | SHA-256 |
|---|---|
| `assets/coach.js` | `00f1edda86e420e1e6c7f94fef10f04c53513b28d2557992bbcc9590667f377f` |
| `assets/coach-premium-chat.js` | `52aa54f238fa1e9cb0ae8d3c44f98d0ca4b228835f38363430c9bb63fc998c0d` |
| `index.html` | `923ccba54762258d125aa960328db426a9f60ff47eb0bc65d2de0fffb4a1b168` |

## Pruebas del mismo árbol

**1.330/1.330 casos distintos superados: 92 nuevos y 1.238 regresiones.**
Node 24.19.0, PostgreSQL 17.11, Chromium/Edge headless y WebKit. Las 698 + 426 + 114
comprobaciones de las candidatas separadas son la procedencia histórica de las
regresiones; se ejecutaron nuevamente sobre la composición y no se suman dos veces.

| Grupo ejecutado sobre el worktree integral | Casos únicos aportados | Resultado |
|---|---:|---|
| CI offline, 24 suites | 539 | PASS |
| Coach restante, excluyendo 44 guard + 20 Edge HTTP + 7 preview ya en CI | 406 | PASS |
| PostgreSQL Premium | 91 | PASS |
| PostgreSQL Basic/comercial | 89 | PASS |
| PostgreSQL facturación | 24 | PASS |
| Contratos Premium | 23 | PASS |
| Criptografía webhook con SDK Stripe y transporte simulado | 7 | PASS |
| Navegador suscripción existente | 72 | PASS |
| Navegador comercial integrado anterior | 38 | PASS |
| Smoke del artefacto, dos motores, 320/1280, claro/oscuro | 8 | PASS |
| Nueva prueba cruzada del artefacto, 390 px, dos motores | 33 | PASS |
| **Total sin duplicados** | **1.330** | **PASS** |

Los 92 nuevos son 7 protecciones del preview, 44 regresiones de frontera Basic/
Premium, 33 casos cruzados y 8 controles de construcción independiente. Estos
últimos ocho ya están dentro de CI, no se añaden otra vez al total. Coach completo
son 477, hosting completo 155 y comercial 698, con solapamientos indicados; no
sumar esos subtotales además de la tabla. Los 38 comerciales eran nuevos en la
misión anterior, no en ésta.

Tras los ajustes se repitieron las suites afectadas, CI completo y suscripción110.
SQL, evaluador V5, criptografía y módulos reviewer no cambiaron después de sus
ejecuciones en esta composición; no se repitieron por el cambio de dos frontends.
Las 54 comprobaciones de sintaxis, diff-check, inspecciones de seguridad y hashes
son controles adicionales, no casos añadidos. Ningún resultado es CI remoto nuevo.

Comandos y desgloses: [Coach](../../tests/coach-flow/UNIFIED-CANDIDATE-RESULTS-20261104.md),
[hosting](../../tests/cloudflare/UNIFIED-HOSTING-RESULTS-20261104.md) y
`node scripts/ci-offline.cjs`, `node scripts/premium-review-postgres.cjs`,
`node scripts/commercial-postgres.cjs`, `node tests/premium-direct-production/unit.cjs`,
`node --experimental-vm-modules --test tests/commercial/webhook-crypto.test.mjs`,
`node tests/subscription/browser.cjs`, `node tests/subscription/integration-browser.cjs`.
Los recibos detallados están en `tests/**/results/`, ignorados por Git.
Los clústeres PostgreSQL y servidores propios terminaron cerrados; no quedaron
listeners en 4266, 4273, 4276, 4381, 55449 ni 55451. El escaneo final del diff no
detectó credenciales ni archivos privados. Identificó y revisó únicamente cuatro
sentinelas de tests negativos ya aprobados; no se ocultaron por ignorar directorios.
Las claves anon públicas reconocidas no se trataron como credenciales privadas.
El escaneo por patrones tiene límites y no certifica ausencia universal de secretos.

La prueba cruzada de navegador utiliza los bytes del artefacto construido. Primero
comprueba el runtime real, inmutable y cerrado ante parámetros de URL. Después
habilita la UI sólo mediante una interceptación del arnés, sin cambiar el archivo
de runtime. Con SDK doble comprueba suscripción Basic, generación cerrada, Premium
denegado, incertidumbre Coach tras recarga, recuperación pending_review y ausencia
de aceptación. Recorre la rutina y el historial sintéticos existentes, verificando
UUID, prescripción, notas y huellas antes/después. Portal y retorno HTTPS se sirven
por interceptación local: ninguna petición llega a Stripe, Cloudflare o Supabase.

Autenticación, respuestas Edge y derechos son simulados. PostgreSQL ejecuta SQL
real en clústeres nuevos de loopback, con claims sintéticas, no JWT reales. La firma
webhook usa criptografía del SDK Stripe real con mensaje sintético. Nada de ello
sustituye el ensayo conectado de revocación con el mismo JWT.

## Seguridad preservada

| RPC | MD5 exacto del cuerpo |
|---|---|
| `review_coach_proposal` | `d94b96ae65e69997a37ae83b521ec16b` |
| `authorize_coach_retry` | `cdf6200bb140563a96ddc472cc0ac9b7` |
| `premium_initial_review` | `c16541b25d191997fce42c2024784c7d` |

Premium SQL SHA-256:
`1dd35ba1a36dfcf1d11f6d0a07ec53540c20326ca1818cf89010a26890ad2458`.
Rollback cerrado SHA-256:
`4d2b33ed2b6770dfc1eb76dd17581ab004f6779334219a1a022e433819604428`.

La capa SQL coincide con comercial. Se preservan la autorización por operación,
revalidación tras bloqueos, caducidad/revocación en errores de negocio, propagación
de errores inesperados, idempotencia, consentimiento y revisión humana. Los
rollbacks estrechos de Basic/Premium deniegan el acceso, no recuperan las versiones
vulnerables. A/B siguen cerrados en los modelos locales; no se añaden admisiones,
asignaciones, cuotas o cambios de Financial P1.

`node scripts/reviewer-sql-check.mjs` verifica cuerpos, artefactos y escritores
históricos conocidos. Para staging ya configurado el plan es **no-op**, condicionado
a una lectura futura coincidente de preimágenes/ACL. No reinstalar A/B, no ejecutar
`migrations/*` en bloque y no seleccionar rollbacks históricos de pilot/allowance.
El control prueba órdenes conocidos; no puede impedir ejecución manual de SQL.
Un bootstrap nuevo exige revisar todas las dependencias y terminar con los parches
correctos. Este trabajo no certifica un instalador desde cero de todo Supabase.

Coach conserva el modelo `gpt-5.4-2026-03-05`, contrato `basic-initial-v5`, guard de
16.384 bytes/12.000 tokens de entrada/5.120 de salida, tier default, store=false,
truncation=disabled y ausencia de reintentos automáticos. No se llamó al proveedor,
incluido conteo. Los once archivos de la observación v36 siguen cotejados; el único
LF adicional de `contract-v5.mjs` conserva su excepción exacta documentada.

Mi suscripción exige `billingTest === true`, backend Security Test y perfil client.
El artefacto generado no incluye ese opt-in. El servidor sigue siendo quien decide
derechos; pagar Basic no habilita generación, reviewer ni Premium. El retorno no
concede derechos por su URL. Los tests cubren logout, respuestas tardías y otra
identidad; no se creó ninguna sesión real.
El ensamblador actual no ofrece un parámetro para activar la UI: el ensayo positivo
local usa una interceptación explícita del arnés. Para un ensayo visual conectado
positivo hará falta preparar y revisar un opt-in exclusivo de staging y su artefacto
exacto bajo autorización nueva; no editar a mano el `dist` aquí certificado ni
presentar el mock como ese despliegue.

## Artefacto y reproducibilidad

| Artefacto offline | Archivos | SHA-256 del inventario |
|---|---:|---|
| Preview staging, conservado en `dist/` | 43 | `37c896b9ca70f054dd7031d8b452e9ea9a2098f47b057ec748e02bd753137d71` |
| Producción, sólo construcción local | 39 | `feb47ddf6474503d49470597536fa444f0505b6a3f8e1412103f27e07b31f309` |

Dos raíces de fuentes y procesos Node independientes por perfil, cuatro builds
en total, producen inventarios/bytes idénticos A/B. Inventario de entradas:
`73a7dc408b17f3bcaf3f910c86c9a25444031ed74cc6a69aa90d741cc336f4e0`.
Detalle reproducible en [UNIFIED-ARTIFACT-INVENTORY-20261104.json](UNIFIED-ARTIFACT-INVENTORY-20261104.json).
Se mantienen 43 archivos justificadamente: 35 fuentes públicas, runtime generado,
tres auxiliares y cuatro archivos de retorno. Coach modifica recursos ya incluidos;
no requiere aumentar el inventario. Los hashes anteriores cambian por los bytes
de Coach y del HTML integrado. No se fuerzan ni reutilizan como hashes del nuevo árbol.

El manifiesto estático incluye recursos comerciales y Coach; añade el retorno
exacto de #5 sólo al perfil staging/local. No empaqueta SQL, pruebas, informes,
private, results ni Secrets. La página alternativa de retorno de #6 no se publica.

La reproducción offline utiliza metadata pública de ejemplo, no una autorización
para suplantar la metadata de Cloudflare:

```powershell
$env:SIMPLE_APP_URL='https://simple-staging-raulchulbi.pages.dev/'
$env:SIMPLE_PAGES_PROJECT='simple-staging-raulchulbi'
$env:CF_PAGES_BRANCH='codex/cloudflare-migration'
$env:CF_PAGES_URL='https://simple-staging-raulchulbi.pages.dev/'
node scripts/hosting-build.cjs --target preview
```

El comando sólo construye `dist/`. No ejecuta despliegue. El retorno es válido
exclusivamente en su origen HTTPS estable; localhost permite inspección y tests
interceptados, no acredita un Portal real. CSP principal permanece Report-Only;
retorno y placeholder tienen CSP aplicada. GitHub Pages no aplica automáticamente
los headers de Cloudflare.

## Compatibilidad con staging: alcance de la evidencia

No se consultó Supabase, Stripe ni Cloudflare durante esta composición. La lectura
anterior del 04/11 documentaba RPC coincidentes, A/B cerrados, 27/27 referencias,
cinco huellas de facturación y Premium apagado. Es evidencia histórica reutilizada.
Los resultados locales no certifican el estado conectado actual ni vuelven a
validar la compra TEST. No se borraron ni alteraron registros remotos.

Billing v7, webhook v5 y Coach v36 son las referencias previas. El webhook tiene
una variante histórica del helper Portal que no usa: no es motivo para redesplegar
todo el bundle. Coach conserva las fuentes v36 observadas; jamás sustituirlas por
v33. Antes de cualquier despliegue futuro se deben recuperar bundle completo,
imports, JWT, CORS y preimágenes actuales. Una diferencia desconocida detiene el plan.

## Riesgos y límites para lanzamiento

- **P0 nuevo de integración demostrado:** ninguno identificado en esta revisión
  acotada. Esto no certifica ausencia universal de vulnerabilidades.
- **P0 de lanzamiento comercial:** siguen pendientes oferta/cuotas/prestaciones,
  fiscalidad, condiciones, privacidad, soporte y configuración LIVE independiente.
  Los precios TEST y fiscalidad unspecified no autorizan ventas. Debe resolverse
  IVA/impuestos y registros antes de habilitar Stripe Tax o cobros reales.
- **P1 de activación:** revocación Basic con el mismo JWT conectado pendiente;
  bloquea habilitar reviewer, no la revisión del código con accesos cerrados.
- **P1 operativo:** replay de SQL histórico, deploy general de Edge o merge a main
  sin comprobar Pages/Cloudflare puede revertir seguridad o publicar sin intención.
- **P1 de validación:** falta ejecutar este artefacto completo con sesiones
  sintéticas legítimas, compra TEST existente, permisos y backend reales.
- **P2:** CSP principal informativa, dependencias CDN externas y ausencia de una
  auditoría completa de vulnerabilidades de la cadena de suministro. Las versiones
  fijadas y el escaneo de patrones no son una garantía absoluta.
- **P2 de reproducibilidad externa:** Supabase JS 2.115.0 y Stripe 23.0.0 están
  fijados directamente. No hay lockfile versionado de sus dependencias transitivas
  y el SDK servido por CDN no lleva SRI. El hash del artefacto cubre archivos propios,
  no certifica los bytes que sirva un tercero ni una resolución futura de Deno.
- **P2 de mantenimiento:** los informes previos conservan su alcance histórico;
  esta composición es la referencia de integración. No leer sus antiguos pendientes
  como operaciones nuevas a ejecutar automáticamente.
- **P2 de recuperación:** la clave Premium entre recargas requiere `sessionStorage`
  disponible y conservar pestaña/origen. No se certifica supervivencia después de
  borrar ese almacenamiento o cerrar la pestaña. No se guarda la pregunta: tras una
  respuesta perdida puede ser necesario reintroducirla para el reintento explícito.

Las guías oficiales consultadas confirman la necesidad de autorización en el cuerpo
de funciones privilegiadas y ACL restringidas, además de separar claves públicas de
secretos ([funciones](https://supabase.com/docs/guides/database/functions),
[claves](https://supabase.com/docs/guides/getting-started/api-keys)). No se cambió
ninguna clave. La documentación anuncia transición de claves legacy y cambios CLI v3;
antes de una operación futura se debe verificar versión/ayuda/target y no copiar
comandos antiguos a ciegas ([changelog](https://supabase.com/changelog)). El índice
Markdown no pudo abrirse por tipo de contenido; se consultó el HTML oficial.

## Integración futura por PR y SHA, sin ejecutarla

| Orden | Fuente revisada | Procedimiento futuro y riesgo |
|---|---|---|
| 1 | #5 `fc245c9c91113b1b9db9a28847bcbdfc715c5224` | Revisión humana y CI del SHA; mantiene el retorno. Merge a main puede publicar Pages aunque sea principalmente tooling. |
| 2 | #8 `1d1e443147d27a3e55a71aba9c212e30627a7b03` | Tema; conservar sincronización correcta de localStorage. Merge cambia la app servida por Pages. |
| 3 | #7 `b2a7636ca000eec838467952f87375067c3574cb` | Basic/Premium corregidos y backend TEST. Integrar código no requiere reaplicar SQL ni Edge. Resolver CI con unión de suites. |
| 4 | #6 `313344dbc607f2219922f7eb8a9102bc8cde3d53` | UI depende de status/portal/capabilities; mantener flag cerrado. No concede generación por entitlement. |
| 5 | #2 fuente `49ef741d5ba9fb58e38732fe7a031e7034d907dd`, delta `94c06d4e90bdb4449fde41fd6e6675e4db9d7e47` y fixes `fb9246f6f8da8748504f137481b6f0385ec5a8de` | Trasladar sólo delta reconciliado frontend/v36 más los dos fixes de esta misión, no toda la rama histórica. Mantener HTML comercial y runtime. |
| 6 | #1 fuente `81fe65f4b9b5a9b7c3d905c2ea3c432f8ef5d839`, delta `d613ba9489e02900761395d62ca245df85327cf0` | Runtime/build/headers del candidato; excluir SQL/runners conectados/automatizaciones antiguas. Recalcular inventario; comprobar autodeploy de la rama antes de push. |

Es un orden de **contenido**, no permiso para fusionar los HEAD históricos sin
reconciliarlos. Las ramas tienen bases distintas. Preparar cada nuevo HEAD sobre
el main entonces vigente, comparar con la composición integral y revisar el diff.
No subir este HEAD integral a una rama parcial de PR por inferencia. Preservar
commits originales; usar fast-forward cuando proceda, sin force ni rebase remoto.
Los dos fixes nuevos no están en la candidata Coach `94c06d4` original. Deben
trasladarse con sus pruebas al HEAD reconciliado de #2. Los ajustes de arnés/CI y
hosting de `fb9246f` corresponden a la composición: distribuir sus deltas revisados,
no hacer cherry-pick ciego de todo ese commit sobre una PR parcial.

En CI conservar las 24 suites locales; las suites históricas con comparación Git
requieren historia completa y no se añadieron al checkout superficial. PostgreSQL
y navegadores se validan separadamente. Este trabajo no generó Actions remoto nuevo.
Antes de push, leer controles actuales de ambas Pages, webhooks de despliegue,
branches permitidas, previews y workflows. La observación previa (staging automático
sólo rama #1, previews None y producción placeholder con autodeploy apagado) no
garantiza la configuración futura. Un merge main puede activar GitHub Pages main/root.

Rollback de frontend: conservar deployment y artefacto anteriores verificados,
restaurar sólo el artefacto autorizado y sus URLs/configuración, sin restaurar una
base de datos. Rollback SQL: sólo los cierres estrechos con preimagen/ACL y autorización
expresa; nunca revertir a acceso reviewer global ni resetear consumos. No hay un
rollback remoto que ejecutar en esta misión porque no se desplegó nada.

## Tres siguientes decisiones

1. Revisión independiente de esta candidata integral. Para compartir el candidato
   en GitHub, la autorización acotada sería publicar exclusivamente el SHA final
   entregado en `codex/simple-unified-candidate-20261104`, sólo después de comprobar
   HEAD remoto y que los controles actuales impiden despliegues. Sin force, PR nueva,
   merge ni cambio de otras ramas. Tras esa revisión se preparan por separado los
   HEAD reconciliados de las PR existentes; sus pushes requieren SHA concretos.
2. Autorizar prueba mínima de revocación con el mismo JWT sintético: scope/UUID,
   máximo de sesiones, caducidad, cierre/restauración y limpieza fijados previamente.
   No repetir las 34 comprobaciones ni habilitar generación.
3. Autorizar un artefacto concreto exclusivamente en staging y el ensayo autenticado
   integral con la compra TEST existente. Sin nuevos pagos, generaciones ni Portal
   adicional salvo autorización expresa. LIVE y corte productivo son fases posteriores.

No se hizo push, PR, merge remoto, despliegue, SQL conectado, Auth, pago, Portal,
OpenAI ni modificación de Secrets, Cloudflare, Stripe o producción.
