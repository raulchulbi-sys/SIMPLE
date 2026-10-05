# Diagnóstico futuro de respuestas Premium Chat

El output inválido de la llamada histórica 1 no se recupera ni se reclasifica por conjetura. Las siete respuestas válidas, el descarte y el bloqueo previo al proveedor se documentan en `telemetry-archive.md` mediante lectura de los archivos originales.

## Datos conservados

El receipt añade modelo fijo, versión del prompt, versión del contexto, versión del esquema, timestamp UTC, HTTP status, categoría de fallo, error de esquema, ruta de esquema y posición de array acotada. Conserva tokens de entrada/salida/cache, coste conocido y latencia cuando están disponibles. Un fallo incompleto puede tener coste conocido: no se confunde descarte con ausencia de consumo.

`failure_category`, `schema_error` y `schema_path` proceden exclusivamente de las listas exportadas del contrato. Las rutas contienen únicamente nombres de campos del esquema; las posiciones son enteros 0–7. Un campo inesperado produce `object_keys` en su objeto conocido, nunca el nombre ni valor de ese campo. Errores de red no copian el mensaje de la excepción. HTTP no exitoso no lee ni guarda el body de error. No se conservan output bruto, contenido de refusal, reasoning del proveedor, tokens de acceso, claves ni secretos en el receipt.

El diagnóstico privado viaja exclusivamente a `premium_chat_finish` con credencial de servicio; la respuesta pública sigue siendo la proyección segura del turno. El backend sanitiza los campos y conserva su etapa/categoría de rechazo independiente de la validación Edge. La lógica SQL puede descartar una salida que pasó Edge: ambos diagnósticos deben seguir distinguibles.

## Fingerprint

Se permite SHA-256 de un JSON canónico **solo después** de validar el output completo, su semántica y todos sus textos para scope/PII. El JSON canónico contiene exclusivamente el esquema cerrado de respuesta; no el envelope ni chain-of-thought. El fingerprint corresponde al contenido estructurado validado, no a los bytes originales o a un output que se haya reconstruido.

No se genera fingerprint de outputs rechazados, texto médico, medidas personales, PII ni texto desconocido. Un hash determinista de una frase médica corta podría contrastarse con un diccionario y revelar contenido; el hash no convierte ese texto en anónimo. Por eso la ausencia de hash en un fallo es deliberada. Si el runtime no dispone de hashing, queda null sin falsear el estado o reintentar. SQL elimina también cualquier fingerprint recibido si rechaza el output. La respuesta válida ya queda guardada bajo las protecciones existentes; su hash no incorpora información adicional sensible.

## Compatibilidad y pruebas

No cambian `premium-chat-v1`, el snapshot `gpt-5.4-2026-03-05`, el prompt de programación, los validadores de recomendaciones, los callbacks ni los métodos públicos. La única nueva clase de error público es `provider_protocol` para un envelope inválido que antes podía confundirse con fallo de red. Los receipts anteriores sin estos campos siguen admitidos por la sanitización backend.

El contexto admite dos etiquetas opcionales y cerradas: `baseline_origin` (`inherited_basic` / `existing_owned_routine`) y `history_origin` (`shared_existing_training`). Los contextos antiguos sin ellas conservan compatibilidad; otros valores se rechazan. El prompt del chat aclara que una base heredada de Basic no fue creada por Premium y distingue los cambios Premium aceptados, sin inventar la intención original. Se autoriza únicamente el origen local 4251 adicional para la preview unificada de staging.

Validación local final de estos cambios: `telemetry.cjs` 40/40, `tests/premium-chat/contract.cjs` 72/72 y `tests/premium-weekly/weekly-unit.cjs` 73/73. Todo el transporte está interceptado; no son accesos reales ni nuevas llamadas a OpenAI. `telemetry.backend.sql` pasó 12/12 contratos agrupados en staging sobre el helper final, incluida la restricción de índice a entero/null. La transacción terminó con rollback y no escribió filas.

`telemetry.cjs`: **40/40 pruebas nuevas**, con todo transporte interceptado. Cubre status HTTP, red/timeout, envelope/protocol, límite de tamaño, incomplete/refusal, JSON, esquema, claves desconocidas, paths/índices, scope, evidencia, candidato, receipt/coste, fingerprint seguro, rechazo de hashes sensibles y procedencia heredada. Ejecuta también el gateway real con origen local 4251 y comprueba que su confirmación privada no aparece en el body público. No hace llamadas remotas ni OpenAI.

Regresión afectada `tests/premium-chat/contract.cjs`: **72/72** sobre el código modificado, con transporte interceptado. Releer las ocho llamadas archivadas no constituye nuevas llamadas o generación de respuestas. La validación SQL y el E2E con JWT se informan por separado por el coordinador.
