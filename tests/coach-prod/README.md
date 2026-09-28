# SIMPLE Coach — preparación Fase 1C-PROD

Estado: **validación local/staging; promoción de producción pendiente**. No activar pilotos/reviewer ni publicar hasta resolver los dos puntos abiertos (triggers y clave propia).

Base aprobada `bfec455646ac8196a50af49135060d030b83c3ee`, conservada limpia. Worktree aislado `codex/coach-phase1c-prod`. Main remoto `fc555a82f1473310995909742b927a2e855d61d4`, árbol `bf7cf0cdd41dc039846080e6662f19b06c8fcf7b`, idéntico a la base publicada local `7cf24fa`. HTML público comprobado por HTTP 200 y SHA-256 `502149a3fe649d6736862309f62b90b701e296f62670e92b62c1bc230bd53713`.

## Alcance y puntos pendientes

- El paquete crea siete tablas Coach con RLS y SELECT propio; escrituras solo por RPC protegidas. No altera columnas, RLS, políticas, funciones existentes ni filas de SIMPLE.
- **Excepción estructural que requiere aclaración expresa:** la protección Coach validada incorpora `coach_guard_routines`, `coach_guard_days`, `coach_guard_exercises` a las tres tablas existentes. Solo bloquean la estructura de rutinas con fila en `routine_management`; las demás conservan sus operaciones. Se solicitó aclaración porque el encargo exige conservar esa protección y también dice no modificar tablas existentes. No se han aplicado en producción.
- Producción no tenía secrets personalizados al inicio. El usuario confirmó guardar una clave; la lectura exclusiva de nombres mostró `SIMPLE Production`, no `OPENAI_API_KEY`. Se solicitó corregir el campo **Name a OPENAI_API_KEY**, conservando la clave propia de producción en Value. Se dejó abierto `https://supabase.com/dashboard/project/yvguatdqncadkwewlepe/functions/secrets`. No se copió staging ni se leyó ningún valor.
- Reviewer propuesto: cuenta real de entrenador identificada en la consulta privada; UUID y perfil se presentan directamente al usuario, sin incorporarlos a la configuración pública. **Sin conceder permiso.** El permiso privado validado permite cola/contexto consentido de operaciones Coach, aprobar/rechazar con motivo, autorizar un reintento controlado de operaciones terminales, métricas agregadas y lectura de feedback. No concede acceso general a perfiles/entrenamientos, escritura de feedback ajeno ni administración. La autorización y caducidad deberán aprobarse antes de guardar su UUID.
- Pilotos: cero. Reviewer: cero. Ninguna cuenta real usada para pruebas. Las identidades de los tests SQL solo existen dentro de una transacción que termina con ROLLBACK; no se crean sesiones Auth ni se emiten correos.

## Diferencias necesarias respecto a 1C

1. Frontend reconoce exclusivamente staging y producción conocidos; el backend sigue decidiendo autorización por UUID. Sin cambios de CSS/diseño ni de Auth.
2. Edge admite exclusivamente el origen público de SIMPLE en producción; los localhost permanecen solo en staging. JWT obligatorio y revalidación de usuario conservados. Mismo GPT-5.4 `gpt-5.4-2026-03-05`, prompt `basic-initial-v2`, proveedor, contrato y gate.
3. `activated_at` opcional en configuración privada impide comenzar antes de la fecha configurada. Los futuros pilotos deben incluirla explícitamente; ausencia conserva el contrato anterior de staging.
4. `get_coach_review_queue` devuelve nombre/UUID del atleta únicamente para las operaciones cuyo contexto puede leer el reviewer. No expone una lista global de perfiles.
5. `get_my_coach_access.can_feedback` exige workout propio de rutina Coach aceptada. La UI muestra la acción solo entonces; la RPC de escritura conserva su validación independiente, unicidad y límites.
6. Copy solicitado para revisión/feedback y consentimiento explícito de IA/diagnóstico; versión `pilot-supervised-v1`, pendiente de aprobación y revisión legal final.

Los puntos 3–5 forman `20260928201819_coach_phase1c_production_readiness.sql`, aplicada y validada primero en SIMPLE Security Test. Solo reemplaza tres funciones Coach; mantiene SECURITY DEFINER, owner y ACL. Rollback exacto de esas tres definiciones en `supabase/rollback-coach-production-readiness.sql`.

