# SIMPLE Coach Chat — interfaz limitada a staging/preview

Autoridad visual: `frontend-design`. Se conserva la paleta semántica de `assets/theme.css`: crema `#f7f5f1`, papel `#fff`, piedra `#e9e5de`, texto `#252929`, secundario `#656965`, con los equivalentes oscuros existentes. Tipografía Arial de las pantallas Premium actuales; no nuevas fuentes ni Atlas. Todos los selectores del producto quedan bajo `.premium-chat`; no se modifica `index.html`, onboarding, entrenamiento ni Guardar/Finalizar.

La jerarquía es conversacional: cabecera breve con vuelta a SIMPLE Coach, contexto de semana/revisión, filas de preguntas y respuestas y un compositor inferior. El texto del atleta tiene un fondo piedra discreto; la respuesta usa el fondo de la pantalla. Solo una propuesta tiene contenedor propio porque representa una acción distinta y requiere ver Antes/Después. No hay avatares ni tarjetas repetidas para cada respuesta.

## Correcciones y protecciones concretas

| Problema que se evita | Implementación | Beneficio | Comprobación |
|---|---|---|---|
| Teclado o pantalla estrecha ocultan enviar | Altura desde visualViewport y grid de cabecera/conversación/compositor; scroll solamente en conversación | Entrada y acción siguen visibles | 320/360/390/430/1280, reducción de viewport para simular teclado |
| Permiso concedido por escribir o entrar | Casilla explícita + Activar chat, composer deshabilitado hasta respuesta autorizada del adapter | Consentimiento verificable separado de escribir | Caso permiso/revocación, ninguna solicitud send por escribir |
| Piloto cerrado se confunde con consentimiento perdido | permission, history_permission y available se conservan separados; el cierre no ofrece conceder de nuevo permiso | Explica el bloqueo correcto sin un consentimiento ilegal | Piloto cerrado e historial no autorizado con chat previamente autorizado |
| Doble click o refresh repiten envío | Clave/message_id UUID seguros; botón bloqueado con respuesta pendiente; reconcile mediante state al recargar | Evita reenvío automático | Doble click, poll solo state, reload con IDs persistidos |
| Respuesta vieja reemplaza nuevo contexto | Epoch de pantalla, secuencia/revisión monotónica, respuestas de controlador destruido ignoradas | Evita mostrar información de revisión anterior como actual | Concurrencia, N→N+1, navegación/estado |
| Texto libre ejecuta HTML/Markdown | Todo contenido dinámico se inserta con textContent; sin parser Markdown ni innerHTML | Texto legible sin enlaces/scripts interpretados | Payload HTML/script/URL JavaScript literal |
| Error pierde pregunta o genera retry oculto | Input permanece; retry solo explícito; retry_after bloquea envío durante el intervalo | Reintento comprensible y controlado | Red, timeout, cuota y retry manual con clave nueva |
| HTTP aceptado se interpreta como respuesta correcta aunque el turno haya fallado | Se comprueba el estado del turno devuelto/releído; failed/rejected/superseded conservan la pregunta y muestran error. Presupuesto agotado no ofrece Reintentar respuesta | El atleta entiende que no se generó una respuesta; evita una invitación inmediata a gastar de nuevo | Casos HTTP aceptado fallido/rechazado/sustituido y presupuesto agotado en la matriz visual completa |
| Chat aplica una propuesta inmediatamente | Card con Ver propuesta y vista separada; sin botón Aplicar/Aceptar en mensaje | Conserva revisión y aceptación existentes | Before/After, warnings y pending_review sin aceptación |
| Aviso de alcance desaparece | Notice visible junto al compositor y enlazado mediante aria-describedby | Recuerda la limitación del texto libre | Texto exacto, Claro/Oscuro y todos los tamaños |
| Respuestas no anunciadas o controles inaccesibles | Estado breve role=status/alert; foco visible; controles ≥44px; Ctrl/Cmd+Enter | Teclado y lectores de pantalla tienen feedback | Geometría, foco y roles browser |
| Una lectura terminada sigue diciendo que carga | El aviso Cargando propuesta se retira al recibirla y el foco pasa a su título | Distingue una propuesta disponible de una operación pendiente | Completado de propuesta en las veinte combinaciones visuales |

