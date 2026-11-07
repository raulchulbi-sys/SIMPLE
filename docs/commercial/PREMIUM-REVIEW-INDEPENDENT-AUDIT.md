# Revisión independiente del RPC Premium inicial

> Revisión histórica incompleta respecto a errores del validador. El defecto
> residual de caducidad se confirmó posteriormente; ver la corrección y evidencia
> en [PREMIUM-ERROR-BOUNDARY-20261104.md](PREMIUM-ERROR-BOUNDARY-20261104.md).

Revisión local de código del 03/11/2026. Base `fffbc16d9588225c0e350324d7fc28af9e25209b`.
No se consultaron ni modificaron Supabase, Auth, Stripe o datos privados durante
esta revisión. No es una prueba de JWT ni de integración remota.

## Causa comprobada

La definición original de `public.premium_initial_review(uuid,boolean,text)`
en `supabase/migrations/20261011154036_coach_premium_initial.sql` selecciona la
operación por UUID antes de verificar la autorización Premium vigente.
`operation.reviewer_id` es una referencia histórica que permanece aunque el
entitlement, los consentimientos o la admisión hayan caducado o sido revocados.

Para un reviewer admitido y vinculado históricamente, un UUID inexistente o ajeno
produce `42501 / premium_initial_reviewer_required`. El UUID histórico vinculado
puede llegar a `premium_initial_assert` y producir
`P0001 / premium_initial_stale_or_revoked`, incluso con Premium cerrado. También
puede esperar los bloqueos del propietario. Esto permite distinguir existencia
dentro de esa relación histórica. No se demuestra acceso global ni exposición
del contenido privado.

La cola y la proyección segura no corrigen este problema del writer. La admisión
compartida Basic/Premium hace necesario comprobar elegibilidad Premium completa,
además de `is_reviewer`, antes de usar la operación para resolver bloqueos.

## Diseño del delta revisado

`supabase/premium-initial-review-uniform-denial.sql` reemplaza solamente el RPC.
No cambia firmas, ACL, tablas, RLS, presupuestos ni reglas de generación.
No crea un helper accesible que pueda convertirse en otro oráculo.

La autorización exige identidad no nula, admisión reviewer vigente, presupuesto
inicial habilitado, coincidencia de reviewer y versión de entitlement actuales,
elegibilidad del propietario, ambos consentimientos, intake vigente y ausencia
de rutina/asignación/management incompatibles. Solo las operaciones pendientes
de revisión y las listas para aceptar pueden entrar. Los estados históricos
resueltos dejan de distinguirse mediante este writer.

La aprobación repetida de una operación `ready` sigue devolviendo su proyección
segura sin otra actualización. Rechazar una operación `ready` continúa siendo
inválido. La respuesta, el validador y las transiciones humanas existentes se
conservan. La aprobación no acepta la rutina ni crea entrenamiento.

Se revisan cuatro puntos de autorización:

1. Antes de resolver bloqueos del propietario.
2. Después de los dos advisory locks de `premium_upgrade_lock`.
3. Después de bloquear operación, entitlement, intake, consentimientos y flag.
4. Después de validar la propuesta y antes de devolver o escribir el resultado.

El RPC es PL/pgSQL `VOLATILE` por defecto. Cada consulta posterior usa un snapshot
nuevo en READ COMMITTED. Los helpers `STABLE` reciben el snapshot de la consulta
que los llama, no una copia perpetua anterior a los bloqueos. `is_reviewer` y las
comparaciones con `clock_timestamp()` evalúan la caducidad después de las esperas.

## Orden y revocación

Orden del parche: advisory propietario → advisory semanal propietario → operación
UPDATE → entitlement SHARE → intake SHARE → consentimientos SHARE por UUID →
presupuesto inicial SHARE.

Las API actuales de entitlement, allowance, consentimiento, intake, claim,
finish y aceptación toman primero `premium_upgrade_lock` del mismo propietario.
Por ello no existe inversión de filas entre esas API y el writer revisado.
El claim también bloquea el presupuesto de análisis antes del inicial; el writer
revisado nunca solicita el de análisis, por lo que no introduce el ciclo inverso.