Incidencia adicional detectada al activar el módulo sobre la URL de producción: WebKit podía intentar la siguiente consulta Coach desde un documento que estaba recargando. Se cierra la capacidad durante `beforeunload/pagehide`, se comprueba entre lecturas y se recupera si se cancela la navegación o se vuelve de bfcache. No se modifica Auth ni se invalida la operación si el usuario cancela la salida. La regresión conserva la recarga inmediata y no oculta errores. También se corrigió el doble HTTP de OAuth para reproducir CORS y respuestas booleanas reales; ese ajuste por sí solo no resolvía el fallo.

## Consentimiento exacto propuesto (sin usuarios activados)

**Consentimiento piloto · pendiente de revisión legal**

SIMPLE Coach utiliza inteligencia artificial. Enviaremos a OpenAI tu objetivo, experiencia, disponibilidad, material, preferencias y las molestias y limitaciones que autorices, para generar una propuesta de rutina. Una persona autorizada revisará esa información y la propuesta antes de que puedas aceptarla.

No enviamos a OpenAI datos de otros usuarios, tu nombre, correo, UUID, historial, notas personales ni datos administrativos. No incluyas información identificativa ni innecesaria en los campos libres. SIMPLE Coach no realiza diagnósticos médicos ni sustituye la atención médica.

Puedes retirar cualquiera de estos permisos desde Anamnesis y permisos. Se bloquearán nuevas generaciones y propuestas no aceptadas; tu rutina ya aceptada se conserva. No se borra retroactivamente una solicitud ya procesada.

Versión: pilot-supervised-v1. Pendiente de revisión legal final.

Casillas separadas, no premarcadas al primer acceso:

- Autorizo usar mi anamnesis con OpenAI y el reviewer autorizado para generar y revisar mi planificación.
- Autorizo usar las molestias y limitaciones que he declarado con OpenAI y el reviewer autorizado para esta propuesta.

## Paquete y secuencia de promoción

Migraciones, en orden:

1. `20260928144706_coach_phase1a_safe.sql`
2. `20260928151713_coach_intake_concurrency.sql`
3. `20260928152723_coach_fk_indexes.sql`
4. `20260928162443_coach_phase1b_generation.sql`
5. `20260928175723_coach_phase1b_prompt_v2.sql`
6. `20260928182139_coach_phase1c_supervised_pilot.sql`
7. `20260928183652_coach_phase1c_feedback_reviewer_read.sql`
8. `20260928184915_coach_phase1c_access_state.sql`
9. `20260928185145_coach_phase1c_feedback_rls_index.sql`
10. `20260928201819_coach_phase1c_production_readiness.sql`

Antes de aplicar: comprobar main y huellas actuales, ausencia de objetos Coach, autorización de triggers y clave propia. Aplicar por bloques 1A/1B/1C/readiness y comparar definiciones/owner/ACL con staging. No conceder permisos a personas. Desplegar los tres archivos de `simple-coach-mock`, `verify_jwt=true`; no tocar `simple-production-check-helper`.

Ejecutar el test SQL transaccional ya validado en staging, comparación de tablas/funciones originales, prueba gateway sin JWT, advisors y whitelist/reviewers vacíos. Es una prueba de permisos/SQL, **no un acceso real con JWT ni una generación real**. No es necesario gastar en OpenAI para publicar cerrado; la validación de credencial/modelo real quedará identificada como pendiente si no se hace una llamada autorizada.

Se ensayó además el paquete completo: rollback de schema vacío → las diez migraciones → comparación de las 45 funciones y owner/ACL → 44 pruebas SQL → ROLLBACK. Pasó sin persistir identidades, propuestas ni rutinas. Cuatro definiciones reconstruidas difieren de staging solo en CRLF/espacios: `reviewer_config`, `accept_basic_plan`, `reserve_basic_generation`, `set_my_coach_context_permission`. Se inspeccionaron las diferencias; la comparación sin espacios coincide en las 45 funciones y el paquete fue validado después contra sus hashes exactos, conservados en evidencia privada. No se cambiaron los SQL aprobados para disimular esas diferencias.

Solo después publicar el árbol candidato preservando main mediante conector GitHub, verificar Pages y hashes de assets. Cualquier conflicto inesperado: parar. No dar por hecho que un mock prueba Google/email reales; se conservan las pruebas históricas y se describen las nuevas regresiones interceptadas como tales.

## Activación posterior (NO ejecutada)

Después de aprobar consentimiento + reviewer + 3–5 adultos por UUID, actualizar únicamente `coach_private.pilot_config()` con un mapa privado; preservar otras entradas aprobadas. Ejemplo de una entrada conceptual:

