# Identidad de ejercicios y días — candidato local

No implementar duplicaciones ni publicar sin autorización. El informe de esta fase original está en `results/INFORME-IDENTIDAD.md`. Actualización: los aliases de día confirmados y validados están en `../cycle-alias`; las seis equivalencias de ejercicio confirmadas posteriormente están en `../exercise-alias`. Esos informes posteriores prevalecen sobre los bloqueos históricos de esta fase.

Producto: únicamente `index.html`. Selectores y puntos de gráficas usan UUID; los históricos huérfanos siguen consultables por su propia identidad. Última sesión y reapertura no atribuyen ejecuciones a un UUID nuevo por coincidencia de nombre. Las notas personales nuevas usan `exercise:<UUID>` dentro del usuario y rutina actuales, sin propagarlas a rutinas relacionadas. El esquema y los permisos existentes permiten esa clave.

Legacy: se preservan las filas antiguas. Una clave de nombre solo se considera segura si hay una única identidad entre la estructura actual y los históricos y evidencia de la nota vinculada a ese UUID. La recuperación exacta por UUID tiene prioridad. Un vacío moderno es intencional. Las notas registradas en un histórico conservan su valor, incluido el vacío.

Las cinco expectativas pendientes de Última sesión se vuelven a comprobar tras la confirmación expresa de los seis aliases, sin recuperar asociación por nombre. El archivo archivado original y su salida se conservan. El cambio posterior de contrato para casos de nombres/días está explicado expresamente en `../exercise-alias/README.md`; no deben confundirse esos casos con las cinco expectativas inicialmente pendientes.

## Ejecución

Desde la raíz del repositorio, con Node y Playwright instalados:

```powershell
node tests/identity/browser.cjs
node tests/identity/protected.cjs
node tests/session-edit/contracts.cjs
node tests/session-edit/regressions.cjs
```

`browser.cjs` ejecuta el HTML completo con datos sintéticos en Chromium y WebKit, 390 y 1280 px. `regression-hook.cjs` incorpora a los harnesses antiguos las funciones auxiliares extraídas del mismo HTML y conserva las claves de gráfica por UUID. El runner general usa explícitamente el contrato histórico versionado en `../exercise-alias/history-contract.cjs`.

Los scripts reutilizan el runtime Playwright y los harnesses de la auditoría local del 07/09/2026. Sus rutas están declaradas al principio de cada script; el informe privado registra las dependencias exactas. No son una suite autónoma de CI.

## Staging autenticado

`prepare.cjs` genera identidades aleatorias y SQL en `private/`; no ejecuta SQL. Revisar y aplicar la semilla exclusivamente a SIMPLE Security Test. `live.cjs` contiene una guarda de proyecto y aborta las solicitudes del navegador fuera del staging declarado. Prueba notas homónimas, dos pestañas, renombrado/reordenación, vacíos, recarga sin notas locales, respuestas lentas, guardado de sesión y lectura autorizada por el entrenador. Contrasta cada escritura con REST y registra únicamente payloads sintéticos, sin cabeceras ni tokens.

Después: verificar las filas directamente por SQL, revocar todas las sesiones de las cuentas sintéticas, aplicar `private/cleanup.sql`, comprobar residuos cero y comparar las huellas de las filas previas. Eliminar `private/rest.json` y `private/seed.sql`. Conservar el manifiesto sin contraseñas en resultados para poder auditar la limpieza.

`cycle-simulation.sql` es solo lectura. Compara ambas reglas de resolución sobre los historiales existentes, conservando el orden por fecha/creación/UUID y la lógica de reinicio/completado del RPC. No altera funciones, permisos ni filas.

## Exclusiones

No versionar `private/`, `results/`, capturas ni datos forenses. No copiar el directorio histórico completo a Git. El RPC y rollback anteriores se conservan en la auditoría original; no se aplicaron cambios backend en esta fase.
