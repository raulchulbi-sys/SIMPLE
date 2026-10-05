# Premium Phase 5: host y adapters

Base: `1b8cf72`, rama `codex/premium-upgrade`. Este módulo todavía no se publica ni sustituye la entrada Basic de producción.

## Entrada con sesión existente

`PremiumApp.attach(container, { db, onNavigate, mesocycleId? })` recibe **la misma instancia `db` ya creada por SIMPLE**. Lee `db.auth.getSession()` para transportar la sesión actual y `premium_my_access()` para el acceso efectivo del servidor. No crea un cliente Supabase, no cambia sesión, no selecciona usuarios y no modifica perfiles/roles. Si el servidor no habilita Premium, retorna `{enabled:false}` sin montar un recorrido Premium; el contenedor/flujo Basic del caller se conserva. El caller decide volver a la pantalla SIMPLE Coach mediante `onNavigate('coach')`.

`mesocycleId` es un destino explícito, no una selección de actor: la lectura sigue usando el JWT actual y RLS. Permite abrir la revisión de un mesociclo que el reviewer asignado puede leer. Ese recorrido no consulta conversaciones ni incorpora fallback con un JWT de atleta.

El SDK local no es una fuente de autorización. Las RPC, RLS, grants y el entitlement privado del backend vuelven a validar cada operación. No se utilizan `user_metadata`, rol `client` por sí solo, email, localStorage ni parámetros de la URL para conceder acceso Premium.

## Mapa exacto

| Archivo / función | Origen | Destino / operación |
|---|---|---|
| `assets/coach-premium-app.js`, `attach` | SDK `db` existente; estado del servidor | `PremiumAdapter.create(db)` y montaje aislado de la navegación Premium |
| `assets/coach.js`, `renderCoachHome` / `openPremiumCoach` | Gate `premium_my_access` del JWT actual; SDK existente | Entrada Premium secundaria; diálogo aislado; atrás a SIMPLE Coach y entrenamiento a `openCoachRoutine(routine_id)` |
| `assets/coach-reviewer.js`, `renderPremiumCoachReviewerEntry` | RLS `coach_mesocycles`, columnas `id,number,state` y filtro `reviewer_id=current user` | Entradas de mesociclos asignados por UUID, sin identidad/contacto del atleta; mantiene la cola Basic |
| `coach.js`, `openPremiumCoach({mesocycleId})` | Trainer actual; nueva lectura RLS de `id` por mesociclo/reviewer exactos | `PremiumApp.attach` con ese destino; sin entitlement de owner ni sesión de atleta |
| `assets/coach-premium-adapter.js`, `session` | `db.auth.getSession()` actual | Transporte SDK con el JWT actual; UUID del owner como filtro de lecturas |
| Adapter `state` | RPC `premium_my_access()` | Plan, enabled, caducidad, capacidades, consentimiento, allowances y rutinas propias; no cambia `profiles.role` |
| Adapter `state` owner | RLS de `coach_mesocycles`, `coach_mesocycle_weeks`, `routine_revisions` | Mesociclo, semana actual, revisión y snapshot exactos; no reconstruye por nombre ni posición |
| Adapter `state` reviewer asignado | RLS de mesociclo/semanas/recomendaciones y RPC `premium_recommendation_view` | Conserva `current_revision_id` exacto y obtiene hechos, nombres, cambios y avisos seguros; no consulta las revisiones privadas del owner ni inventa su ordinal o programación completa |
| Adapter `state` | RLS de `context_grants`, `coach_weekly_checkins` | Grants de historial/check-in y check-in de semana/revisión actual, solo owner |
| Adapter `state` / `recommendation` | Listado seguro de `coach_recommendations`; RPC `premium_recommendation_view(p_id)` | Hechos, nombres por identidad exacta, patches antes/después y warnings; sin bundles ni chat raw |
| Adapter `handle('admission_permission')` | Checkbox explícito de seguimiento | `premium_admission_permission(p_allow,p_notice)`; `premium-followup-v1` suministrado por servidor |
| Adapter `handle('upgrade')` | Rutina Basic propia, revisión y clave UUID explícitas | `upgrade_basic_routine_to_premium(p_routine,p_revision,p_key,p_start,p_weeks)`; conserva routine_id/historial |
| Adapter `handle('start')` | Rutina propia no gestionada y clave UUID | `premium_start_followup(p_routine,p_key,p_start,p_weeks)`; adopción normal, sin clonar/generar rutina |
| Adapter `handle('history_permission')` | Acción explícita de permiso de historial | RPC vigente `premium_permission(p_mesocycle,p_allow)` |
| Host `intakeView`, `intake_next`, `intake_save` | Vocabulario, árbol, normalización y validación de `SimpleCoachIntake` (`coach-intake.js`) y títulos de `coach-questionnaire.js` | `premium_save_intake(p_mesocycle,p_expected,p_training,p_submit)`; versión optimista y relectura |
| Host `checkin`, `checkin_next`, `checkin_save` | Preguntas/validación/resumen de `PremiumWeekly` (`coach-premium-weekly.js`) | `premium_save_weekly_checkin(p_mesocycle,p_week,p_revision,p_expected,p_answers,p_submit)` |
| Adapter `handle('weekly_permission')` | Checkbox explícito, aviso `premium-checkin-v1` | RPC vigente `premium_weekly_permission(p_mesocycle,p_allow)` |
| Adapter `handle('analyze')` | Acción manual, clave UUID | Edge vigente `simple-coach-premium`, cuerpo exacto `{mesocycle_id,key,mode:'weekly'}`; no polling por dispatch ni retry automático |
| Host pantalla `analysis` / `proposal` | Proyección segura de recomendaciones | Muestra KEEP/MODIFY/REVIEW, revisión base, estado, hechos, antes/después y warnings antes de aceptar |
| Adapter `handle('review'/'reject')` | Reviewer asignado, motivo explícito | RPC vigente `premium_review_recommendation(p_id,p_approve,p_reason)` |
| Adapter `handle('resolve')` | Reviewer ante REVIEW, motivo explícito | RPC vigente `premium_resolve_review(p_id,p_kind:'KEEP',p_patches:[],p_reason)`; la preview ofrece conservar, no inventa patches |
| Adapter `handle('accept')` | Owner, propuesta ready y confirmación explícita | RPC vigente `premium_accept_recommendation(p_id)` y `state()` posterior; programación y chat pasan a revisión N+1 |
| Host pantalla `chat` | Componente vigente `PremiumChat.mount` y `fromBackend` | Misma navegación; mensaje nunca aplica un cambio directamente |
| Adapter `handle('chat_state')` | Mesociclo actual | RPC vigente `premium_chat_load(p_mesocycle)`; proyección pública cerrada |
| Adapter `handle('chat_permission')` | Checkbox vigente del chat | RPC vigente `premium_chat_permission(p_mesocycle,p_allow)` y relectura; no se concede permiso al escribir |
| Adapter `handle('chat_send'/'chat_retry')` | Clave/revisión/mensaje del componente chat | Edge vigente `simple-coach-chat`, cuerpo exacto `{mesocycle_id,revision_id,key,message}`; IDs locales y retry_of no se envían |

