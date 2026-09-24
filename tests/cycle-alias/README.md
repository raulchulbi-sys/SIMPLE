# Aliases históricos de día, exclusivamente para el ciclo

Estado: validado en SIMPLE Security Test. No publicado en producción. No modifica el frontend ni los workouts.

## Diseño

`candidate.sql` reemplaza únicamente el cuerpo de `get_client_routine_cycle_progress(uuid,uuid)`. Incluye una relación constante `confirmed_day_aliases` con las cuatro correspondencias confirmadas por el propietario el 21/09/2026. Cada fila contiene cliente, rutina, UUID antiguo y UUID actual. No hay una tabla persistente nueva.

Para este conjunto cerrado, una relación `VALUES` dentro del RPC ofrece una lista única, visible y revisable en el diff. Evita añadir tablas, políticas de acceso, permisos de mantenimiento y una interfaz administrativa. Añadir otro alias requiere una nueva revisión SQL y confirmación explícita. Si el número de aliases crece, convendrá una tabla administrada con procedencia y autorizaciones, como trabajo independiente.

Resolución:

1. UUID almacenado que pertenezca a un día actual de la rutina.
2. Alias exacto confirmado para ese cliente y esa rutina, cuyo destino siga perteneciendo a la rutina.
3. Solo si no hay UUID: nombre legacy exacto y único, normalizado únicamente con `lower(trim(...))`, como el RPC anterior de staging.
4. UUID no confirmado, destino inexistente o destino de otra rutina: sin resolución; no suma ni reinicia el ciclo. El workout conserva su identidad y contenido.

Los aliases no se encadenan ni se propagan a otros usuarios. No afectan a ejercicios, notas, gráficas, historial, borradores ni Última sesión. Conservan el orden de cálculo por fecha, creación e ID; no cambian la lógica de completar y reiniciar el ciclo.

## SQL y rollback

- `candidate.sql`: candidato, con guarda de hash previo aceptado. Solo aplicado a staging.
- `rollback-staging.sql`: restaura exactamente UUID-first anterior (`d9fbc229...`).
- `rollback-production.sql`: restaura la definición actual de producción (`ffea0e1e...`); se probó únicamente en staging.
- `comparison-readonly.sql`: simulación SELECT de las tres reglas sobre los históricos presentes. No modifica funciones ni datos.

Ambos rollbacks exigen que esté instalada exactamente la candidata (`88c3564c3c49cf9c53fccba89a1e71b5`). Conservar las comprobaciones de permisos/huellas y verificar nuevamente versiones antes de cualquier promoción futura. La autorización de pruebas no autoriza producción.

## Reproducción en staging

1. Comprobar proyecto y ausencia de colisiones. Ejecutar `node tests/cycle-alias/prepare.cjs`. Genera credenciales y SQL solo en `private/`, excluido de Git.
2. Revisar y ejecutar `private/seed.sql` exclusivamente en SIMPLE Security Test. Los IDs confirmados se reproducen en ese proyecto con cuentas artificiales `example.invalid`, nunca con credenciales o perfiles reales.
3. Ejecutar `node tests/cycle-alias/authenticated.cjs login` y después `suite` con acceso de red a staging.
4. El harness solicita la carga administrativa de históricos en `private/request.json`. El operador MCP ejecuta ese INSERT sintético mediante `execute_sql` en staging y escribe `private/response.json` con el mismo `id` y `error: null`. Atender cada solicitud una sola vez. Esto evita relajar el trigger que prohíbe crear workouts nuevos con días huérfanos. El RPC se consulta mediante JWT reales, no mediante impersonación SQL.
5. Al terminar la suite quedan doce filas sintéticas que reproducen la secuencia confirmada. Cambiar únicamente el RPC en staging y ejecutar `compare uuid-first`, `compare current` y `compare aliases` tras instalar cada definición. Los comandos comparan las mismas filas y verifican que no cambien.
6. Ejecutar `logout`, verificar ausencia de sesiones y aplicar `private/cleanup.sql`. Comparar huellas de las tablas previas y comprobar todos los IDs del manifiesto. Eliminar `private/config.json` y `private/seed.sql`.

El harness es una prueba operada con MCP; necesita que se atiendan sus solicitudes de fixtures. No es un test autónomo de CI. Los resultados y el manifiesto sin contraseñas quedan en `results/`, ignorado por Git.

## Resultado

95/95 comprobaciones autenticadas: cuatro inicios de sesión, 81 comprobaciones funcionales/de permisos, seis comparaciones de versión y cuatro cierres de sesión. Los cuatro logins están en la evidencia inicial; no se cuentan las dos comprobaciones vacías repetidas durante el ajuste del harness.

Secuencia confirmada: RPC actual **4/5**, UUID-first sin aliases **3/5**, UUID-first con aliases **4/5**. La consulta de los otros tres pares usuario/rutina existentes conserva sus resultados. SQL de solo lectura sobre 42 workouts compara los 126 pasos de los tres algoritmos.

La etapa de aliases del ciclo queda validada. Esto no da por aprobadas las cinco expectativas antiguas del frontend sobre unir UUID de ejercicios por nombre: no se cambiaron, no se repitieron y no forman parte de este alias de días. Antes de declarar cerrada toda la fase de identidad, deben quedar revisadas explícitamente. No se ha implementado duplicación ni se ha realizado commit/deploy.

Informe con huellas, casos y riesgos: `results/INFORME-ALIASES.md`. Contiene identificadores de datos reales; mantenerlo fuera de GitHub.
