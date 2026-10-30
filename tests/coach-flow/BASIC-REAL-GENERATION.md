# Una generación Basic V5 real — procedimiento y cierre

**Cierre 28/10/2026:** el ensayo fue autorizado y ejecutado una sola vez. Ver
[resultados reales y auditoría deportiva](BASIC-REAL-RESULTS.md): 24/24 checks SDK/JWT,
propuesta pendiente de revisión sin aceptación y staging restaurado. El texto fechado
27/10 que sigue conserva la preparación histórica, no el estado actual ni permiso
para repetir. El 29/10 solo se revisaron los recibos locales; ninguna llamada nueva.

Actualizado: 27/10/2026. Solo SIMPLE Security Test (`dmqjexigdnfzobarhnib`).
**Guard desplegado y verificado únicamente en staging: v32, verify_jwt=true. Basic/reviewer siguen deshabilitados; cero conteos y generaciones reales. No existe una garantía contractual de facturación por solicitud equivalente a un hard cap monetario del proveedor.**
El despliegue autorizado está cerrado en [BASIC-GUARD-DEPLOYMENT.md](BASIC-GUARD-DEPLOYMENT.md). Este documento no autoriza activar accesos ni llamar a OpenAI.

## Código y pruebas del 27/10

`staging-cost-guard.mjs` envuelve el proveedor existente solo cuando el entrypoint detecta
el proyecto exacto de staging. Producción continúa utilizando `generate` sin cambios.
No se modificaron contratos V5, SQL, funciones financieras, permisos ni catálogo.

- 44/44 casos nuevos offline: límites de bytes/tokens, cuerpo final/schema, configuraciones,
  errores/timeout, doble dispatch concurrente, recibos, contabilidad no recortada y entrypoint.
- 35/35 regresiones V5 existentes reejecutadas, sin sumarlas como nuevas.
- Preflight offline: PASS; 10.467 bytes, 26 ejercicios disponibles, input sintético válido.
- 21/21 SDK/JWT históricos reutilizados; no nuevos logins ni comprobaciones JWT.
- Todas las respuestas OpenAI de estas pruebas están simuladas. Cero llamadas reales.

El guard conserva el lock durable de `coach_backend_claim` y añade un latch local consumido
antes de cualquier await. No confundir el latch con una garantía cross-instance: esta sigue
en PostgreSQL. La prueba concurrente del entrypoint simula el claim; no suplanta el ensayo JWT.

El recibo saneado `basic_cost_guard` solo va a logs del servidor: conteos, modelo esperado/
unexpected, tier default/unexpected y motivo. Sin usuario, prompt, claves, JWT ni respuesta.
Si llega usage superior, no se recorta a la reserva. Se rechaza la propuesta y se conserva
usage; un recibo incoherente requiere conciliación. `estimated_cost` de Basic sigue siendo
la estimación histórica a tarifa nominal, NO una factura certificada ni un nuevo ledger P1.
En especial, tier inesperado o caché incoherente no permiten tratar esa estimación como coste
real: conservar el recibo saneado, detener el ensayo y contrastar el proveedor antes de limpiar.

## Referencias iniciales y actualización del 27/10

- PR #2 al iniciar el despliegue: draft, remoto `16ae3f64f835c56551656764b074288ebdec2f0b`; local equivalente `8078440d8c69490a430959e10ab580c2c5870c40`.
- Main: `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663`.
- PR #1: draft, `81fe65f4b9b5a9b7c3d905c2ea3c432f8ef5d839`. Ambas intactas.
- Staging ACTIVE_HEALTHY; Edge `simple-coach-mock` pasó de v31 a v32 ACTIVE, verify_jwt=true. Su nombre histórico no implica que sea un mock: llama a Responses cuando hay acceso autorizado.
- Contrato, proveedor y catálogo desplegados iguales al checkout salvo dos saltos finales de línea. Entry point difiere exclusivamente en orígenes CORS adicionales ya existentes de staging: NO sobreescribirlo con el local.
- Modelo fijo permitido por Edge y claim SQL: `gpt-5.4-2026-03-05`. Un override de COACH_OPENAI_MODEL diferente se rechaza antes de invocar al proveedor; no se leyó ese secret.
- Contrato `basic-initial-v5`, intake `basic-intake-v2`, propuesta expandida schema_version=2; reasoning=low; store=false; JSON Schema strict; sin tools ni conversación.
- OPENAI_API_KEY se lee exclusivamente en Edge y se usa en Authorization servidor→api.openai.com. No llega al frontend. No se leyó su valor ni se llamó al proveedor.
- **La existencia/validez actual del secret no está certificada**: el conector disponible no ofrece inventario de secrets, y el código fuente no prueba presencia en runtime. La futura comprobación de conteo en servidor permitiría confirmar autenticación, no garantizar por sí sola saldo/permisos de generación.
- pilot_config={} y reviewer_config={}; review_required=true; training_intakes=0 y coach_operations=0.

