# Reviewer Basic: denegación uniforme por operación

Fecha: 03/11/2026. Base: PR #7, `3cd39320d4473fdc5ce6b25f95c1953e90cec954`.
Rama local: `codex/reviewer-uniform-denial`. No push, deploy ni SQL remoto.
Estado: **APTO PARA REVISIÓN**, exclusivamente el parche Basic local. No es una
autorización de instalación ni el cierre del problema Premium independiente.

## Causa y alcance

`review_coach_proposal` y `authorize_coach_retry` comprobaban primero la
admisión general, buscaban `coach_operations.user_id` y tomaban el bloqueo
advisory del propietario. Solo después comprobaban la asignación y su acción.
Un reviewer admitido, incluso con solo `view`, podía distinguir:

- UUID inexistente o propio: `42501 / coach_not_authorized`.
- Operación ajena existente sin permiso: `42501 / coach_review_scope_required`.
- Un propietario bloqueado: espera de su advisory antes de denegar el permiso.

Esto revela existencia y permite interferir en bloqueos; no demuestra lectura
de la propuesta privada ni escritura no autorizada. El preflight histórico
encontró las admisiones cerradas. En esta tarea no se consulta Supabase y no se
presenta esa evidencia histórica como una nueva comprobación conectada.

## Corrección

Solo cambian los cuerpos de esos dos RPC en `supabase/coach-reviewer-scope.sql`.
Antes de resolver el propietario, validar argumentos deportivos o adquirir
bloqueos se consulta `can_review_operation(auth.uid(), p_operation, acción)`.
El helper ya exige admisión vigente, identidad, operación y propietario exactos,
`view` junto con la acción `review` o `retry`, asignación vigente/no revocada y
el consentimiento activo exacto. No se sustituye por un permiso genérico.

Todas las denegaciones de ámbito usan `42501 / coach_review_scope_required`, sin
DETAIL, HINT ni nombres de tablas/columnas/constraints. Se mantiene el orden:

1. Precomprobación sin bloqueos de filas ni advisory del propietario.
2. Resolver propietario únicamente después del permiso específico.
3. Advisory del propietario.
4. Asignación `FOR SHARE` y revalidación, incluso si su bloqueo esperó.
5. Operación `FOR UPDATE` y segunda revalidación con reloj real.
6. Comprobar que la fila sigue siendo del propietario bloqueado y aplicar las
   comprobaciones existentes de estado, consentimiento, versión, cuota/reintento.

El primer check no sustituye a los posteriores. La asignación permanece bloqueada
hasta commit: si una revocación empieza después de ese bloqueo, se serializa tras
la decisión; si gana antes, la decisión se deniega. No se invierte el orden de
bloqueos. Los writers normales del contexto del atleta comparten su advisory;
una escritura administrativa que omita deliberadamente esa disciplina no forma
parte del modelo de concurrencia de la aplicación.

Se conserva el tipo compuesto del RPC de revisión y su lista explícita de campos
seguros; los demás campos siguen siendo NULL en la respuesta y permanecen intactos
en almacenamiento. Retry sigue devolviendo booleano y no genera ni acepta nada.

## Auxiliares y compatibilidad

No cambian `can_review_operation`, `lock_review_scope`, cola, métricas, estado,
feedback, roles, propietarios, EXECUTE, RLS ni firmas. Los dos helpers privados
carecen de EXECUTE para anon/authenticated/service_role; no se pueden usar como
oráculo alternativo. Cola y feedback filtran el scope; las lecturas directas
siguen siendo por propietario. Se prueba una segunda operación con otro owner.

Checkpoint A conserva tabla, FKs, permisos, caducidad y revocación. B, facturación,
V5, cuotas, consentimiento y Premium no se editan. La suite local ejercita B
cerrado, Basic pagado, Premium denegado, idempotencia, cuotas y revisión humana.
No sustituye la verificación de la suscripción TEST real.