## Contrato del adapter

`PremiumChat.mount(container, adapter, options)` devuelve `load()`, `destroy()`, `snapshot()` e input. El adapter recibe `(action, data)`; la seguridad no depende de estos controles visuales.

State seguro: `{permission, history_permission, available, week, revision_no, revision_id, mesocycle_id, conversation, messages, recommendation?}`. Cada mensaje contiene id/sequence/state/user_content/assistant_answer/recommendation_id y, opcionalmente, recommendation/retryable/safe_response. No requiere JWT ni credenciales en el browser de preview. `PremiumChat.fromBackend()` traduce exclusivamente la proyección segura del RPC: sequence_no→sequence, user_message→user_content, answer→assistant_answer, conservando por separado los tres indicadores de acceso y excluyendo recibos y credenciales. Las recomendaciones se suministran mediante una consulta autorizada del host, sin inventarlas a partir del texto.

Actions: `state`, `permission`, `send`, `retry`, `proposal`, `navigate`. Send/retry: `{mesocycle_id, conversation_id, revision_id, key, message_id, message, retry_of?}`. Permission: `{allow:true, notice_version:"premium-chat-v1"}`. Proposal: `{id}`; devuelve representación de lectura o `{handled:true}` si el host abre el flujo existente. Navegación: `{destination:"coach"}`.

El host adapta send/retry al payload cerrado de Edge `{mesocycle_id, revision_id, key, message}` y transforma el rechazo explícito del backend (incluso con HTTP 200) en error del adapter: no se presenta como respuesta completada ni se borra la pregunta. Input de 2 a 4.000 caracteres, contador y maxlength coherentes con la configuración operacional. No se interpreta un piloto desactivado como chat sin consentimiento; si falta historial se indica activarlo desde SIMPLE Coach, sin abrir rutas nuevas. Los mensajes superseded quedan de lectura, sin reintento automático ni aplicación.

No se guarda el texto libre en localStorage/sessionStorage. Solo IDs de petición pendiente en sessionStorage por mesociclo, para reconciliar contra el servidor; nunca se reenvía el mensaje al recargar. La conversación persistida pertenece al backend y sus RLS. Poll de estado no llama send/retry ni al modelo. Un fallo de poll ofrece Actualizar conversación manualmente.

## Preview y evidencia

[Preview offline](http://127.0.0.1:4245/review), con aviso explícito de datos y respuestas simulados. El servidor es loopback, lista cerrada de assets, rechaza origen ajeno y no sirve private/results. `node tests/premium-chat/preview.cjs` lo inicia; `node tests/premium-chat/ui.cjs` ejecuta su propio servidor independiente.

La matriz visual usa Chromium y WebKit, cinco anchos y ambos temas. Los casos de interacción incluyen los quince mensajes requeridos, conversación de diez turnos, cambio N→N+1, check-in ausente, estados largos, HTML/script, doble submit, multitab, permiso, cuota, error y retry. Las respuestas son mocks; no sustituyen las pruebas JWT, el pipeline de recomendaciones ni las llamadas reales coordinadas por la tarea principal.

Capturas generadas en `tests/premium-chat/results/`, ignoradas por Git. Selección: `chat-320-light.png`, `proposal-390-dark.png`, `chat-430-dark.png`, `chat-1280-light.png`.

Limitación explícita: la prueba de teclado reduce el viewport; no equivale a probar un teclado físico en iPhone/Android. La política de filtro médico y la autorización real se validan en backend; el texto literal seguro del renderer no garantiza que un filtro identifique toda información sensible.

Los resultados finales y sus recuentos se leen del `results/ui.json` completado de esta versión. Los ensayos interrumpidos no se suman como pruebas adicionales.
