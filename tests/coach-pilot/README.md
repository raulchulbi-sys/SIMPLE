# SIMPLE Coach — Fase 1C, piloto cerrado supervisado

Implementado y validado exclusivamente en **SIMPLE Security Test** (`dmqjexigdnfzobarhnib`). Sin publicación, merge a main, usuarios reales, cobros, Premium, chat, adaptación automática, nutrición ni Coaching 1:1.

Base aprobada: `a83a2ec` (Fase 1B), conservada limpia en su worktree. Rama nueva: `codex/coach-phase1c`. Producción permanece en `fc555a82f1473310995909742b927a2e855d61d4`; su árbol `bf7cf0cdd41dc039846080e6662f19b06c8fcf7b` coincide exactamente con la base local publicada `7cf24fa`. `origin/main` local estaba atrasado: se comprobó el ref y árbol vigentes con el conector GitHub, sin modificar main.

## Recorrido y permisos

- Solo un UUID con `enabled=true`, `adult_confirmed=true` y `expires_at` futura en `coach_private.pilot_config()` puede iniciar el piloto. Se verifica además que sea cliente, pero el rol **no concede acceso**. Configuración privada sin USAGE/EXECUTE para clientes ni escritura pública. Una generación consume el intento incluso si queda bloqueada o falla; un nuevo intento requiere aprobación explícita del reviewer, con UUID, fecha, motivo y enlace único al intento anterior. Se conserva también el límite anterior de cinco reservas/hora.
- El inicio oculta la entrada Coach a usuarios no autorizados, salvo que ya tengan una rutina Coach aceptada. Revocar/expirar no elimina ni oculta esa rutina, historial o notas.
- Anamnesis corta, borrador versionado, volver/editar y resumen **antes** de enviar. Dos consentimientos explícitos; no basta con abrir el diálogo. Sin datos reales en esta fase técnica.
- La Edge sigue usando el contrato/prompt/proveedor de 1B sin alterarlos: **GPT-5.4 `gpt-5.4-2026-03-05`, `basic-initial-v2`, schema 1**. Solo se restringió la configuración al modelo aprobado y se cambió el origen local permitido a 4194. JWT obligatorio; no se leyó ni copió OPENAI_API_KEY. Sin reasoning guardado.
- Gate de seguridad intacto. `failed + safety_review_required` equivale a bloqueo que requiere revisión; no llama al proveedor. Autorizar otro intento nunca omite ese gate.
- Una propuesta válida queda `pending_review`. La aceptación RPC exige `ready` y, cuando corresponde, decisión `approved`. Cliente, trainer normal y anon no pueden aprobar ni editar la propuesta.
- `coach_private.reviewer_config()` autoriza reviewers por UUID y caducidad, independientemente del rol. La pantalla se monta únicamente tras comprobar la capacidad en servidor; todas las RPC vuelven a comprobarla. No hay email público ni admin global. No se permite revisión propia.
- Reviewer: anamnesis consentida, propuesta completa, duración orientativa, series/reps/RIR/descanso, volumen y frecuencia por ejercicio. Aprueba o rechaza con motivo obligatorio; no tiene editor de estructura. La persona debe revisar también distribución muscular y recuperación, no limitarse a los totales mostrados.
- La revisión humana se configura centralmente con `coach_private.review_required()`, actualmente **true**. Su valor se copia a cada operación; cambiarlo no aprueba retrospectivamente propuestas pendientes. No desactivarlo durante este piloto.
- El atleta revisa la propuesta aprobada y acepta o la rechaza con comentario. Aceptación atómica/idempotente: una rutina, una revisión inmutable, UUID propios. Sin assignment ficticio. Se conservan los bloqueos estructurales de Coach y el entrenamiento existente.
- Loading: **«Estamos preparando tu rutina…»**. Se puede cerrar/recargar; se consulta la operación existente, sin nueva petición de IA. No porcentajes ni ETA inventados.

## Consentimiento piloto — pendiente de revisión legal

Versión registrada en `context_grants`: **pilot-supervised-v1**. Texto del componente:

> Usaremos tu objetivo, experiencia, disponibilidad, material, preferencias y las limitaciones que declares para generar tu planificación con OpenAI y revisarla con una persona autorizada.
>
> No enviamos a OpenAI tu nombre, correo, UUID, historial, notas personales ni datos administrativos. No incluyas datos identificativos en los campos libres. SIMPLE Coach no sustituye atención médica.
>
> Puedes retirar cualquiera de estos permisos desde Anamnesis y permisos. Se bloquearán nuevas generaciones y propuestas no aceptadas; tu rutina ya aceptada se conserva. No se borra retroactivamente una solicitud ya procesada.