```json
{
  "UUID_APROBADO": {
    "enabled": true,
    "adult_confirmed": true,
    "activated_at": "FECHA_ISO_APROBADA",
    "expires_at": "FECHA_ISO_APROBADA"
  }
}
```

`enabled` es el estado administrativo. Generación disponible = un primer intento cuando está activo, adulto, dentro de fechas y no hay operación previa; se consume en servidor. Otro intento exige la autorización explícita y registrada del reviewer, no cambiar un contador en frontend. Para impedir el acceso, `enabled=false`; no eliminar `routine_management`, rutinas aceptadas, snapshots, notas ni workouts. Ningún cliente puede ejecutar o escribir las funciones de configuración.

## Rollback

`supabase/rollback-coach-production.sql` compone reversión exacta readiness → 1C → prompt-v2 → 1B → 1A. **Rechaza cualquier fila en cualquiera de las siete tablas**, incluso borradores o grants. Probado dentro de transacción en staging y revertido; también probado el rechazo con evidencia presente. No ejecutar fuera de una transacción de comprobación sin autorización de retirada y verificación de ausencia de datos.

`git diff --check` señala una línea vacía con un espacio en ese rollback compuesto: pertenece al cuerpo de función copiado del rollback validado de 1C, conservado literalmente. No es un artefacto ni una diferencia funcional.

Con datos reales: desactivar nuevas entradas/generaciones, conservar schema/filas/rutinas/evidencias; restaurar frontend compatible si procede y corregir hacia delante. No borrar rutinas aceptadas. La Edge anterior de producción no se reemplaza: Coach es otra función.

## Evidencias y limitaciones

`private/production-before.json` contiene definiciones y huellas iniciales, no entra en Git. `results/` contiene capturas y resultados, tampoco entra en Git. `package.cjs` prepara hashes/rollback; `transaction.mjs` prepara SQL sintético rollback-only; `browser.cjs` usa demo aislada sin red; `edge.cjs` prueba entorno/CORS/Auth con proveedor bloqueado; `public-snapshot.cjs` solo lee HTML público y comprueba 401 de staging.

Preview navegable: **http://127.0.0.1:4195/review**. Capturas de demostración ficticia, no de un piloto real. Staging Edge v20, SHA-256 de bundle `c5ff4e1e7dbcd53b4a958c6ead3d04bf9494def2db15c3cca3182c63555a7a1e`.

Advisors mantienen los avisos previos: RPC autenticadas SECURITY DEFINER con guardas internas y permisos negativos probados; protección de contraseñas filtradas desactivada (Auth no modificado); índices sin uso. No hay nueva alerta de tablas sin RLS. Referencias: [RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Coste nuevo OpenAI: **0 USD; cero llamadas**. Los resultados históricos de 1C (1.228) no se suman como pruebas nuevas.

## Resultado final de esta preparación

**862/862 comprobaciones finales**, sin sumar reintentos, diagnóstico reducido, verificaciones de integridad ni reconstrucción/rollback adicional:

| Suite | Superadas |
|---|---:|
| Onboarding | 276 |
| Recuperación: feedback / SDK | 72 / 28 |
| OAuth SDK / botón Google | 96 / 32 |
| Edición de sesión / progreso-ciclo | 40 / 15 |
| Contrato/proveedor Coach | 62 |
| Interfaz de esta fase, ambos motores | 46 |
| Edge: destinos, CORS y autenticación | 11 |
| Visibilidad cerrada / conservación de rutina aceptada | 10 |
| SQL transaccional de permisos y recorrido Coach | 44 |
| Duración / entrada de duración | 30 / 8 |
| Borradores / concurrencia / navegación-historial | 7 / 33 / 26 |
| Modos / ausencia de flash | 16 / 10 |

La primera ejecución OAuth falló en WebKit; corregir el simulador CORS no bastó. Se reprodujo el fallo al recargar inmediatamente, se corrigió exclusivamente el ciclo de vida del módulo Coach y se repitió la suite completa afectada: 96/96. La nueva prueba también confirma que cancelar la salida conserva el epoch de la operación y que volver desde bfcache reactiva el módulo. No se filtraron los errores ni se añadió espera al recorrido de recarga para ocultarlos.

Producción, verificación de solo lectura: nueve tablas/datos, diecisiete funciones existentes, columnas/políticas/constraints/índices/triggers, usuarios/identidades Auth y Edge anterior idénticos al inicio. RPC ciclo `88c3564c3c49cf9c53fccba89a1e71b5`. El secret añadido manualmente por el usuario se trata por separado y su nombre todavía necesita corrección. **No hay commit nuevo publicado ni migraciones Coach aplicadas en producción.**