Cambio intencional de errores: los writers devuelven `coach_review_scope_required`
también donde antes devolvían `coach_not_authorized` o `coach_reviewer_required`.
Los consumidores deben tratarlo como denegación. La UI actual captura cualquier
error, no realiza ninguna acción automática y muestra su mensaje genérico de
fallo para este código. No se ha rediseñado la UI ni se ha probado con navegador.

## Pruebas y evidencia local

PostgreSQL 17.11 y Node 24.19.0. El runner crea un clúster nuevo en loopback,
valida host/puerto/base/usuario/directorio/marcador, usa solo datos sintéticos y
lo detiene al terminar. Auth, perfiles y el validador de intake son adaptadores
locales; las funciones de revisión, scopes, RLS, gate y contabilidad son SQL real.
**No son pruebas JWT de Supabase ni pruebas de staging.**

Matriz nueva en `tests/commercial/reviewer-enumeration-cases.mjs`:

- Ambos RPC: inexistente, NULL, propia, ajena sin asignación, solo view, acción
  incorrecta, falta view, revocada, caducada, admisión cerrada/caducada y
  consentimiento revocado/sustituido.
- Igualdad de SQLSTATE, mensaje, detail, hint, nombres de objetos y stack.
  Del stack se retira exclusivamente la expresión SQL que ya aportó el propio
  caller; se conservan todos los frames y datos del servidor.
- Denegaciones sin esperar el advisory/fila ajenos: un holder independiente
  mantiene ambos bloqueos; `lock_timeout=100ms` detectaría cualquier intento.
- Revocación de scope, cierre de admisión y revocación de consentimiento durante
  esperas observadas en `pg_stat_activity`; caducidad de admisión/asignación;
  serialización de revocación detrás del SHARE ya adquirido.
- Aprobación/rechazo legítimos, retry idempotente, aislamiento de otra operación,
  campos privados, acceso a helpers y rollback/reaplicación estrechos.

| Ejecución | Resultado final | Casos nuevos |
|---|---:|---:|
| PostgreSQL local comercial/reviewer | 89/89 consolidado | 54 |
| PostgreSQL local billing | 24/24 | 0 |
| CI offline local, nueve suites | 267/267 | 0 |
| Análisis sintáctico CI | 44/44 | No son casos funcionales |

Son 113 casos PostgreSQL distintos y 267 offline. No se suman reejecuciones.
Los 54 nuevos pasaron todos en la primera ejecución completa del parche; 26
comparan denegaciones por RPC/escenario, dos comprueban ausencia de espera ajena,
16 revalidan cambios durante esperas, dos serializan una revocación posterior,
cuatro cubren caducidad durante el bloqueo de asignación y cuatro cubren
auxiliares, retry idempotente, rechazo seguro y rollback estrecho.

La ejecución completa comercial dio inicialmente 88/89. El único fallo fue una
prueba previa del gate que esperaba 80 ms sin observar si el holder había tomado
su lock: no establecía el escenario de concurrencia que pretendía probar. Se
sustituyó por barreras observadas y se comprobó `pg_blocking_pids`, manteniendo
la exigencia de denegación y añadiendo cero operaciones creadas. Se repitió solo
ese caso: 1/1 PASS. B no se modificó. Por tanto **89/89 es consolidado**, no una
nueva ejecución completa. Comando focalizado reproducible:

```text
node scripts/commercial-postgres.cjs "--test-name-pattern=^paid period expiring"
```

El runner registra las ejecuciones filtradas en un archivo distinto. El nuevo
módulo y el runner también pasaron `node --check`; `git diff --check` limpio.

La primera invocación encontró una restricción del entorno al abrir loopback;
su clúster se detuvo sin pruebas completadas. Se usó la aprobación normal para
ejecutar el mismo runner local. La ejecución contra el código original confirmó
errores distintos y esperas no autorizadas; alcanzó el antiguo límite de 120 s
antes de terminar toda la matriz. No se cuenta como suite completa ni como nuevos
casos adicionales. El límite del runner pasa a 240 s por la matriz de concurrencia,
sin alterar las aserciones ni los timeouts que verifican seguridad.

