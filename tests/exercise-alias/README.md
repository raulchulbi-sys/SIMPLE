# Aliases de ejercicios confirmados — candidata local, sin publicar

La confirmación del propietario del 23/09/2026 permite seis equivalencias exactas del PUSH recreado. El registro único `confirmedHistoricalExerciseIds` en `index.html` contiene los pares antiguo → actual y exige el usuario y la rutina confirmados. No usa nombres, posiciones, cadenas de aliases ni equivalencias de rutinas.

`getPreviousExerciseSession` consulta primero el UUID solicitado y después sus aliases confirmados, en orden de fecha dentro de cada identidad, excluyendo hoy y el futuro. Rechaza UUID duplicados ambiguos. Devuelve el objeto histórico original para lectura, sin reescribir su identidad ni sus campos. Un UUID nuevo homónimo no tiene alias. Renombrar, reordenar o mover el UUID confirmado no rompe esta lectura.

Solo Última sesión utiliza el registro. La consulta del histórico y los gráficos siguen mostrando los snapshots y series de cada UUID original por separado. Los registros sin UUID permanecen como legacy separado: su nombre no demuestra que pertenezcan a un UUID nuevo. Notas, borradores, reapertura y escrituras de workouts no consultan aliases. Las notas modernas siguen siendo `exercise:<UUID>`; ninguna equivalencia migra una nota legacy.

No se necesita backend, tabla ni RPC nuevo para estos seis aliases. El RPC de aliases de días ya validado permanece independiente en `tests/cycle-alias`, y continúa siendo necesario para la futura publicación coordinada de identidad.

## Pruebas

Desde la raíz:

```powershell
node tests/exercise-alias/browser.cjs
node tests/identity/browser.cjs
node tests/identity/protected.cjs
node tests/session-edit/contracts.cjs
node tests/session-edit/regressions.cjs
```

`browser.cjs`: HTML completo, Chromium y WebKit, 390 y 1280 px. Comprueba cada pareja contra el UUID antiguo esperado y todos sus campos, las 16 series del 31/08, homónimos, cambio de nombre/orden/día, prioridad de UUID exacto, ámbitos, duplicados, fechas, gráficos separados, notas, borradores y reapertura. Todos los accesos de navegador se interceptan localmente; no escribe en Supabase.

Los scripts reutilizan Playwright y la fixture privada archivada en la auditoría local del 07/09. Las rutas están declaradas en los scripts; no constituyen una suite autónoma de CI. No copiar esa fixture al repositorio.

## Cambio explícito del contrato histórico

Las cinco expectativas que fallaban antes de confirmar los aliases se mantienen: A/B/D de `history-tests.cjs` y Última sesión con seis ejercicios de `test.cjs` a 1200 y 390 px. Deben pasar ahora por UUID confirmado; la nueva suite además cambia todos los nombres para demostrar que no se usan para asociar.

El archivo archivado `history-tests.cjs` se ejecutó sin cambiar expectativas. Tras la confirmación aparecen cinco incompatibilidades distintas: exigía rechazar una correspondencia al cambiar el nombre del día, añadir días/ejercicios homónimos o encontrar el día antiguo en la estructura. Eso contradice la continuidad explícita por UUID y movimiento entre días solicitada ahora. Su salida original se conserva en `results/archived-history-unchanged.json`; no se declara aprobada.

`history-contract.cjs` conserva las tres expectativas históricas pendientes y los demás controles aplicables. Sustituye expresamente esas cinco prohibiciones basadas en nombres/días por diez controles: cada contexto resuelve el alias confirmado y rechaza el UUID no confirmado. El runner general señala el nuevo archivo de manera visible. Pasa de 14 a 19 comprobaciones históricas; el total de regresiones pasa de 715 a 720. No hay sustituciones ocultas de aserciones en el hook.

Resultados, capturas, comparaciones de Supabase e informe completo: `results/`, excluido de Git. No publicar datos reales ni credenciales. No se creó ninguna fixture en staging para esta fase.

## Promoción posterior

No publicar automáticamente. Antes de una promoción autorizada, comprobar de nuevo el frontend/RPC publicados, conservar los rollbacks de días y publicar de forma coordinada la candidata frontend y el RPC de días. Las pruebas móviles son simulación de viewport, no dispositivos físicos. El registro cerrado requiere una nueva confirmación y revisión para añadir equivalencias; nunca inferirlas por nombre.
