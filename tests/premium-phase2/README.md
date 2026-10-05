# SIMPLE Coach Premium — Fase 2 (solo staging)

Base exacta: `72fc5454a2cf59e2ac7c1d565f24895fd3999228`, Fase 1 aprobada.
Rama: `codex/coach-premium-phase2`. No merge, push ni publicación.
Proyecto permitido: SIMPLE Security Test (`dmqjexigdnfzobarhnib`).
Producción sigue en `b15968c73ab1b075c70f5456e6531733696c3bf5`.

## Arquitectura y límites

Se conservan las tres tablas públicas de Fase 1. Se añaden columnas de mapeo,
seguimiento y trazabilidad; una tabla **privada** de presupuesto/configuración.
No se modifica Basic, Auth, aliases, workouts existentes ni el frontend publicado.
La nueva Edge `simple-coach-premium` comprueba JWT y usuario, propietario, permiso
revocable, mesociclo activo, intake presentado, revisión base, presupuesto y semana.
El modelo recibe datos, nunca credenciales ni acceso a Supabase.

Modelo: `gpt-5.4-2026-03-05`. Prompt: `premium-analysis-v1`.
Contrato provider: `premium-provider-v1`. Respuesta: `premium-recommendation-v1`.
Contexto histórico: `premium-history-context-v1`; inicialmente 4 exposiciones/56 días,
112 sesiones, 40 ejercicios y 12 series. Configuración backend privada, versionada y
copiada al contexto almacenado. Los límites pueden reducirse; ampliarlos exige
otra versión/revisión. Cada análisis conserva su contexto y hash, sin reinterpretarlo.

### Mapeo

`exercise UUID interno → exercise_N → catálogo exacto permitido → UUID interno`.
`day UUID interno → day_N`. Referencias ordenadas por orden e identidad dentro
de la rutina, congeladas en `analysis_bundle`. El RPC backend `premium_bind_catalogue`
recibe equivalencias explícitas y valida UUID/rutina/revisión/catálogo. Nunca infiere
por nombre. Las pruebas generan los UUID a partir de IDs de catálogo conocidos.
Un ejercicio sin vínculo exacto conserva sus métricas descriptivas y no es modificable.
La incorporación futura de una rutina real exige aportar su mapping explícito;
no se ha mapeado ningún cliente real. Se conservan únicamente los aliases históricos
confirmados, restringidos por usuario/rutina en Fase 1. Hiperextensiones no se asocia
a Hip thrust. Una sustitución obtiene un UUID nuevo sin heredar su histórico.

### Provider minimizado

Incluye vocabulario cerrado de intake, inventario/material permitido, exclusiones,
disponibilidad y contexto de esfuerzo/recuperación; mesociclo/semana/revisión numérica;
referencias anónimas de días/ejercicios; prescripción y proyección `planned_sets`;
exposiciones con fecha/kg/reps/RIR; métricas descriptivas; resumen semanal y límites;
catálogo de sustitutos compatibles. No incluye UUID internos, nombres personales,
emails, notas libres, datos administrativos, salud ni información de otros usuarios.
Inventario personalizado libre se elimina de esta proyección.

La prescripción es **legacy uniforme por ejercicio**, marcada expresamente
`legacy_uniform_projection`. No es una reconstrucción de series individualizadas.
Fase 1 impide convertir una rutina Basic protegida en Premium. Un cambio por serie,
top set/back-off o estructura no representable debe ir a REVIEW. La integración
completa de prescripciones individualizadas Premium permanece pendiente; no se
declara implementada por estas pruebas ni se debilita V5 para hacerla encajar.

### Prompt, schema y validación