Evidencias ignoradas: `tests/commercial/results/reviewer-before-console.txt`,
`reviewer-enumeration-before.tap`, `reviewer-after-console.txt`,
`commercial-postgres.tap`, `billing-postgres.tap`, `reviewer-offline.txt`,
`reviewer-gate-targeted.txt` y `commercial-postgres-filtered.tap`.

## Premium inicial: problema independiente, sin cambios

La definición efectiva conservada del preflight, MD5 de prosrc
`3e954ba0b8bc7f8f97525b58780b4cc8`, confirma que `premium_initial_review`:

1. Busca la operación antes de comprobar elegibilidad Premium completa.
2. Exige reviewer admitido y exactamente `operation.reviewer_id`.
3. Toma advisory/fila y llama a `premium_initial_assert` antes de comprobar estado.

Para un reviewer admitido con referencias históricas, un UUID ausente/ajeno
produce `42501 / premium_initial_reviewer_required`, pero una operación histórica
asignada puede producir `P0001 / premium_initial_stale_or_revoked` con Premium
cerrado. También puede esperar bloqueos del propietario histórico. Es un oráculo
de operaciones anteriormente asignadas, no acceso global a toda operación Premium.
No se ha invocado ese RPC ni se afirma una exposición actual de contenido.

La admisión compartida de Basic puede habilitar esta ruta aunque los interruptores
Premium sigan apagados. La cola aplica requisitos adicionales; su ausencia de
resultados no demuestra seguridad del writer. La proyección Premium ya saneada
no resuelve la diferencia de errores previa a esa proyección.

Propuesta separada, **no implementada**: comprobar el cierre global y la admisión
Premium antes de buscar operaciones, validar autorización actual completa por
operación con denegación uniforme (incluido consentimiento/entitlement/versiones),
separar la admisión Premium de la admisión Basic o aplicar un guard equivalente,
conservar orden de locks y repetir la autorización después de cada espera.
Una mera comprobación del flag al inicio cubre el estado apagado, pero no basta
para el caso de entitlement revocado cuando el flag está encendido.

Pruebas necesarias en ese encargo: UUID inexistente/ajeno/propio, historial
accepted, actor solo Basic, Premium cerrado, entitlements y consentimiento
revocados/caducados/versionados, reviewer reasignado, respuestas/proyección,
ningún lock ajeno y carreras después de advisory/fila; conservar aprobaciones
legítimas e idempotencia sin generación real ni cambios presupuestarios.

El futuro ensayo Basic usará provisionalmente `trainer`, con scope mínimo, tras
revalidar que sigue sin referencias Premium. Sus relaciones de entrenamiento
preexistentes se conservan; no se presenta como cuenta sin historia. El reviewer
histórico debe seguir cerrado. Esto evita el camino conocido, no corrige Premium.

## Instalación futura y rollback (NO ejecutados remotamente)

1. Revisión del diff y autorización independiente del delta exacto en Security
   Test. Confirmar proyecto, ausencia de concurrencia, configs cerradas,
   asignaciones vacías, gate false, 27 referencias, facturación y huellas
   Premium/seguridad. Capturar preimágenes efectivas, owners, ACL y dependencias.
2. Verificar que los prosrc actuales de los dos RPC siguen siendo
   `c23436abc2032fa2e9f17b749d13e221` y `401d523d5a2b35b2dcf16f06e82e6a2f`.
   Si hay cualquier diferencia, detenerse y reconciliar. Revisar también las
   dependencias: no basta con dos hashes aislados.
3. Usar exclusivamente los dos `CREATE OR REPLACE FUNCTION` del candidato,
   revisar el archivo congelado y SHA-256, y ejecutarlo en una
   transacción con precondiciones. **No reaplicar `coach-reviewer-scope.sql`
   completo ni A/B**: contiene creación de tabla y políticas de la instalación
   inicial. La prueba local de reemplazo usa exactamente esa extracción.
