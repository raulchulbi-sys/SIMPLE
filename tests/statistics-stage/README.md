# Reinicio de estadísticas por cliente y rutina

Una nueva etapa conserva UUID, rutina, asignación, notas y workouts. Solo gráficas, conteo de sesiones, Última sesión y ciclo toman registros guardados desde el instante del reinicio (workouts.created_at). El historial completo sigue disponible. La comparación temporal mantiene los microsegundos de Postgres y normaliza offsets, evitando incluir por redondeo una sesión anterior al reinicio. No se reescriben ni borran sesiones, no se mezclan clientes y no se modifican aliases.

El entrenador asignado puede iniciar una etapa desde Mis clientes → Ver progreso → Reiniciar estadísticas. Una confirmación explica el alcance. El timestamp se fija en servidor, no en el navegador. La operación usa request_id para idempotencia, expected_stage para rechazar pestañas antiguas y advisory lock por cliente/rutina. Una respuesta de escritura se relee antes de mostrar éxito. La reanudación tras un fallo requiere volver a abrir progreso; no hay reintento automático.

La tabla client_routine_statistics_stages tiene RLS y ningún acceso directo para anon/authenticated/service_role. Tres RPC nuevos autorizan lecturas propias/asignadas y escritura solo del entrenador asignado a un client. Los permisos existentes y Auth no se modifican. Las rutinas Coach con mesociclo activo no admiten este reinicio genérico. Los avisos de seguridad de funciones SECURITY DEFINER públicas y RLS sin policy son esperables: acceso exclusivamente vía RPC con comprobaciones internas, tabla inaccesible directamente; no se añaden policies para ocultar el aviso.

El RPC de ciclo publicado conserva el hash 88c3564c3c49cf9c53fccba89a1e71b5. Sin reinicio se utiliza el RPC original; con etapa se utiliza una copia del cálculo con el filtro temporal, conservando las reglas de UUID/aliases/ciclo actual y fecha Europe/Madrid.

Pruebas: backend.sql transaccional sobre cuentas sintéticas existentes de staging (23 comprobaciones; claims controladas SQL, no JWT firmados); unit.cjs (20); contracts.cjs (15, paginación/medianoche); identity.cjs (30, captura histórica privada original). browser.cjs utiliza la aplicación real con SDK offline, Chromium/WebKit, Claro/Oscuro y 320/390/1280 (180). Total: 268 comprobaciones únicas, sin sumar reejecuciones. No es una prueba autenticada nueva de producción. Rollback verificado en transacción.

Preview aislada: node tests/statistics-stage/preview.cjs → http://127.0.0.1:4258/?role=trainer
Resultados y capturas: results/ ignorados. Capturas y fixtures no forman parte del commit.

Rollback: publicar el frontend anterior primero, después rollback.sql. Solo retira la metadata de etapas y los tres RPC añadidos; entrenamientos y notas siguen intactos. El rollback elimina el registro de reinicios y vuelve a mostrar la estadística histórica, por lo que debe preservarse esa metadata previamente si ya se han utilizado etapas reales.

Preparación de producción: Guilleblb67, rutina PPL-UL / XTV, 19 workouts, 61 notas, 31 ejercicios y 1 asignación. Antes de activar el reinicio, verificar de nuevo el alcance y las huellas. Ningún otro cliente se reinicia automáticamente. No hace llamadas a OpenAI.