El prompt completo y el schema estricto están en
`supabase/functions/simple-coach-premium/contract.mjs`.
KEEP es válido con progreso, estabilidad o información insuficiente. El descenso
no activa una regla automática de reducción. Sueño/estrés no demuestran causalidad.
Se preservan la filosofía V5, descansos por demanda/RIR, fallo selectivo y volumen
recuperable. Máximo tres cambios pequeños; `change_sets` solo ±1 por ejercicio.
Acciones: sets, reps, RIR, descanso, sustitución y distribución entre días existentes.
KEEP/REVIEW no tienen cambios. No se regenera la rutina semanalmente.

`facts` contiene únicamente referencia y tendencia verificada. El servidor construye
las observaciones numéricas a partir de los registros, evitando números inventados.
`interpretation`/`reason` son explicaciones breves; no se guarda chain-of-thought.
Validación strict de tipos/claves/enums en Edge y validación semántica independiente
en SQL: pertenencia, referencias, revisión, `from`, límites, catálogo/material/exclusión,
duplicados y conflictos. Respuesta inválida/fallida/obsoleta no es aplicable.
Warnings de descanso, fallo de alto coste, evidencia limitada, múltiples cambios o
lenguaje causal quedan almacenados para revisión; por sí solos no bloquean.

### Trazabilidad y aceptación

La recomendación almacena mesociclo, semana, revisión base, clave idempotente,
fechas, versiones de history/provider/mapping/prompt/schema, hash provider, modelo,
output estructurado, hechos canónicos, warnings, uso/coste/latencia y resultado.
La IA solo propone. Reviewer asignado al mesociclo valida/rechaza; REVIEW requiere
resolución explícita, conservando el output original. No hay permisos role-wide ni
acceso global a workouts. El atleta acepta solo una recomendación lista y vigente.

KEEP no crea una revisión vacía, mantiene la actual y avanza el seguimiento una vez.
MODIFY aplica los parches y crea la revisión de forma atómica, bloqueando gestión,
mesociclo y recomendación. Las semanas anteriores conservan su versión y las
posteriores reciben la nueva **por semana de seguimiento**, no por fecha de calendario.
La ruta legacy de Fase 1 conserva su criterio por fecha. Doble aceptación es idempotente;
dos cambios competidores solo permiten un ganador. Workouts/snapshots anteriores
no se reescriben. Consentimiento revocado durante una llamada impide aplicarla.

## Orquestación y presupuesto

`authorize → reserve/context snapshot → budget claim → una llamada Responses →
strict+semantic validation → finish/persist → human review → explicit acceptance`.
La Edge tiene `verify_jwt=true` y verifica además `/auth/v1/user`; solo acepta staging.
`OPENAI_API_KEY` se utiliza exclusivamente desde el entorno de servidor ya configurado.
No se ha leído, copiado ni modificado su valor. No hay reintentos automáticos.
Bloqueo global transaccional: máximo 12 despachos y 0,50 USD incluyendo reservas
conservadoras de tokens/1.800 tokens de salida. Si se pierde el recibo, se carga la
reserva completa. Si falla la persistencia después del despacho, la operación permanece
cerrada a reenvío y requiere intervención; no se vuelve a consumir automáticamente.