No se reejecutaron las 21 pruebas JWT históricas. El preflight nuevo es local, sin red ni modelo: valida la anamnesis, construye el request V5, comprueba exclusiones/días/material implícito en catálogo y contrasta las fuentes desplegadas. Resultado final PASS. Una primera comparación se detuvo por saltos de línea finales; se inspeccionó esa diferencia antes de admitir exclusivamente whitespace final. No se relajaron los controles de producto.

## Financial P1: alcance real

Lectura actual, sin modificar:

| Scope Premium | Switch | Llamadas usadas / máximo | USD cargado / máximo | Reservado |
|---|---|---|---|---|
| Análisis | off | 23 / 26 | 0.4281545 / 0.544317 | 0 |
| Chat | off | 27 / 30 | 0.3448175 / 0.45 | 0 |
| Inicial Premium | off | 4 / 4 | 0.197165 / 0.197165 | 0 |

Shared y Premium master: off. Shared máximo: 56 llamadas / 0.970137 USD.
Estos límites **no son crédito disponible para Basic**.

Basic usa reserve_basic_generation → coach_backend_claim → generate → coach_backend_finish.
No reserva dinero en esas tablas Premium ni invoca su guard de incidencias.
Su coste es un estimated_cost derivado de usage. El finish es inmutable/idempotente,
pero admite metadatos históricos de hasta 2 intentos y tokens hasta 1.000.000;
eso no es un control de entrada o una reserva monetaria de 5.120 tokens.
No reinstalar ni modificar Financial P1 para esta prueba.

## Solicitud única propuesta

Cuenta propietaria sintética ya existente: mock, UUID
`c7bbe50b-d349-4f7e-8fdc-476f17c22674`, client.
Reviewer sintético existente: `6b47ae02-6574-46db-acdb-f00925efdd74`.
Otro client y trainer del ensayo anterior solo para lecturas negativas, sin permisos nuevos.
No cuentas reales; no nuevas cuentas; no cambio de roles.

Entrada exacta en [basic-real-intake.json](basic-real-intake.json):

- Adulto ficticio; 1–2 años de entrenamiento.
- Ganar masa muscular de forma equilibrada.
- 3 días: lunes, miércoles y viernes; 60 minutos cada día.
- Normalmente puede estimar RIR.
- Running los domingos. No se conoce duración/intensidad: no inventarlas.
- Excluye Dead bug y Bird dog.
- Material: press horizontal, jalón, remo con pecho apoyado, prensa 45º, extensión de cuádriceps, curl femoral sentado, gemelo sentado, mancuernas, banco y poleas.
- Sin nombre/email/UUID en el prompt; sin salud, texto libre, puntos débiles ni ejercicios elegidos para incluir.
- Se envían instrucciones V5, proyección de entrenamiento, días ordenados, 26 ejercicios permitidos con atributos deportivos y schema. Inventario es disponibilidad, no preferencia.

Petición final preparada: 10.467 bytes UTF-8 (NO tokens).
SHA256: `919ab89f39d8178761401c0dfcf9ac1c6245dfcedf62f3cd48d55898d7f521df`.
Incluye service_tier=default y truncation=disabled. Se congela antes del conteo; las dos
peticiones usan exactamente el mismo input, instrucciones, reasoning y text/schema.
El endpoint de conteo no recibe store, max_output_tokens ni service_tier porque no forman
parte de sus parámetros de entrada documentados. El hash cambia si cambia cualquier campo
del cuerpo final; revalidarlo antes de activar. No se acepta body/modelo/presupuesto del cliente.

## Límites originales y protección desplegada

