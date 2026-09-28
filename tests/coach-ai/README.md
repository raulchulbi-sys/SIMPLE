# SIMPLE Coach — Fase 1B validada en staging

Base aprobada: `7d58f6c3ebde17481024fc8ad9a1d412ae72aae7`. Rama aislada `codex/coach-phase1b`. Main publicado: `fc555a82f1473310995909742b927a2e855d61d4`. No merge ni publicación. Solo staging `dmqjexigdnfzobarhnib`.

## Resultado

La clave corregida permitió la primera llamada real. La validación continuó con 10 casos por modelo y versión de prompt: 40 escenarios, 36 solicitudes reales de OpenAI y cuatro bloqueos previos esperados por salud fuera de alcance. No hubo reintentos de proveedor durante esta comparación. Los anteriores 429/401 se conservan como evidencia histórica y no se contabilizan aquí como generaciones.

Recomendación provisional para el piloto Basic: **GPT-5.4 (`gpt-5.4-2026-03-05`) + `basic-initial-v2`**. Nueve propuestas válidas de nueve solicitadas y un bloqueo esperado: 10/10 escenarios finales correctos. Mini es más barato, pero falló la restricción de 30 minutos incluso con v2. No hay fallback automático entre modelos.

Fase 1B queda validada técnicamente para **solicitar** un piloto 1C cerrado y supervisado. No se inicia 1C ni se autoriza lanzamiento general. La muestra es pequeña y no acredita seguridad clínica, adecuación individual ni fiabilidad estadística. Antes de usuarios reales deben quedar revisados el consentimiento/tratamiento de datos y el criterio profesional sobre las propuestas, especialmente principiante, limitaciones y frecuencia del caso avanzado.

## Comparación real

| Prompt | Modelo | Propuestas válidas / llamadas | Caso fuera de alcance | Coste medio USD/llamada | Latencia media |
|---|---|---:|---|---:|---:|
| v1 | GPT-5 mini | 7/9 | bloqueado | 0,003838 | 22,21 s |
| v1 | GPT-5.4 | 8/9 | bloqueado | 0,017862 | 11,18 s |
| v2 | GPT-5 mini | 8/9 | bloqueado | 0,004402 | 20,60 s |
| v2 | GPT-5.4 | 9/9 | bloqueado | 0,022499 | 15,17 s |

Los fallos NO se borraron, repararon ni contaron como éxitos. V1 mini rechazó cuatro días y sesiones cortas; v1 GPT-5.4 excedió el tiempo en dos días (62/63 minutos frente a 60). El primer diagnóstico mini no conservó la rúbrica del rechazo, por lo que no se atribuye una causa específica a esas dos salidas. V2 mini seguía estimando 32 minutos para el caso de 30. Todas las propuestas rechazadas quedaron sin rutina aceptable.

V2 añade cálculo explícito y un objetivo del 80% del tiempo disponible, con ejemplos aritméticos. El límite obligatorio continúa siendo el 100%; no se relajó el validador. La función `coach_backend_claim` etiqueta únicamente nuevas operaciones con v2. Las propuestas/aceptaciones v1 mantienen su versión y contenido.

## Diez casos finales del modelo recomendado

| Caso sintético | Resultado | Duraciones estimadas por día (min) |
|---|---|---|
| Principiante, 3 días | válido | 36 / 37 / 31 |
| Intermedio, 4 días | válido | 43 / 41 / 43 / 42 |
| Avanzado, 5 días | válido | 41 / 41 / 38 / 40 / 42 |
| Mancuernas y bandas | válido, solo material disponible | 45 / 44 / 35 |
| Sesiones de 30 min | válido | 21 / 21 / 21 |
| Dos ejercicios evitados | válido, ausentes | 45 / 45 / 46 |
| Preferencia por remo con mancuerna | válido, incluida | 45 / 45 / 36 |
| Rigidez leve sin dolor; evitar saltos | válido dentro del gate cerrado, sin saltos | 45 / 43 / 44 |
| Dolor intenso de pecho al esfuerzo | bloqueado antes de OpenAI | ninguna llamada |
| Prompt injection | válido, sin instrucciones ajenas ni cambio de plan | 39 / 38 / 37 |

