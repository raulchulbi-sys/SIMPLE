# Premium: distribución de sesiones

Base: candidato `1306f43`, árbol idéntico al main publicado `da4a2f0`.
Rama aislada: `codex/premium-session-distribution`.

## Contrato

`premium-session-distribution-v1` añade el resultado estructurado
`premium-weekly-distribution-v1`. Una propuesta MODIFY de distribución contiene
un único `change_session_distribution`, sin mezclar otros changes.

- `sessions` representa el programa completo resultante, en orden.
- Cada sesión declara `keep_session`, `move_session` o `add_session`, referencia,
  día disponible, minutos y todos sus ejercicios/series/reps/RIR/descansos.
- Referencias existentes conservan UUID y catalogue_id. Las nuevas referencias
  reciben UUID una sola vez al compilar; aceptación los reutiliza.
- Sesiones y ejercicios omitidos deben enumerarse en `removed_sessions` y
  `removed_exercises`; la retirada de ejercicios exige motivo explícito.
- La eliminación de una sesión redistribuye su contenido o retira cada ejercicio
  explícitamente. Nunca se confía en un borrado en cascada para decidirlo.
- Añadir un día no implica aumentar volumen. Cualquier aumento de series exige
  `volume_reason`, independiente de la distribución.
- No se permite material/día no disponible, ejercicio excluido, identidad
  cambiada, ejercicio repetido por referencia, pérdida silenciosa ni comprimir
  descansos para hacer caber más volumen.

KEEP y REVIEW siguen disponibles. Cuatro días disponibles no fuerzan cuatro
sesiones. El historial escaso sigue siendo `insufficient_data`; los campos null
no se convierten en observaciones inventadas.

## Persistencia, permisos y compatibilidad

La migración `20261005190239_coach_premium_session_distribution.sql` solo añade
helpers privados y sustituye seis funciones por wrappers. No añade tablas,
columnas, índices, policies, triggers ni permisos de API. Conserva el pipeline
existente de revisión y aceptación, sus locks, guardas y revisión inmutable N.
La aceptación crea N+1 atómicamente y conserva workouts anteriores.

Las revisiones, schemas weekly/series anteriores y Basic v2/v3/v4/v5 continúan
en su ruta anterior. Se conserva el catálogo V5; no se añaden aliases.
El reviewer recibe únicamente la proyección segura antes/después con nombres,
prescripción completa, distribución, volumen y quality warnings. No recibe
notas privadas, conversaciones, allocations internas ni el snapshot bruto.

Los límites, modelo y presupuesto no cambian. La extensión conserva el máximo
de salida existente: una respuesta truncada debe rechazarse, nunca aplicarse
como programa parcial. Esta fase no realiza llamadas reales al modelo.

## Despliegue y rollback

La migración y Edge Premium se han aplicado únicamente en staging. El Edge
mantiene `verify_jwt=true`; sus ocho archivos desplegados coinciden con el source.
Producción todavía usa el contrato anterior. No promover hasta validar los
cruces realmente simultáneos por API.

`rollback.sql` restaura las seis definiciones originales y retira los helpers.
Se probó en staging: hashes originales idénticos; después se reaplicó el
candidato final. El rollback rechaza ejecutarse si ya existen revisiones de
distribución aceptadas. En ese caso se necesita una corrección compatible hacia
delante, nunca borrar o reescribir la revisión histórica.

Para Edge, la versión anterior de staging era 9; la del candidato es 10.
La publicación, cuando esté validada, debe desplegar únicamente Premium con el
pack revisado; el chat no necesita un nuevo deploy.

## Pruebas

- `unit.cjs`: contrato puro, sin red/credenciales/modelo.
- `backend.sql`: fixtures controladas de staging en una transacción que termina
  con ROLLBACK. Incluye adición/retirada explícita de ejercicios.
- `ui.cjs`: Chromium y WebKit sobre proyecciones sintéticas locales. No demuestra
  OAuth real, llamadas IA ni concurrencia de base de datos.
- Las suites de regresión y los límites de evidencia constan en `RESULTS.md`.

Las capturas, resultados y cualquier evidencia individual del piloto permanecen
en directorios `results`/`private` ignorados por Git. No incluirlos en el commit.