Referencia histórica de v31, anterior al guard (NO describe los límites actuales de v32):
- Un único fetch al proveedor por claim. Cero retry automático, incluso 429, timeout o respuesta incompleta.
- max_output_tokens=5120, incluyendo razonamiento. Timeout cliente 90 s; lease del claim 110 s.
- Un claim bajo lock por operación; generación marcada antes del envío. Una operación raíz consume el límite aunque falle.
- Clave de idempotencia exacta y owner/intake; un reintento requiere autorización explícita del reviewer.
- Finish duplicado no reemplaza usage ni propuesta.
- NO max_input_tokens antes del fetch; NO service_tier explícito; NO límite USD por request Basic.
- Timeout/abort no demuestra que OpenAI no haya procesado/cobrado. No relanzar ni registrar coste cero por ausencia de recibo.

Tarifas oficiales verificadas GPT-5.4 estándar: input 2,50; cached 0,25; output 15 USD/millón.
Referencia aritmética orientativa: input 3.000–5.000 y output 1.500–3.000 → 0,0300–0,0575 USD.
No es medición ni promesa de calidad/consumo.
El proxy bytes+4096 del cuerpo final da 0,1132075 USD; **NO es un conteo exacto ni un techo demostrado**.

**Protección desplegada en v32; su camino al proveedor aún no se ha ejecutado.**
1. Snapshot exacto de v31 y CORS conservados. V5 y SQL/RLS/Financial P1 sin cambios.
2. El guard acota proyecto staging, modelo/contrato y parámetros fijos. Owner/intake/clave
   pertenecen al manifiesto del runner y a la autorización SQL existente: no se incrustan
   UUID privados en código público. El runner permite solo ese envío; ambos accesos temporales
   continúan apagados hasta la autorización. No permitir otros modelos ni datos.
3. Tras claim único, leer la clave en memoria del servidor. Si ausente: parar sin generación.
4. Rechazar primero JSON final >16.384 bytes UTF-8. Contar una sola vez el input completo, incluidos instrucciones/schema, con
   POST /v1/responses/input_tokens. Sin retries, sin tools, sin generación.
   Timeout de conteo 10 segundos dentro del timeout global de 90; respuesta máxima8.192 bytes.
   Si el endpoint no soporta el modelo/payload o no devuelve entero positivo fiable: detenerse.
5. Rechazar input >12.000; congelar el mismo body para generar, service_tier=default,
   max_output_tokens=5120 y store=false. Verificar que el preflight cuenta exactamente ese input/schema.
6. Como máximo UN POST /v1/responses; ningún segundo envío aunque falle.
7. Coste token máximo condicionado a tarifas estándar vigentes:
   (12.000×2,50 + 5.120×15)/1.000.000 = **0,1068 USD** sin caché.
   **0,12 USD no es un máximo facturable garantizado**. Una autorización posterior debe aceptar
   expresamente esta cota condicionada, sin elevar presupuestos de aplicación. Verificar también el tratamiento económico del endpoint
   de conteo antes de autorizarlo: no se ha acreditado aquí que sea gratuito; si tiene cargo
   adicional no acotable, no llamar. El guard NO lleva un presupuesto0,12 configurable:
   impone tamaño/tokens/modelo/tier/intentos, no el precio comercial ni impuestos.
   Con recargo regional hipotético10%, el componente token sería0,11748 USD. El código
   fija api.openai.com, no un endpoint regional; que Supabase esté en EU no demuestra por sí
   solo ese recargo. Verificar términos de la cuenta. Sin tools/búsqueda/archivos/imágenes,
   no hay llamadas a herramientas del modelo. Conteo, impuestos y consumo del hosting son
   conceptos aparte y no se afirman gratuitos. Sin descuento de caché en la cota.
8. No usar project budgets/avisos de gasto como prueba de hard cap por request.
   Esta es una cota técnica condicionada a conteo/precio/tier/provider, no un stop de facturación
   de OpenAI a 0,12 USD. Si se requiere garantía contractual absoluta, no ejecutar.
9. Capturar provider response ID/request ID, usage/cache/output, modelo/tier, latencia y coste
   sin headers/clave. Si falta recibo o el coste verificado excede la cota, mantener incidencia
   documentada y bloquear manualmente todo nuevo intento; jamás recortar un coste real.
