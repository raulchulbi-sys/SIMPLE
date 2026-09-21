# Validación de la edición de sesiones

Entorno: Windows, Node y Playwright del runtime de Codex. Los scripts reutilizan los archivos históricos revisados del directorio de auditoría indicado en `AGENTS.md`; no copian ese directorio al repositorio.

- `reproduce.cjs`: reproduce el payload completo después de alterar el orden en la versión original. Su resultado original está en `results/reproduction.json`.
- `prepare.cjs`: prepara una fixture con identidades aleatorias y su limpieza. Rechaza sobrescribir un manifiesto existente. No ejecuta SQL ni sobrescribe los cuerpos revisados del RPC.
- `staging.sql`: cuerpo de `save_routine_atomic` validado en `dmqjexigdnfzobarhnib`, que debe promoverse junto con el HTML; no modifica esquema ni permisos. `rollback.sql` conserva el cuerpo anterior.
- `rollback.sql`: cuerpo anterior de ese RPC.
- El RPC candidato rechaza guardados completos sin versión del frontend antiguo; esas pestañas deben recargar. Mantiene el contrato anterior de parches por campo.
- `live.cjs`: navegador con SDK real, JWT reales y lecturas REST de registros completos. Solo permite el host de staging. `private/rest.json` contiene las credenciales temporales y está excluido de Git.
- `node tests/session-edit/live.cjs --trainer-focused`: recorrido visible del entrenador en Chromium/WebKit, a 390×844 con entrada táctil y a 1440×1000. Comprueba series de un ejercicio existente, varios campos, navegación, reapertura, recarga, otra pestaña, doble clic con respuesta RPC retenida y una lectura real antigua retenida mientras otra pestaña guarda. Registra payload, respuesta, filas completas y resultados en `results/trainer-focused-*`, separados de la ejecución general. Usa una fixture nueva preparada con `prepare.cjs`; revoca sus sesiones al finalizar. Ejecutar después su limpieza SQL y comprobar integridad antes de eliminar las credenciales temporales.
- `node tests/session-edit/live.cjs --session-display`: guarda descansos de 210, 60 y 0 segundos para «Aperturas» y abre la propia sesión mediante «Entrenar». Comprueba el texto visible exacto, series, objetivo y RIR, luego recarga y abre desde otra página, conservando borradores. Matriz Chromium/WebKit móvil/escritorio, con filas completas leídas directamente de Supabase. Los resultados y capturas quedan en `results/session-display-*` y `results/*-session-rest-*.png`. El mismo test contra la candidata anterior reproduce el descanso fijo `2-3'`; no se cambia la expectativa para aceptar ese valor antiguo.
- `contracts.cjs`: pruebas locales de respuestas falsas/incompletas, verificación fallida, valores vacíos, entradas inválidas e identidad estable.
- `regressions.cjs`: ejecuta las 15 suites anteriores y las 50 pruebas adicionales de la revisión 26 contra el `index.html` actual.
- `legacy-rest.cjs`: ejecuta las 32 pruebas REST/navegador anteriores usando la fixture de esta revisión. Requiere restablecer primero sus valores iniciales y eliminar el workout sintético anterior.
- `cleanup.sql`: elimina solo los datos y usuarios sintéticos identificados por esta fixture, después de revocar sus sesiones.

Adaptaciones de pruebas históricas (no cambios de producto):

1. La comparación negativa del historial usa `index_cliente_editor_final_v25.html`. El archivo del Escritorio que utilizaba el script original ya había sido sustituido por una versión corregida.
2. La prueba de gráficas usa los nombres y fechas que admite la versión publicada. El script archivado esperaba selectores `id:E` y objetos de sesión de una variante no publicada. Se comprobó que fallaba también contra el `HEAD` original. No se retomó la migración de identidad de gráficas pendiente de otra tarea.
3. Se conservan las adaptaciones de mocks de duración que ya utilizaba la revisión 26.
4. Las pruebas nuevas usan un origen HTTPS, necesario para `crypto.randomUUID`, y esperan el renderizado de Mis rutinas antes de pulsar Abrir.

Los resultados de intentos fallidos no se cuentan como aprobados. Los informes finales corresponden a ejecuciones nuevas. Las comparaciones antes/después y las peticiones registradas solo contienen datos sintéticos.