Checkboxes separados para anamnesis y molestias/limitaciones. El backend exige ambos grants de la versión actual. Revocar invalida reservas/propuestas no aceptadas y elimina su contexto de la cola del reviewer. No es un borrado retroactivo del proveedor ni de evidencias del piloto. El aviso pide no introducir PII en texto libre; la detección automática de patrones no garantiza detectar toda información identificativa. **Revisión legal, retención de datos y selección de adultos siguen pendientes antes de personas reales.**

## DB y RLS

Se reutilizan las seis tablas de 1A/1B; la revisión y autorización de reintento se registran en `coach_operations`, sin otra tabla administrativa. Se añaden estados `pending_review`, `rejected`, `athlete_declined` y metadatos de decisión, reintento y comentario. El frontend no puede escribir las tablas Coach directamente.

Única tabla nueva, autorizada expresamente: **coach_pilot_feedback**. Exactamente siete columnas: `id`, `user_id`, `routine_id`, `rating`, `comment`, `created_at`, `updated_at`.

- FK a `auth.users`, `routines` y propiedad compuesta en `routine_management`.
- `CHECK rating BETWEEN 1 AND 5`; comentario opcional de hasta 1.000 caracteres.
- `UNIQUE(user_id,routine_id)`: segundo envío actualiza el mismo registro; no hay borrado desde el cliente.
- RLS SELECT propietario o reviewer privado activo. Otro cliente, trainer normal y anon no ven feedback ajeno.
- INSERT/UPDATE/DELETE directos revocados. `save_my_coach_feedback` exige cliente propietario de rutina aceptada y al menos un workout propio cuyo `data.routine_id` coincide, todo comprobado en servidor. El reviewer no tiene permiso especial de escritura.
- La lectura autorizada del feedback es independiente del permiso de contexto de anamnesis; no reutiliza grants/workouts para almacenar valoraciones.

Migraciones, en orden, posteriores a las ya aprobadas de 1A/1B:

1. `20260928182139_coach_phase1c_supervised_pilot.sql`: operaciones, consentimientos, acceso, reviewer, feedback y RPC.
2. `20260928183652_coach_phase1c_feedback_reviewer_read.sql`: lectura restringida del feedback.
3. `20260928184915_coach_phase1c_access_state.sql`: capacidad de generación refleja un reintento autorizado.
4. `20260928185145_coach_phase1c_feedback_rls_index.sql`: RLS SELECT consolidada e índice de FK compuesta.

Nuevas RPC autenticadas: `get_coach_reviewer_access`, `get_coach_review_queue`, `get_coach_pilot_metrics`, `review_coach_proposal`, `authorize_coach_retry`, `decline_my_coach_proposal`, `save_my_coach_feedback`. Owner postgres, SECURITY DEFINER y search_path fijado; autorizaciones explícitas dentro de cada función. Backend claim/finish siguen siendo solo service_role. Las funciones/RLS originales de entrenamiento no cambian.

Nota de revisión Git: los SQL copian cuerpos de `pg_get_functiondef` para conservar la restauración exacta de 1B. `git diff --check` señala dos líneas en blanco con un espacio heredado dentro de `reserve_basic_generation` (migración y rollback). Se conservaron deliberadamente; no son archivos temporales ni cambios de comportamiento.

Asesor de seguridad: avisos intencionales de RPC SECURITY DEFINER autenticadas (incluidas las siete nuevas), con permisos negativos probados; permanece el aviso previo de protección de contraseñas filtradas desactivada. No se cambió Auth. [Aviso RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) y [contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). El asesor de rendimiento final solo indica índices todavía sin uso; se resolvieron el índice de FK compuesta y las dos políticas permisivas redundantes.

## Pruebas finales: 1.228/1.228

No incluye logins auxiliares del harness, reintentos de suites, resultados históricos de 1B ni comprobaciones adicionales de hashes/rollback/capturas.

| Suite | Comprobaciones |
|---|---:|
| Acceso, consentimiento, reservas y gate real con JWT | 80 |
| Reviewer, rechazo, aprobación, reintento y revocación | 22 |
| Dos generaciones reales de OpenAI | 14 |
| Reviewer y aceptación real, Chromium/WebKit | 46 |
| Entrenamiento real de rutinas sintéticas aceptadas | 62 |
| Feedback antes del primer workout | 1 |
| Feedback JWT final: propietario/otro/trainer/reviewer/anon | 23 |
| Formulario, UX, recarga y feedback, ambos motores | 50 |
| Visibilidad cerrada y conservación tras revocar | 10 |
| Aislamiento seis tablas, RPC backend y estructura | 149 |
| Expiración, adulto confirmado y revocación reviewer | 12 |
| Aserciones SQL transaccionales de permisos/recibo/modelo | 8 |
| Onboarding | 276 |
| Recuperación: feedback / SDK | 72 / 28 |
| OAuth SDK / botón Google | 96 / 32 |
| Contrato edición / progreso-ciclo | 40 / 15 |
| Contrato/proveedor Coach | 62 |
| Duración / entrada de duración | 30 / 8 |
| Borradores / concurrencia / navegación-historial | 7 / 33 / 26 |
| Modos de entrenamiento / ausencia de flash | 16 / 10 |