10. Rollback exacto de v31 disponible si aparece una regresión. El cierre normal conserva v32;
    desactivar accesos no requiere desinstalar su protección.

El guard está **desplegado en staging; la rama del proveedor solo se ha probado offline**. `max_output_tokens=5120`
incluye razonamiento y formato invisible: puede producir `incomplete` antes del JSON entero.
La respuesta sintética offline prueba compatibilidad estructural, no que el modelo siempre
termine dentro del límite. Si se agota, se conserva consumo y se detiene sin retry ni subida.
No ejecutar el runner G/H antiguo: materializa sesiones y tiene otra autorización.
El runner SDK de cero llamadas tampoco puede ejecutarse sin adaptar expresamente su
allowlist a un único endpoint/clave; no quitar su bloqueo general sin límites sustitutos.

## Ejecución propuesta tras autorización

Preparar primero runner, SQL revisable y baseline; comenzar el reloj solo al activar.
Ventana máxima 60 minutos; generation_limit=1; reviewer solo lectura durante esta fase.
No autorizar retry, aprobar, aceptar ni crear rutina/workout/notas.

1. Revalidar proyecto/4 identidades sintéticas, configs vacías, 27 referencias originales,
   funciones/owner/ACL/security hash, scopes Premium y ausencia de actividad concurrente.
   Basic reviewer es global: exigir Basic intakes/ops/feedback/health ajenos vacíos y
   ninguna propuesta Premium inicial pendiente asignada al reviewer.
2. Preparar manifiesto NUEVO con UUIDs propios; nunca reciclar los de la prueba limpiada.
   Transacción acotada, advisory lock, lock_timeout=2s, statement_timeout=15s, precondiciones
   exactas: habilitar solo owner y reviewer hasta T+60, manteniendo resto de config/ACL.
   El límite es 1, no ampliación de un consumo existente. Si ya hay consumo/conflicto, parar.
3. SDK con JWT real solo en memoria. Consentimiento sintético training-only
   pilot-supervised-v2 + guardar una intake exacta. No precrear la operación ni la propuesta:
   la Edge debe registrar por el flujo real. Máximo tres filas Basic: grant, intake, operation.
4. Una única invocación Edge con intake_id y key congelados. Bloquear todas las demás
   Edge, mutaciones fuera de allowlist y los RPC de retry/approve/accept/workout.
   Registrar la intención de dispatch en recibo privado antes de enviar. Tras pérdida
   de respuesta: solo leer/reconciliar la operación; ni borrar lock ni repetir solicitud.
5. El servidor realiza como máximo un conteo y una generación bajo el guard anterior.
6. Leer por SDK la operación y su proposal/usage. Comparar con conteo/coste y validar V5.
   Estado de éxito exigido pending_review, review_required=true, routine_id vacío.
7. Reviewer lee proyección segura y se entrega propuesta íntegra con evaluación. Nadie
   aprueba/acepta automáticamente. Una rutina estructuralmente válida aún necesita juicio humano.
8. Desactivar owner/reviewer pronto, conservar v32 salvo regresión y conservar recibo privado
   sanitizado. Ante incertidumbre upstream no limpiar hasta reconciliar; no borrar evidencia.
   El cierre de whitelist impide nuevos claims, pero no cancela una solicitud ya enviada.

## Aprobación estructural y deportiva

Rechazo técnico: modelo/versión/intake incorrectos; status no completed; JSON incompleto;
schema extra/inválido; ejercicio fuera de catálogo/material/exclusiones; duplicación dentro
del día; día/número incorrectos; sets/series no coincidentes; targets sin enteros o fuera de
rango; legacy projection distinta de primera serie; esquema top/backoff incoherente;
duración calculada >90% de 60 min; grupo principal ausente pese a material disponible.
Ejecutar decodeOutput y reviewProposal actuales, sin editar la respuesta para que pase.

Por ejercicio: 1–4 series, reps por familia dentro de 5–20, RIR 0–4, descansos 60–300s,
serie numerada y estructura íntegra. Guardar y mostrar todas las advertencias.
No confundir bounds técnicos con programación apropiada.

Informe humano requerido:
- Series directas y secundarias separadas por músculo/semana; frecuencia y patrones.
- Series/ejercicios por sesión, tren inferior/superior, pequeños músculos y abdomen.
- Objetivo orientativo intermedio 6–14 series directas/grupo, no mínimo universal;
  revisar >18, grupos con una sola exposición o cobertura desproporcionada.