4. Comparar definiciones, OID/propietarios/ACL/RLS, cierre, baseline 27 y facturación.
   Verificar denegaciones con JWT solo bajo autorización independiente de esas
   sesiones; no habilitar asignaciones ni escrituras de negocio para probarlas.
5. Ante respuesta incierta, leer estado antes de actuar. Si hay regresión
   atribuible y reversión autorizada/segura, aplicar únicamente
   `supabase/rollback-coach-reviewer-uniform-denial.sql`: cierra ambos writers,
   preserva firmas/ACL/datos/gate y no restaura el oráculo ni el reviewer global.
   Su reaplicación local se comprueba junto con las definiciones y permisos.
6. El ensayo positivo de siete filas y acceso view temporal sigue requiriendo
   autorización propia. No se activa como parte de esta corrección.

No hay garantía de tiempo de respuesta criptográficamente constante; se eliminan
la diferencia explícita de errores y los locks ajenos antes del permiso. La
matriz local no cubre el gateway PostgREST real ni toda intercalación posible de
administración externa. Permanecen pendientes revisión humana, instalación
autorizada y comprobación JWT conectada. No se han tocado Supabase, Auth, Stripe,
Secrets, Cloudflare, producción ni llamadas al modelo.

## Archivos y huellas preparados

- `supabase/coach-reviewer-scope.sql`: dos cuerpos corregidos. El resto del archivo
  es idéntico a la base, comprobado por sustitución/extracción exactas.
- `supabase/rollback-coach-reviewer-uniform-denial.sql`: reversión estrecha cerrada.
- `tests/commercial/reviewer-enumeration-cases.mjs`: 54 casos nuevos.
- `tests/commercial/postgres.test.mjs`: registro de matriz, errores uniformes
  esperados y barrera observable de la prueba histórica del gate.
- `scripts/commercial-postgres.cjs`: límite 240 s y filtro de casos focalizados,
  sin cambiar aislamiento ni permitir conexiones a un servidor existente.
- Este informe: causa, evidencia, limitaciones y plan independiente Premium.

Prosrc MD5 nuevo (comparable con catálogo, no hash de archivo):

| RPC | Antes | Después |
|---|---|---|
| review_coach_proposal | `c23436abc2032fa2e9f17b749d13e221` | `d94b96ae65e69997a37ae83b521ec16b` |
| authorize_coach_retry | `401d523d5a2b35b2dcf16f06e82e6a2f` | `cdf6200bb140563a96ddc472cc0ac9b7` |

Artefacto local de revisión, ignorado, **no ejecutado remotamente**:
`tests/commercial/results/reviewer-uniform-denial-delta.sql`, SHA-256
`9b48d41fa227c879ceb60ae2578b1f3e74e852b832c048186f55ff3e6b00c4a9`.
No incluye el preflight del proyecto: no usarlo fuera del procedimiento anterior.

SHA-256 del instalador completo A modificado (solo referencia, no reaplicar):
`cb5438c9618e7fdfdb2b1c5ef69152f704b0449dde91d46b4f65b56f653d626c`.
SHA-256 del rollback estrecho:
`b1b26700138d09a54373e94e1f09f338a2529ba520394576a8bade6687cb5270`.
Huellas completas en `tests/commercial/results/reviewer-source-verification.json`.

Git remoto consultado en lectura: main `b2f77c6f86318a4bf11d2b6754b2e3bbd7263ac6`,
Pages y CI de ese SHA success; PR #7 sigue draft en `3cd3932`. No se cambió
main, ninguna PR ni la rama remota. No se realizaron pruebas autenticadas en
producción ni se revalidaron las 27 tablas de staging en este encargo local.

Referencias: [bloqueos PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html),
[seguridad de funciones Supabase](https://supabase.com/docs/guides/database/functions).
