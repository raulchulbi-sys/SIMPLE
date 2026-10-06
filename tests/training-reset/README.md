# Reinicio destructivo y consulta de sesiones

El botón del entrenador asignado elimina definitivamente los workouts y las notas personales del cliente seleccionado, exclusivamente en esa rutina. Una confirmación explica que no se puede deshacer. Permanecen la rutina, los días, los UUID de ejercicios, el orden, series, objetivo, RIR, descanso y asignación. Las instrucciones compartidas de la estructura no se borran, porque afectaría a otros clientes; tras un reinicio no se copian como notas personales del atleta.

## Backend y protección de pestañas antiguas

La migración `20261006163532_client_routine_training_reset.sql` añade `history_cleared` a las etapas y una referencia nullable de etapa en notas. Un RPC separado, `reset_client_routine_training_history`, realiza el borrado y crea la etapa en una transacción. Requiere entrenador, cliente y asignación activos; rechaza rutinas Coach gestionadas con mesociclo activo. La idempotencia por request_id impide borrar entrenamientos nuevos al repetir una solicitud ya ejecutada. expected_stage rechaza otro reinicio concurrente.

Dos triggers comparten el lock del reinicio con las escrituras de workouts/notas. Tras un borrado exigen la identidad del último reinicio destructivo capturada al abrir el entrenamiento. Una pestaña antigua no puede restaurar registros eliminados. Un reinicio legacy posterior no elimina esta protección. Sin borrado previo se conservan los payloads originales.

El frontend relee la etapa antes de anunciar éxito. Al abrir un entrenamiento relee el servidor, elimina únicamente cachés/borradores antiguos de ese cliente/rutina y usa claves locales por reinicio. Los nuevos borradores siguen funcionando. El RPC legacy `reset_client_routine_statistics` conserva su comportamiento no destructivo: un frontend antiguo con una confirmación que prometía conservar datos no puede empezar a borrarlos.

No se cambian RLS, policies, Auth/OAuth, roles, usuarios, aliases ni el RPC original de ciclo. El aviso SECURITY DEFINER para authenticated es intencionado: autorización interna por entrenador/asignación. El trigger no se puede ejecutar directamente. La tabla de etapas continúa sin acceso directo.

## Ver sesión

Los listados de sesiones/días permiten consultar la prescripción sin crear un entrenamiento ni editar campos. Dentro se encuentra Editar, que reutiliza el editor existente. La lectura también muestra la prescripción estructurada por serie cuando existe. Los atletas asignados pueden consultar y entrenar, sin acceso a Editar. Se conservan UUID y las rutas ← Sesiones / ← Mis rutinas. Las respuestas de otra pantalla, sesión o usuario no reemplazan la vista actual.

## Validación ejecutada

593 comprobaciones únicas; las reejecuciones no suman:

| Suite | Resultado | Evidencia |
|---|---:|---|
| training-reset/backend.sql | 30/30 | Supabase staging, transacción con ROLLBACK y claims SQL controladas |
| statistics-stage/backend.sql | 23/23 | Compatibilidad del RPC legacy, ROLLBACK |
| statistics-stage/unit.cjs | 26/26 | Lectura verificada, tiempo, cachés, doble envío |
| training-reset/unit.cjs | 13/13 | Prescripción, cero, notas y borradores |
| training-reset/navigation.cjs | 9/9 | Respuestas tardías, errores y destinos por UUID |
| progress-cycle/contracts.cjs | 15/15 | Ciclo y paginación |
| progress-cycle/identity.cjs | 30/30 | Fixture histórica original e identidad |
| training-reset/browser.cjs | 204/204 | HTML actual, SDK offline, Chromium/WebKit, 320/390/1280, claro/oscuro |
| session-isolation/browser.cjs | 24/24 | Aislamiento cliente/rutina/UUID, Chromium/WebKit |
| Cruces externos de PostgreSQL | 4/4 | Misma solicitud idempotente; otra solicitud y escrituras antiguas rechazadas |
| Regresiones afectadas mediante compact/regressions.cjs | 215/215 | Duración 30, concurrencia 33, navegación/historial 26, borradores 7, entrenamiento 16, editor 34, aliases históricos 19, navegador duración/notas 50 |

Los tests SQL usan auth.uid controlado y comprueban grants; no constituyen nuevas pruebas con JWT firmados. Las pruebas de navegador son datos aislados, no entrenamientos reales de producción. Los ocho informes individuales de regresión se consolidaron tras las reparaciones del harness; no se presenta como una única ejecución continua. Solo se adaptaron dependencias, respuesta vacía del nuevo RPC y el recorrido solicitado Ver sesión → Editar; las expectativas funcionales permanecen.

Los cuatro cruces externos emplearon rutinas sintéticas de staging y dos transacciones concurrentes por caso. Cada caso terminó con una etapa, cero workouts y cero notas. Se eliminaron exclusivamente sus cuatro rutinas identificadas. Las 16 huellas de tablas centrales y campos estables de Auth de staging volvieron exactamente a su baseline; las etapas terminan con cero filas. No se crearon usuarios ni se hicieron llamadas a OpenAI.

Resultados y capturas están en results/ ignorado. No contienen credenciales ni se incorporan al commit. La fixture histórica permanece privada en su ubicación original; no se copia al repositorio público.

Preview offline: `node tests/training-reset/preview.cjs`, http://127.0.0.1:4259/?role=trainer. No accede a Supabase ni a proveedores externos.

## Promoción y rollback

Preparado sobre el árbol publicado de f1bd6af, equivalente a 3a97181. Esta fase no publica ni ejecuta un reinicio real. La promoción requiere autorización del nuevo cambio destructivo. Aplicar primero la migración; desplegar después el frontend. La migración por sí sola no elimina workouts/notas ni crea etapas de reinicio. Ningún cliente se reinicia automáticamente.

Rollback verificado en staging dentro de una transacción que termina en ROLLBACK. Primero publicar el frontend anterior; después aplicar rollback.sql si corresponde. Este rollback retira el código y la metadata nueva: **no recupera workouts o notas que alguien haya borrado deliberadamente usando el botón**. No presentarlo como recuperación de datos. Nunca ejecutar un borrado real como comprobación postdeploy.

Las lecturas finales de producción mantienen main f1bd6af, el RPC de ciclo 88c3564c3c49cf9c53fccba89a1e71b5, los 20 workouts y 61 notas de Guille y el snapshot de Patata exacto. No existe allí el nuevo RPC ni la columna de notas. Las huellas de routines/routine_exercises difieren del cierre de la fase anterior; esta ejecución no ha escrito en producción y no se atribuye ese evento a una persona sin auditoría.