Una revocación que gana el advisory se observa al reanudar y deniega la revisión.
Cuando la revisión gana el bloqueo, la revocación espera hasta su terminación:
es una secuencia serial válida, no una revocación retroactiva. La caducidad
temporal requiere además la comprobación final, porque ningún row lock detiene
el reloj.

No se garantiza ausencia de deadlocks frente a SQL administrativo arbitrario que
adquiera filas en otro orden ignorando los advisory existentes. PostgreSQL aborta
una transacción si detecta ese ciclo; el procedimiento operativo debe respetar
el orden documentado y no reintentar automáticamente una decisión incierta.

## Observaciones incorporadas y verificadas en el código

- El parche congela el UUID del propietario obtenido en el primer guard y exige
  que no cambie en fases posteriores. Ninguna API actual cambia el propietario de una
  operación, pero evita actuar sin su bloqueo si una fila fuese reubicada por
  una administración concurrente.
- Las asignaciones tienen un trigger que usa el bloqueo del propietario, pero
  una inserción ordinaria de rutina podría no compartirlo. Si cambia entre el
  guard y `premium_initial_assert`, el parche mapea exclusivamente sus errores conocidos
  de autorización/contexto (`stale_or_revoked`, `existing_routine`,
  `stale_intake`) a la misma denegación. No captura indiscriminadamente errores
  del validador deportivo o de infraestructura. Repropaga cualquier otra excepción.
- Una instalación futura debe exigir preimagen efectiva, OID, propietario, ACL
  y atributos aprobados antes del reemplazo. No reaplicar la migración original
  completa ni instalar este delta junto a A/B de forma indiscriminada.

La relectura del delta confirma ambas correcciones. No se identifica un defecto
de autorización pendiente en este diff mediante la inspección independiente.
El informe consolidado debe asociar cada garantía a las pruebas realmente
ejecutadas; esta revisión documental no atribuye un PASS a pruebas todavía no
ejecutadas por el coordinador. La preimagen remota y el recorrido JWT continúan
pendientes de una autorización independiente.

## Matriz necesaria

Negativas con el mismo error público para UUID inexistente, NULL, ajeno, propio,
histórico accepted/rejected/failed, actor admitido solo en Basic, Premium OFF,
entitlement deshabilitado/caducado/versionado, reviewer reasignado, consentimiento
revocado y contexto obsoleto. Los parámetros inválidos no deben distinguir IDs
cuando la autorización falta.

Carreras mediante barreras observables en ambos advisory y en la fila de la
operación. Cubrir revocación, cambio de versión/asignación y caducidad tras la
espera. Un UUID histórico no autorizado no debe esperar un advisory ajeno.

Positivas de aprobación y rechazo humanos, aprobación `ready` idempotente,
resolución concurrente única, proyección sin recibo/coste/campos privados,
persistencia del recibo original y ausencia de rutina o entrenamiento nuevos.
Comparar OID/owner/ACL/atributos antes y después del parche y su rollback.

## Rollback y límites

`supabase/rollback-premium-initial-review-uniform-denial.sql` cierra únicamente
el writer con la misma denegación. Preserva datos, contabilidad, OID y permisos.
No restaura el cuerpo vulnerable ni habilita el reviewer global. Interrumpe
temporalmente decisiones Premium nuevas; el entrenamiento y las rutinas
entregadas no dependen de este RPC.

Uniformidad de errores y ausencia de bloqueos no autorizados no equivalen a
tiempo de respuesta criptográficamente constante. La validación PostgreSQL local
debe separarse de un ensayo autenticado PostgREST/JWT futuro y autorizado.

Referencias técnicas consultadas por el coordinador:
[aislamiento PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html)
y [seguridad de funciones Supabase](https://supabase.com/docs/guides/database/functions).