`PremiumAdapter.create` también se exporta mediante CommonJS para que el runner JWT real use un proxy del SDK **con las mismas consultas/RPC**. El runner no debe reemplazar este mapping con una pipeline simulada.

## Hook real incluido en el candidato

`index.html` carga los contratos weekly/chat, adapter/host y estilos aislados. `assets/coach.js:renderCoachHome` mantiene el acceso Basic existente y añade la entrada secundaria «Abrir seguimiento Premium» únicamente cuando `premium_my_access().enabled === true`. Una función ausente (`PGRST202`), gate disabled o error no concede acceso; Basic conserva su recorrido.

`openPremiumCoach` / `premiumCoachDialog` montan `PremiumApp.attach(host,{db,onNavigate})` usando el mismo SDK/sesión actual. El gate se vuelve a leer al abrir. Atrás cierra/destruye el diálogo; salir de sesión o cambiar el usuario elimina el contenido anterior. Epoch y comprobación del estado nativo del diálogo impiden que una respuesta o un evento close de una apertura anterior destruyan o reabran la siguiente.

`PremiumApp:program` conserva el destino de entrenamiento existente: «Entrenar» pasa el `routine_id` de ese mesociclo a `onNavigate('train')`; el hook cierra Premium y llama `openCoachRoutine(UUID)`. No crea una navegación alternativa, sesión nueva ni rutina duplicada. El candidato contiene ya este hook, pero no se ha promovido a producción.

La lectura de prescripciones entregadas utiliza `assets/coach-premium-prescription.js:read/hints`, `coachReadRoutineHints` y el renderer de entrenamiento vigente. Para Premium N+1 se valida `origin=premium_recommendation`, `operation_id=null`, owner/rutina/revisión y los doce UUID, aunque management conserve la referencia a la operación Basic original. `index.html:saveWorkoutSession` añade el `routine_revision_id` exacto de la revisión entregada solo a un workout nuevo. No reescribe registros previos. La prescripción y rutina aceptadas siguen utilizables fuera del entitlement de seguimiento.