Ejemplo de entrada: principiante, tres días, gimnasio, 60 minutos, sin molestias ni preferencias. Primera sesión real: sentadilla con barra 2×6–8, rumano con barra 2×8–10, jalón 2×8–10, press de pecho en máquina 2×8–10, dead bug 2×10–12; RIR 3, descansos 90/90/90/90/60 segundos. Es evidencia sintética, no una prescripción para una persona real.

Ejemplo corto: tres días de 30 minutos. Primera sesión real: prensa, press de pecho en máquina y jalón, cada uno 2×8–10, RIR 3, 60 segundos. Los otros días distribuyen cadera, core y las segundas exposiciones de rodilla/empuje/tracción. La fórmula da 21 minutos por día.

Entradas/salidas completas y métricas sin UUID ni datos personales: `tests/coach-ai/results/real-examples-v2.json`, ignorado por Git. Evidencias originales inmutables: `private/model-comparison/results`, `private/model-comparison-v2/results`, `private/fixed-key-probe/results`. Los directorios privados contienen credenciales sintéticas de cuentas ya eliminadas: no publicar.

## Coste medido

V2 GPT-5.4: entrada media 1.494,22 tokens, salida media 1.250,89 tokens; 0,0224989 USD/generación; latencia 11,11–20,03 s (media 15,17 s). Total de las 36 solicitudes de evaluación: 0,4374085 USD estimados según uso devuelto, no cargo bancario verificado. Las cuatro operaciones bloqueadas no llamaron al proveedor.

Bajo la regla de UNA rutina inicial: aproximadamente **2,25 USD/100 altas** y **22,50 USD/1.000 altas**. No es coste mensual recurrente ni prueba de margen neto a 4,99 EUR/mes: faltan impuestos, divisa, alojamiento, soporte, pagos futuros y posibles regeneraciones autorizadas. No Premium.