Coste calculado con usage registrado, no factura bancaria. Tarifas utilizadas:
input 2,50 USD/M; cached input 0,25 USD/M; output 15 USD/M.
[Modelo/precios oficiales](https://developers.openai.com/api/docs/models/gpt-5.4).
[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Ejecución y preview

`unit.cjs` no usa red/OpenAI. `live.cjs` exige manifest privado del entorno de pruebas
y JWT reales. `functional.cjs` recorre aceptación/revisión con identidades sintéticas.
`server-tests.cjs`, `final-sql.cjs`, `tracking-tests.cjs` construyen SQL acotado;
las pruebas transaccionales terminan en ROLLBACK. `ui.cjs` y `ui-edge.cjs` usan
Chromium/WebKit. El primero se ejecutó con fixtures reales y luego en replay final;
el segundo simula exclusivamente el transporte para errores/textos largos/respuestas tardías.
No confundir una respuesta simulada con un resultado real de OpenAI.

Preview: `http://127.0.0.1:4233/review`.
Tras limpiar staging queda en **replay offline** de las salidas reales sintéticas,
en su estado previo a revisión; sus acciones están claramente marcadas como simuladas.
No sirve archivos privados ni credenciales. El modo live se utilizó solo durante
la validación y ya está detenido. No hay entrada Premium comercial en `index.html`.
La UI aislada utiliza la identidad SIMPLE aprobada, sin Atlas ni rediseño del producto.

## Limpieza, seguridad y rollback

Se eliminaron exclusivamente 8 rutinas, 16 días, 32 ejercicios vivos, 58 workouts,
8 mesociclos/48 semanas, recomendaciones/revisiones/gestión y un grant creados en esta fase.
No se crearon ni borraron usuarios Auth: los cinco usuarios de prueba preexistentes
se conservaron. No queda ninguna fixture de Fase 2 ni acceso Premium activo.
Las nueve tablas centrales de staging coinciden exactamente con sus hashes/recuentos
previos. Se conserva únicamente el contador privado de coste: 10 llamadas,
0,1077695 USD, reserva 0, **enabled=false**. No se puede reservar un nuevo análisis.

`rollback.sql` restaura únicamente Fase 1 y se niega a descartar análisis/mappings
sin una limpieza previamente revisada. Ensayado: las 72 funciones originales vuelven
a coincidir exactamente en definición/hash/owner/ACL/search_path. Después se reaplicó
el SQL final a staging limpio y se dejó cerrado, conservando el contador real.
El generador normaliza LF para que el rollback reproduzca también el hash exacto.
Para rollback completo de Edge, detener primero los despachos y retirar únicamente
`simple-coach-premium` (CLI: `supabase functions delete simple-coach-premium --project-ref
dmqjexigdnfzobarhnib`), tras conservar evidencia. No borrar el secret compartido con Basic.
La eliminación de Edge no se ejecutó: sigue desplegada solo en staging y sin acceso.

Advisors: RLS sin policies en la tabla privada es intencional (deniega usuarios);
RPCs SECURITY DEFINER de propietario/reviewer son intencionales, con autorización
y search_path fijo. No se cambiaron avisos preexistentes de Auth/otras funciones.
[Aviso RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Pendientes antes de un piloto/promoción

No publicar aún. Cobertura real: 9 KEEP, 1 MODIFY por sustitución, 0 REVIEW.
G devolvió KEEP: el cambio de volumen se probó con output controlado, no obtenido de IA.
REVIEW también se probó con output controlado. No forzar un cambio para satisfacer el test.
Confianza alta en D/E expresa prudencia del KEEP; no demuestra una tendencia fuerte.
Conviene definir esta semántica antes de mostrar confianza al atleta (la preview no la usa
para tomar decisiones). No se demuestra eficacia longitudinal con ocho datasets sintéticos.
Las prescripciones individualizadas siguen siendo el límite funcional mencionado arriba.

Basic vigente: 50 checks intake + 35 checks V5. Una suite histórica V4 llama al contrato
actual V5 y falla en `balanced candidate, direct frequency`; se confirmó el mismo fallo
en 72fc545. No se modificó para hacerla pasar ni se contó como superada.
Producción/patatasimple permanecieron intactos; 52 funciones de producción y nueve
tablas centrales coinciden con el inicio. Ciclo conserva hash
`88c3564c3c49cf9c53fccba89a1e71b5`. No Auth/OAuth/SMTP/roles/configuración reales modificados.

Resultados completos, evaluación manual, costes y comprobaciones: `RESULTS.md`.
Los manifiestos/JWT/recibos crudos/capturas están en `private/` y `results/`, ignorados
por Git. Solo código, SQL, documentación sanitizada y el ejemplo provider se versionan.
Detenerse aquí para revisión, antes de Fase 3.