El reviewer dispone también de entrada real acotada: `renderCoachReviewerEntry` mantiene intacta su cola Basic y llama al listado Premium de mesociclos asignados al trainer actual. Al abrir se verifica nuevamente `id/reviewer_id` por RLS; el adapter determina el actor por el owner del mesociclo devuelto. La ausencia de entitlement del reviewer como atleta no impide su revisión asignada; no se consultan las revisiones privadas, grants, check-ins personales ni conversaciones del atleta. La revisión se muestra como «actual» sin inventar un número, y la programación completa permanece en el recorrido del owner; la propuesta usa la proyección segura existente. Su home no afirma un estado de check-in que no ha leído y no ofrece Mi programación; explica que los hechos, cambios y avisos disponibles están en la propuesta. Una navegación directa a programación describe el límite de ese acceso, sin afirmar que la rutina esté vacía. Un trainer no asignado falla cerrado.

Validación final tras la autorización de refresh limitado: `reviewer-adapter.cjs jwt` pasa `7/7` con JWT reales y runtime exclusivamente en memoria. Detectó y permitió corregir la dependencia residual de actor client: el adapter identifica primero el scope del reviewer sin pedir intake privado ni premium_my_access; el RPC seguro usa auth.uid() con owner client o reviewer asignado vigente. RLS y grants intactos. `reviewer-adapter.cjs local` final pasa `16/16`, `host.cjs` final `150/150` y `reviewer-ui.cjs` `24/24`, reemplazando sus ejecuciones previas. Evidencias y límites en FINAL.md; no se guardan las sesiones renovadas.

## Privacidad y consistencia

- El listado selecciona columnas explícitas; no selecciona `analysis_bundle`, `context_snapshot`, conversaciones, notas personales, recibos o tokens. El RPC de detalle genera nombres con bindings/snapshot por UUID.
- Si el scope de detalle fue revocado o quedó stale, se conserva únicamente el listado histórico seguro; no se recupera un bundle privado como fallback. Errores desconocidos/de red sí se propagan.
- UI por `textContent`; no HTML/Markdown del modelo. Las series se muestran en minutos, conservando seconds internamente. Las repeticiones legacy `reps_min/reps_max` se leen explícitamente.
- Tras una escritura se verifica el estado releído, nunca solo el mensaje devuelto por el envío. La comparación JSONB ignora orden de claves de objetos y conserva el orden de arrays/series.
- Los borradores locales se separan por user/mesociclo/semana/revisión y row_version. Son respuestas del formulario, nunca entitlement. Otra pestaña impide un guardado stale hasta actualizar. Una respuesta tardía no cambia la pantalla actual.
- La aceptación confirma nuevamente la revisión y relee el servidor antes de anunciar éxito. Los permisos revocados bloquean la aceptación visible y el backend vuelve a validarlos.
- `onAuthStateChange` solo destruye el host si desaparece/cambia la sesión; no autentica, vincula, borra ni modifica cuentas.
- Las excepciones de carga/montaje muestran un aviso persistente y reintento manual. Una anamnesis parcial no produce una excepción ni respuestas inventadas: solo se normaliza una estructura validada; una anamnesis marcada enviada cuya forma no es válida muestra un aviso y Actualizar estado.

## Límites actuales explícitos

El path nuevo adopta una rutina propia existente; no genera una rutina ni inventa programación cuando no hay una disponible. La duración inicial del seguimiento es 6 semanas. No hay pagos, Stripe, salud, chat continuo fuera de su alcance ni activación pública de Premium.

El home no inventa «3/4 entrenamientos»: el contrato actual no suministra un agregado de adherencia del mesociclo al host. Se muestran semana, revisión, check-in y última decisión reales; un `session_summary` seguro suministrado por un adapter real se muestra si existe.

No se ejecutan los adapters de demo phase1/analysis acoplados a endpoints locales. Se reutilizan los contratos/vocabularios/validadores existentes de intake y weekly, el componente chat vigente y las RPC/Edge existentes. La capa nueva es presentación/coordinación; no reimplementa reserva, cuotas, validación semántica ni aplicación de patches.

Documentación SDK consultada: [rpc](https://supabase.com/docs/reference/javascript/rpc), [getSession](https://supabase.com/docs/reference/javascript/auth-getsession). La consulta al índice changelog.md falló por content-type del lector web; no se adoptó una API nueva ni se instaló/actualizó el SDK.