JWT reales emitidos para 11 identidades exclusivamente sintéticas. Dos solicitudes reales a OpenAI: caso normal y prompt injection. Ambas llegaron a pending_review, fueron aprobadas por el reviewer sintético mediante UI, aceptadas por el atleta y comparadas campo a campo contra Supabase. No se presentan las otras propuestas SQL de infraestructura ni la preview como generación real.

Repetir la petición de una operación completada no añadió consumo. Caso de dolor intenso bloqueado sin llamada al proveedor. La llegada tardía de un finish no alteró el recibo aceptado. Doble aceptación y dos pestañas no duplicaron rutina ni operaciones. Revocar consentimiento/expirar el piloto conservó las rutinas aceptadas.

Entrenamiento: checks, descanso de la prescripción, duración, notas, borradores por UUID, recarga, historial, Última sesión, gráficas y ciclo. Pruebas de duración/navegación/concurrencia existentes reejecutadas. Móvil 320/360/390/430 y escritorio 1280, claro/oscuro, Chromium + WebKit. Las regresiones de Auth/OAuth usan respuestas interceptadas; no se enviaron correos ni se probaron accesos reales de personas.

Incidencias resueltas: bloqueo global de clics interfería al volver rápido al formulario (Coach mantiene su propio busy/idempotencia); receptor inmediato de generación esperaba todavía ready en lugar de pending_review; estado busy debía reiniciarse al cambiar de pantalla. La expectativa de feedback entre motores se corrigió para leer el valor persistido que el motor anterior había actualizado. Cuatro suites no arrancaron inicialmente por faltar el SDK cacheado; se reutilizó la copia 2.115.0 verificada y pasaron. No se suman esos intentos fallidos.

## Coste y límites

Dos llamadas reales, **0,04858 USD estimados en total**, media **0,02429 USD**, 3.064 tokens de entrada y 2.728 de salida; latencia media **16,66 s**. Solo uso devuelto y tarifa del contrato, no conciliación de una factura. Para 3–5 generaciones iniciales, extrapolación de esta muestra ≈ **0,073–0,121 USD**, sin regeneraciones ni otros gastos. La evaluación de calidad de nueve casos de 1B se conserva como evidencia anterior; no se repitió innecesariamente.

El gate es deliberadamente restrictivo y el catálogo limitado. La interfaz de revisión ayuda a comprobar el plan, pero no garantiza idoneidad individual ni sustituye a un profesional. Las duraciones son estimaciones; `users_started_routine` mide un workout guardado, no la apertura de una pantalla. La whitelist JSON es deliberadamente manual para 3–5 usuarios; no se añadió un sistema de administración masiva. No hay acceso automático por compra ni suscripción.

## Preview y reproducción

`node tests/coach-pilot/preview.cjs` → **http://127.0.0.1:4194/review**.

Demo claramente ficticia, CSP sin conexiones. Completar formulario → consentimientos → revisar → enviar → pending review → botón superior **Simular reviewer** → aprobar/rechazar → **Ver atleta** → abrir Basic → aceptar. Incluye navegación a entrenamiento y feedback. Se reinicia al recargar. `/` apunta a staging y requiere sesión; después de limpiar no hay pilotos/reviewers activos.

Capturas y evidencias en `tests/coach-pilot/results/`, ignoradas por Git. Selección final: `final-intake-mobile.png`, `final-pending-mobile.png`, `final-reviewer-desktop.png`, `final-approved-dark.png`. Los recibos reales y las capturas con JWT son evidencias distintas de estas capturas de demostración.

Reproducción técnica supervisada, nunca ejecutar contra producción:

1. Aplicar migraciones en staging; preparar `prepare.cjs` y revisar/aplicar su `private/seed.sql` mediante conector. Credenciales aleatorias sintéticas, sin emails enviados.
2. `security.cjs`, `real-generation.cjs` (máximo dos intentos del harness; no repetir automáticamente si ya se intentó), `finish-fixtures.cjs` → aplicar SQL privado etiquetado como fixture → `review-security.cjs`.
3. `review-browser.cjs`, `feedback-security.cjs --before`, `training-browser.cjs`, `feedback-security.cjs`, `ui.cjs`, `isolation.cjs`. La prueba de recarga requiere ampliar explícitamente el vencimiento de la reserva sintética owner; no ampliar reservas reales.
4. Expirar/desactivar únicamente UUID del manifiesto y ejecutar `expiry.cjs`. Restaurar solo el reviewer sintético para probar la política final del feedback. `backend-checks.cjs` prepara aserciones transaccionales para ejecutar mediante conector y terminar con ROLLBACK.
5. `regressions.cjs` y `training-regressions.cjs`; los segundos reutilizan harnesses archivados y su adaptador vigente. SDK y navegadores cacheados son dependencias locales de pruebas, no de aplicación.
6. `cleanup.cjs` → revisar/aplicar SQL privado; comprobar huellas. Probar rollback solo dentro de transacción con restauración exacta y terminar con ROLLBACK. `visibility.cjs`, `capture-preview.cjs` no necesitan usuarios remotos.

## Limpieza y rollback

Eliminados por manifiesto exacto: 11 usuarios sintéticos, dos rutinas aceptadas y una rutina sintética de control, cuatro workouts, notas, ocho operaciones y un feedback. Siete tablas Coach vacías; pilot_config y reviewer_config `{}`; revisión humana true. Las nueve tablas originales de staging recuperaron recuentos y huellas iniciales. Se mantienen únicamente schema/RPC/Edge aprobados de staging y la clave que el usuario ya había configurado.

`supabase/rollback-coach-phase1c.sql` revierte a 1B y elimina feedback/columnas/RPC nuevas. **Rechaza ejecutarse si hay operaciones, feedback o consentimiento 1C**, para no borrar evidencia ni rutinas aceptadas. Se comprobó el rechazo con fixtures presentes; después de limpiar, se ejecutó dentro de una transacción, verificando exactamente las nueve funciones restauradas y la retirada de tabla/columnas. La transacción se deshizo; staging sigue en 1C. El rollback completo de infraestructura también requiere restaurar la Edge de `a83a2ec` y su frontend 1B; no se hizo esa degradación fuera de la prueba transaccional.

Con personas reales, rollback operativo preferido: desactivar acceso a nuevas generaciones/reviewers en configuración privada **sin borrar tablas ni rutinas**, mantener acceso a entrenamiento y corregir hacia delante. Cualquier retirada de esquema con evidencias reales necesitaría un plan específico de preservación y autorización, no ejecutar el rollback destructivo cambiando su guarda.

Producción: nueve tablas, esquema/funciones/policies idénticos antes/después; RPC ciclo **88c3564c3c49cf9c53fccba89a1e71b5**. No llamadas de escritura a producción, Auth/OAuth/SMTP intactos. Fase 1B y worktree original conservados; ningún secret, JWT, manifiesto, screenshot o resultado bruto forma parte del candidato.

## Propuesta FASE 1C-PROD — requiere autorización separada

1. Aprobar estas migraciones/RLS/reviewer/feedback/rollback y revisar jurídicamente el consentimiento, información del proveedor y retención. La copia actual está marcada como borrador.
2. Identificar expresamente los UUID de 3–5 adultos y de la persona revisora. Alternativa elegida: lista privada por UUID; no dar privilegios por ser trainer. Confirmar mayoría de edad y caducidad antes de activar cada UUID. No habilitar automáticamente cuentas actuales ni patatasimple.
3. Preparar revisión exacta del paquete 1A+1B+1C respecto a producción, backup/huellas y plan operacional de reversión. Confirmar ausencia de cambios publicados posteriores. Mantener whitelist/reviewers vacíos durante la promoción.
4. Tras autorización, aplicar solo las migraciones aprobadas; instalar secret en backend por canal seguro, conservar modelo/prompt/schema y JWT. Sustituir las guardas estrictamente staging de Edge/frontend por el proyecto productivo autorizado y origen `https://raulchulbi-sys.github.io`; no tocar Auth, SMTP ni otros proveedores. Esta habilitación **todavía no está implementada ni aplicada**.
5. Publicar frontend coordinado y activar exclusivamente UUID aprobados con expiración. Un primer adulto autorizado completa consentimiento y generación; reviewer realiza revisión humana real antes de aceptar. Verificar rutina y persistencia antes de ampliar a los demás.
6. Revisar métricas, coste/latencia/errores/feedback. Sin pagos, Premium, chat o adaptación. Detener nuevas generaciones mediante whitelist ante incidencias, preservando rutinas aceptadas.

No avanzar a 1C-PROD con la aprobación técnica de staging solamente.
