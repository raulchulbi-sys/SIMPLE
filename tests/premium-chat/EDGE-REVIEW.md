# Revisión independiente de Edge Chat

Revisión de solo lectura de `supabase/functions/simple-coach-chat/chat-contract.mjs` y `index.ts`, con comprobación de sus llamadas contra la migración candidata. No ejecuciones de SQL, llamadas OpenAI, usuarios ni fixtures por esta revisión. La validación JWT real y los recibos del proveedor pertenecen a las suites coordinadas y se informan por separado.

## Resultado

No se identifica un bloqueo material nuevo de privacidad, coste o seguridad para el alcance exclusivo de SIMPLE Security Test. La función rechaza otro proyecto, origen de producción, métodos distintos de POST y campos ajenos al payload cerrado. Verifica el JWT mediante Auth; `p_user` procede de esa respuesta y nunca del cuerpo. El browser no controla contexto, recibos, output ni modo de proveedor.

El mensaje se filtra antes de reserva y proveedor. El contexto se captura en backend, usa referencias locales y excluye identidad y secretos; el contrato rechaza UUID, correos, URLs, tokens, campos de identidad y diálogo de otra revisión. La memoria está acotada a ocho turnos y cuatro decisiones. Las instrucciones tratan el mensaje como datos no confiables; el modelo no dispone de herramientas ni capacidad de escritura.

`prepare` no realiza una llamada. El claim de modo OpenAI tiene lugar antes del dispatch y reserva un máximo basado en bytes del request completo (prompt/schema incluidos), margen de 2.048 y límite de 1.000 tokens de salida. Un claim perdido devuelve el turno existente; no reenvía. El proveedor no se reintenta automáticamente. Se usa `store:false`, modelo fijo y timeout. Error/429/incomplete no se confunden con respuesta válida. La finalización carga uso conocido verificable, o la reserva conservadora si no puede conocerse; la caducidad tiene la misma protección.

La respuesta sigue un schema cerrado y referencias de evidencia existentes. Un candidato pasa el validador por serie existente y el pipeline de revisión/aceptación; el texto del chat no aplica cambios. Un contexto revocado/obsoleto se vuelve a comprobar en claim y finish. Los errores publicados son códigos cerrados, no excepciones, textos rechazados ni credenciales.

## Correcciones verificadas durante la revisión

Se señaló la discordancia de longitud mínima: Edge aceptaba un carácter mientras SQL/UI exigían dos. El coordinador la alineó a dos; la revisión posterior confirma ese cambio y su expectativa contractual. El renderer traduce los códigos reales `outside_scope`, `provider_failed`, `invalid_output` e historial pendiente sin revelar texto privado.

También se sustituyó `req.text()` por lectura streaming con máximo acumulado de 18.000 bytes y cancelación inmediata al excederlo; Content-Length excesivo se rechaza antes de leer. Se verificó el código final y el informe contractual coordinado de 72/72 incluye cuerpo grande y tamaño declarado, sin reserva ni dispatch del modelo. Esta cifra pertenece a esa suite, no son nuevas ejecuciones de esta revisión.

Las instrucciones finales piden texto plano sin Markdown, nombres legibles de ejercicios en vez de `exercise_N/day_N` y descansos expresados en minutos. Es coherente con el renderer de texto literal y la presentación SIMPLE existente; no altera el schema estructurado ni sus referencias internas de validación. El cumplimiento real de esas instrucciones se evalúa en las salidas reales, sin reescribir las anteriores ni realizar llamadas nuevas.

## Límites de lo que demuestra

- El filtro léxico de datos sensibles y alcance no certifica que cualquier texto imaginable quede anonimizado. Se mantienen el aviso explícito, minimización, aislamiento y ausencia de herramientas como capas independientes.
- `facts_used` válido prueba referencias permitidas, no que todas las frases narrativas sean lógicamente ciertas. La calidad de respuestas reales requiere evaluación descriptiva; no se declara a partir de mocks.
- Una desconexión o fallo al finalizar se resuelve por estado persistido/caducidad, no mediante retry automático. La reserva desconocida puede ser mayor que el coste real: es una protección presupuestaria, no una medición del recibo.

No se modifica ningún SQL ni archivo Edge como parte de esta revisión independiente.