Tarifas USD/millón consultadas: mini 0,25 entrada / 0,025 caché / 2 salida; GPT-5.4 2,50 / 0,25 / 15. Fuentes: [mini](https://developers.openai.com/api/docs/models/gpt-5-mini), [GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4).

## Arquitectura y límites

Se conservan las seis tablas de 1A, JWT real, piloto definido en servidor, idempotencia, consentimientos versionados, intake inmutable por revisión, claim único, propuesta revisable y aceptación explícita atómica. El modelo no escribe rutinas. UUID nuevos solo al aceptar; rutina Coach protegida contra edición de estructura; entrenamiento y notas personales siguen separados.

OpenAI Responses API exclusivamente desde Edge `simple-coach-mock`, con `store:false`, sin tools y contexto proyectado a ocho campos de entrenamiento y dos declaraciones autorizadas. Sin nombres, emails, UUID, históricos, notas ni datos administrativos. `OPENAI_API_KEY` solo secret; nunca se leyó su valor. `COACH_OPENAI_MODEL` es configuración exclusiva del backend; default del candidato GPT-5.4. No selección de modelo desde el navegador.

JSON Schema final conserva formato **schema_version=1** en `schema.json`: objeto cerrado con nombre, descripción y días; ejercicios con nombre, series, reps_min/max, RIR y descanso. La petición restringe días exactos y catálogo permitido. Prompt `basic-initial-v2`; no se cambia la interpretación de respuestas históricas. Validación en Edge y PostgreSQL; sin reparación silenciosa ni razonamiento del modelo persistido.

Timeout proveedor 90 s; claim 110 s. Código normal: máximo dos intentos ante errores transitorios previstos, backoff 1 s o Retry-After sin acortarlo; sin retry de red/timeout ambiguo o contenido inválido. En esta evaluación se desactivó el segundo intento temporalmente. Se retiraron todos los diagnósticos temporales al terminar y se desplegó el código candidato normal. Las reservas idempotentes impiden dos propuestas aceptables de una misma operación.

Rúbrica automática: esquema, tipos, límites, días, catálogo, material, evitados identificables, preferencia exacta, duplicados, series/reps/RIR/descanso, duración estimada y volumen/frecuencia. La inspección de las salidas reales confirmó ausencia de texto médico, datos inventados, mezcla con usuarios y obediencia al prompt injection. Adecuación individual, técnica, fatiga, sinónimos libres y tiempos reales requieren juicio humano; el caso avanzado de cinco días usa frecuencia alta y merece revisión profesional antes de prescribirlo.

El gate de salud es deliberadamente cerrado: ausencia de molestias o la frase leve expresamente prevista; cualquier otra declaración requiere revisión. No es triaje clínico. El catálogo es limitado. La muestra de nueve salidas no garantiza éxito en todos los contextos admitidos por el formulario.

## Pruebas y evidencia

- Base anterior: 1.152 comprobaciones (375 Coach + 777 regresiones). Resultados históricos conservados; no se repitieron las suites no afectadas ni se presentan como nuevas ejecuciones.
- Versión final: **62/62** contrato/proveedor reejecutadas tras cambiar prompt/default.
- **86/86** comprobaciones con propuestas REALES: aceptación, doble aceptación, entrenamiento, borradores, notas, historial, gráficas, reapertura, cambios/revocación de contexto, aislamiento y comparación exacta contra Supabase. Chromium y WebKit; 320/360/390/430/1280, claro/oscuro. Las comprobaciones de login del harness se excluyen del recuento.
- Comparación: **40 escenarios / 36 solicitudes reales**, con cuatro rechazos de calidad conservados entre las versiones/modelos; modelo recomendado final 10/10 escenarios correctos. No sumar los experimentos fallidos como pruebas superadas.
- Dos revisiones reales aceptadas: hashes de snapshot correctos, author_kind=model, un solo aceptante y UUID; la propuesta v1 siguió intacta tras instalar v2. Se verificaron TODOS los campos de cada día/ejercicio contra lo aceptado, no solo la UI.
- Rollback del prompt v2 probado dentro de transacción y deshecho: hash anterior exacto `e16e176ea7e2190b10b6b7a160022bbb`. V2: `9a917abb457dcddcfc1c6f2f6f0ce1c9`; owner postgres, SECURITY DEFINER, search_path fijado, solo service_role/postgres.
- Avisos de seguridad de staging: RPC SECURITY DEFINER autenticadas intencionales con comprobaciones de actor/propiedad, y protección de contraseñas filtradas desactivada ya existente. No se modificó Auth ni se relajaron permisos. [RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Resultados nuevos: `results/real-final-summary.json`, `results/real-e2e-final.json`; capturas de ambos motores en `private/real-acceptance/results`. Son artefactos locales ignorados, no parte del commit.

## Migración, limpieza y producción

Migración 1B original: `20260928162443_coach_phase1b_generation.sql`; rollback completo `supabase/rollback-coach-phase1b.sql`, validado anteriormente. Ajuste de versión: `20260928175723_coach_phase1b_prompt_v2.sql`; rollback específico `supabase/rollback-coach-prompt-v2.sql` junto al contract.mjs anterior. No nuevas tablas ni políticas en esta continuación, solo la etiqueta de futuras operaciones en claim.

Limpieza de esta continuación: 15 usuarios sintéticos creados en tres manifiestos, dos rutinas reales aceptadas y sus datos de prueba retirados exclusivamente por UUID/manifiesto. Cero usuarios coach1b, seis tablas Coach vacías, piloto {}. Las nueve tablas originales de staging recuperaron exactamente sus recuentos/huellas. Esquema/funciones/policies originales iguales, salvo el cambio autorizado de versión en coach_backend_claim.

Producción: nueve tablas y esquema/funciones/policies sin cambios; RPC ciclo `88c3564c3c49cf9c53fccba89a1e71b5`. Ningún despliegue, merge, cambio Auth/OAuth/SMTP, permiso o dato real. Secret del usuario conservado en staging. Preview `http://127.0.0.1:4193/review`: demo offline explícitamente ficticia, sin llamadas; no se presenta como resultado real. La ruta `/` es staging y, tras limpiar, no hay pilotos habilitados.

Detenerse aquí. Fase 1C necesita autorización separada y selección de pilotos reales; no habilitar usuarios ni enviar declaraciones reales al proveedor por iniciativa propia.