- Coherencia 1–2 años, RIR habitualmente 1–2; RIR0 selectivo, no obligación.
- Aislamientos 1,5–2,5min, máquinas/moderados 2,5–3, alta demanda 3–4; hasta5 cuando
  se justifique. Respetar calidad antes que comprimir descansos para meter volumen.
- Tiempo fórmula V5: 5min + 2min/ejercicio + trabajo y descansos por serie, ajustando
  unilateral. Objetivo <=48min; 48–54 warning; >54 rechazo en este caso.
- Running domingo: revisar recuperación hacia lunes sin inventar intensidad. La guardia
  actual detecta mismo día/víspera, no demuestra ausencia de fatiga el día posterior.
- Sin preferencia inventada por disponer de material; repeticiones razonadas entre días,
  no duplicados redundantes; exclusiones exactas respetadas.
- Progresión: la app añade la instrucción determinista V5: progresar cada serie/bloque,
  al techo de reps con técnica/RIR previstos aumentar ligeramente carga; sin automatismos.
- Mantener warnings de descanso, fallo costoso, variedad, deporte/cobertura.
  Warning no significa rechazo automático; no ocultarlo ni corregirlo silenciosamente.

## Limpieza exacta y trazabilidad

No reutilizar create/cleanup del ensayo mock: esperan pending fixture presembrada y costes0.
Adaptar para esta operación real sin routine/revision/workout/notes creados.
Preparar/revisar SQL antes de activar; ejecutarlo solo con los UUID obtenidos del SDK/Edge:
1. Guardar recibo privado de operación/modelo/prompt/usage/coste/estado y propuesta para
   revisión humana. Sin tokens, secrets o PII. El gasto real sigue siendo gasto tras limpiar.
2. Verificar configs desactivadas, ausencia de llamada en vuelo, operation owner/intake/key,
   grant exacto, estado reconciliado, routine_id nulo, ningún hijo/referencia externo.
   Si falta un ID, recuperarlo por relaciones exactas; nunca por LIKE/email/fecha aproximada.
3. Transacción con precondiciones de baseline y locks: DELETE de la operación exacta,
   luego intake y grant exactos; rowcount esperado1 por cada existente. Rollback ante diferencia.
   Ni TRUNCATE, ni borrado por usuario, ni datos preexistentes.
4. Comparar 27 referencias, funciones/ACL/owner/policies y ambos configs originales.
   Auth estable excluye timestamps normales de login. Invalidar/cerrar solo sesiones de prueba.
5. Financial P1 debe permanecer idéntico; no poner a cero contabilidad ni presupuestos.
   Conservar el recibo real aparte de fixtures aunque la fila Basic se elimine.
6. Si el guard futuro necesitase ledger persistente, definir su conservación antes de ejecutar:
   nunca borrarlo para aparentar gasto cero. Esta propuesta no autoriza crear ese ledger.

## Pendiente de autorización / bloqueo concreto

- El deployment staging ya está autorizado, aplicado y verificado. Falta autorizar una única
  intake sintética, ventana owner/reviewer de hasta 60 minutos, un conteo y como máximo una
  generación sin reintentos, con condiciones económicas anteriores y limpieza exacta por UUID.
- Confirmar presencia runtime y autenticación de la credencial en ese preflight; saldo/acceso
  al modelo solo se confirman con el resultado real, nunca con un mock.
- No hay garantía USD actual suficiente para llamar a la Edge tal como está bajo un
  hard cap de 0,12. No ejecutar usando únicamente la estimación por bytes.

El único cambio de runtime es la capa de protección exclusiva de staging y su enlace en
el entrypoint. Se desplegó v32 y se usó una sesión sintética existente para probar denegación,
cerrándola después. Sin merge, activación ni escrituras de negocio. Las 27 referencias de
integridad y los catálogos de seguridad coinciden antes/después. Cero llamadas OpenAI;
producción no se ha tocado. El coste del hosting no se presenta como una factura verificada.

Fuentes oficiales consultadas:
- https://developers.openai.com/api/docs/models/gpt-5.4
- https://developers.openai.com/api/docs/guides/reasoning
- https://developers.openai.com/api/docs/guides/token-counting
