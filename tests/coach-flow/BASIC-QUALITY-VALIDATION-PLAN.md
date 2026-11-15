# Basic V5 — Plan de validación de calidad con cuatro perfiles

Preparado el 30/10/2026 sobre PR #2 fdf73b193e6f448136fa167ac91d9b2b6249c911.
Estado: PREPARADO OFFLINE; ninguna generación de esta batería está autorizada.
Cada caso requiere autorización expresa independiente y un cierre verificado antes
del siguiente. Este documento no activa usuarios ni concede permiso de ejecución.

## Base verificada y alcance de la evidencia

Lecturas actuales: SIMPLE Security Test, dmqjexigdnfzobarhnib; simple-coach-mock
v33 ACTIVE, verify_jwt=true, bundle
0de5d740f29f5615cfea2e1678f95f25f7528d6bea996e50ee1e5e543e3f4c20.
Sus diez dependencias distintas del entrypoint coinciden con la rama normalizando
CRLF y fin de archivo. El entrypoint conserva su configuración staging propia.
No se propone volver a desplegar ni reemplazar CORS.

Basic/reviewer config vacíos, cero operaciones y cero intakes Basic.
La definición actual de get_coach_review_queue confirma alcance GLOBAL: tras
is_reviewer(auth.uid()), proyecta operaciones ajenas con consentimiento válido;
no filtra por asignación reviewer→propietario/operación ni solo por pending_review.
Esta lectura no equivale a una nueva prueba JWT ni a repetir las 27 referencias.
Su comprobación completa se hará de nuevo justo antes de cada ensayo autorizado.

Main permanece 0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663; PR #1 draft intacta
81fe65f4b9b5a9b7c3d905c2ea3c432f8ef5d839. PR #2 permanece draft.

## Perfiles y representabilidad

| Caso | Experiencia/esfuerzo | Objetivo | Días y minutos | Material | Exclusiones | Actividad | Pregunta principal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | lt6 / unknown | balanced_mass | martes y viernes, 30 | mancuernas y bandas | pushup | none | ¿Prioriza aprendizaje y trabajo general dentro de poco tiempo? |
| B | y1_2 / confident | balanced_mass | martes/jueves/sábado, 60 | todo el inventario V5, 39 elementos | bar_squat | none | ¿Selecciona entre alternativas sin confundir disponibilidad con preferencia? |
| C | gt4 / habitual | balanced_mass | lunes/martes/jueves/viernes, 75 | todo el inventario V5, 39 elementos | ninguna | none | ¿Distribuye fatiga y volumen en cuatro días sin imponer fallo/variedad? |
| D | y1_2 / learning | regain_mass | martes/viernes, 45 | 8 elementos, detallados en JSON | dead_bug, bird_dog | football jueves/sábado | ¿Prioriza retorno y tiempo sin inventar carga del fútbol? |

**Limitación A:** 35–40 minutos NO es representable. El cuestionario admite
30/45/60/75/90. Se fija 30 como variante conservadora que cabe dentro de ese tiempo,
sin afirmar equivalencia con una sesión de 35–40. No usar 45 para ampliar a escondidas
el tiempo disponible. La autorización futura debe identificar esta variante de 30.
El modelo no recibirá el texto “35–40”. Probarlo exactamente exigiría otro encargo.

Basic solo registra un tiempo común por sesión y un tipo de actividad con días.
No registra intensidad/duración de deporte, sueño, estrés, lesiones, edad exacta,
puntos débiles, días de descanso preferidos ni confianza numérica de RIR.
No rellenar esos datos, inferirlos del objetivo o añadir campos Premium.
Para D, regain_mass es el objetivo sintético; no demuestra desentrenamiento medido.

Las anamnesis exactas están en basic-quality-profiles.json. Solo su objeto training
se envía al flujo; id y label son metadatos locales y nunca instrucciones al modelo.
El inventario B/C enumera todos los IDs, sin campo inventado “full gym”.
A/B/D excluyen ejercicios por ID; no eligen qué incluir. No hay datos personales,
salud, texto libre ni equipamiento personalizado.

## Comprobaciones offline ejecutadas

Comando sin red ni credenciales: node tests/coach-flow/basic-quality-offline.cjs.
18/18 casos: cuatro por perfil (esquema, catálogo/cobertura disponible, petición
final y contexto/schema de ejercicios) y dos casos negativos de representabilidad.
No se ejecutaron suites antiguas ni se generó una rutina de ejemplo para pasar tests.

| Caso | Bytes UTF-8 petición final | Ejercicios disponibles | Proxy entrada ceil(bytes/4), NO conteo |
| --- | ---: | ---: | ---: |
| A | 9296 | 19 | 2324 |
| B | 15192 | 59 | 3798 |
| C | 15334 | 60 | 3834 |
| D | 10181 | 24 | 2546 |

Todos pasan safetyGate y tienen al menos una opción para cada grupo principal y
zona media. El schema solo permite ejercicios disponibles no excluidos. Esto prueba
viabilidad de ENTRADA, no que la respuesta futura cumpla volumen/tiempo/calidad.
B/C dejan poco margen hasta 16384 bytes: cualquier cambio de fuente exige recomponer
y verificar la petición, sin recortar prompt o catálogo para hacerla caber.

SHA-256 del cuerpo final, con el orden de propiedades de los JSON versionados:
- A: b589409a7f668fc337c04e5cd6ce7dbffff5f2dcc57c79ba4046cb9ff12be535
- B: 58250f060ebd355cbb459a09ffec8cab37ff65bf066454bc2f8a46cfe68e766e
- C: 5e00a84a30ed1e7052f1b7f4e91faa8361c0f75d625b94c588e5dcde63562dd5
- D: 6489a313251344e3d9a5ba4ae20e8ac7f7e4dd354375bb038ef7eb767ba16d3d

El recuento real de entrada queda DESCONOCIDO hasta una llamada autorizada al
endpoint de conteo. El proxy por bytes no prueba estar por debajo de 12000 tokens.
La ruta SDK/SQL puede reordenar claves JSON; antes del envío se registrará el hash
del cuerpo REAL y se comprobará equivalencia semántica con el perfil aprobado.
Una diferencia de contenido implica detenerse; un cambio de serialización se
documenta y no se confunde con otra anamnesis.

## Rúbrica previa y reproducible

Evaluar la respuesta original, sin editarla, con el mismo contrato/evaluador v33.
Dos capas: validación estructural automática y juicio deportivo humano. Conservar
todos los warnings. Un warning aislado no es un suspenso ni una orden de corregir.

Para cada dimensión usar:
- 2 = adecuado: evidencia concreta en ejercicios/series/días justifica la decisión;
- 1 = mejorable o incertidumbre: precisar alcance, alternativa y qué falta saber;
- 0 = problema deportivo importante: explicar contradicción concreta con los datos.
- ND = no determinable: señalar el dato ausente, sin convertirlo en cero.

No aprobar por suma global: un problema importante sin resolver deja el caso en
HOLD aunque otros apartados puntúen bien. No hay nota de corte ni promedio que
compense un defecto grave. Registrar decisiones igualmente válidas como adecuadas,
no penalizarlas porque el evaluador preferiría otra distribución.

| Dimensión | Evidencia a registrar antes de asignar 0/1/2/ND |
| --- | --- |
| Objetivo y experiencia | Complejidad, repetición útil, margen RIR y volumen coherentes con los códigos recibidos; conservación o especialización justificadas. |
| Días/tiempo/material | Días exactos, series y transiciones, estimación V5 y margen; cada requisito de material y exclusión comprobado por catálogo. |
| Ejercicios/patrones | Inventario de rodilla, cadera, empuje, tirón y core; complementación, redundancias y coste técnico. No exigir cada patrón en cada sesión. |
| Volumen muscular | Por grupo: directas, secundarias y días de cada una, con atribución del catálogo; nunca sumar ambas como equivalentes. Señalar solapamientos. |
| Frecuencia/distribución | Exposiciones semanales, días consecutivos, sesión más cargada, reparto superior/inferior; ninguna frecuencia universal obligatoria. |
| Reps/RIR/descansos | Todas las series, familia, demanda, estabilidad, RIR0 y coste de fatiga; descansos no recortados para ocultar exceso de volumen. |
| Actividad externa | Relaciones mismo día/víspera/día posterior con vuelta domingo→lunes; describir incertidumbre, no inventar carga ni afirmar riesgo inevitable. |
| Progresión/seguimiento | Claridad de objetivos por serie, esquema y consejo fijo V5; posibilidad de registrar cargas/reps y comparar. No exigir funciones que Basic no ofrece. |
| Revisión humana | Warnings, incertidumbre, datos pendientes y gravedad; no tratar metadatos heurísticos como mediciones fisiológicas. |
| Personalización | Para cada dato de entrada indicar efecto observado o ausencia de efecto explicable; no exigir ejercicios únicos para demostrar personalización. |

Tabla muscular obligatoria: pecho, espalda, espalda alta (subconjunto, no sumar dos
veces), cuádriceps, femoral, glúteos, deltoides por regiones cuando el catálogo lo
permita, bíceps, tríceps, gemelos y zona media. Para cada grupo: directas, secundarias,
frecuencia directa/secundaria y ejercicios de origen. Si un reparto anatómico no
está codificado, marcar ND en vez de repartir series por intuición. Informar también
series totales/sesión y semana, ejercicios/sesión, patrones y relación superior/inferior
explicando ejercicios que trabajan más de una zona.

### Clasificación de hallazgos y decisión

- ESTRUCTURAL: JSON incompleto, status no completed, contrato/modelo incorrecto,
  días erróneos, ejercicio fuera de catálogo/material o excluido, proyección por serie
  incoherente, duplicado dentro de un día, fallo real de reviewProposal.
  Rechazar el artefacto para aceptación; conservar respuesta/coste; cero reintentos.
- DEPORTIVO IMPORTANTE: estructura válida pero contradicción importante demostrada
  (p. ej., dificultad/fatiga inadecuada para esfuerzo desconocido o prioridades
  claramente incompatibles con el tiempo). HOLD para juicio humano, no reparación automática.
- MEJORA MENOR: alternativa con beneficio limitado o más claridad de instrucciones;
  no invalida por sí sola.
- DECISIÓN IGUALMENTE VÁLIDA: split, selección o dosis razonable aunque diferente de
  la preferencia del reviewer; no defecto.
- INCERTIDUMBRE: datos insuficientes para atribuir fatiga o valorar seguimiento;
  registrar qué preguntar después, sin fabricar la respuesta.

No usar mínimos universales de series, aislamientos obligatorios ni obligación de
RIR0 en avanzados. Una rutina conservadora puede ser adecuada si responde al caso.
Las reglas duras que YA contiene V5 se registran como resultado del contrato,
sin presentarlas como leyes fisiológicas ni cambiarlas durante la evaluación.
El límite estructural actual de tiempo es >90% del tiempo disponible: A >27,
B >54, C >67,5 y D >40,5 minutos. Es una estimación V5, no cronometraje real.
Reportar la duración incluso si resulta conservadora y registrar sensibilidad
a tiempos de transición/material no conocidos.

## Criterios específicos predefinidos por caso

A — Aprobar deportivamente si cubre entrenamiento general con aprendizaje, material
válido, baja complejidad justificable y margen acorde con esfuerzo unknown.
Repetir ejercicios entre días puede ayudar y no resta puntos. Revisar comprensión de
RIR y progresión antes de un piloto con personas. HOLD si la calidad depende de
fallo sistemático, excesiva complejidad o volumen comprimido; registrar por separado
cualquier fallo estructural V5. No exigir aislamiento de brazos para “completar”.

B — Aprobar si la selección aprovecha alternativas útiles sin convertir el inventario
completo en preferencia, conserva hipertrofia equilibrada y respeta bar_squat excluido.
Comparar pequeñas zonas directas/secundarias, pero no imponer un reparto concreto.
HOLD si concentra trabajo redundante y desplaza grupos relevantes sin explicación
o exige tiempo/material incompatible. Full body o un reparto alternativo pueden ser válidos.

C — Aprobar si distribuye cuatro sesiones y días consecutivos de manera coherente,
explica cercanía al fallo mediante ejercicio/estabilidad y deja objetivos registrables.
Ni RIR0 ni técnicas variables son obligatorios; tampoco todo debe ser distinto.
HOLD si acumula fatiga elevada en lunes/martes o jueves/viernes sin una lógica
defendible, o prescribe fallo indiscriminado sin margen. Exponer cada serie RIR0
y distinguir aislamiento, máquina estable y ejercicio de alto coste, sin umbral inventado.

D — Aprobar si prioriza el objetivo regain_mass y sesiones limitadas, conserva
descansos y permite revisar el viernes situado después del fútbol del jueves y antes
del sábado. No consta intensidad/duración de fútbol ni recuperación real.
HOLD si necesita asumir fútbol suave/duro para justificar su distribución, o si
la dosis y concentración de fatiga solo son defendibles bajo esa suposición.
Pedir revisión humana de tolerancia; una proximidad temporal por sí sola no invalida.
No cambiar días disponibles ni readmitir Dead bug/Bird dog.

## Límites técnicos, precios y presupuesto condicionado

Modelo fijo gpt-5.4-2026-03-05, contrato basic-initial-v5, reasoning low.
Límites actuales del guard v33:
- Cuerpo final UTF-8 <=16384 bytes.
- Entrada <=12000 tokens, solo comprobable por conteo real previo.
- Salida <=5120 tokens, incluyendo presupuesto de razonamiento y texto; puede
  producir respuesta incompleta, especialmente con cuatro días. No se ampliará.
- service_tier=default, truncation=disabled, store=false, sin herramientas.
- Un conteo y como máximo una generación por claim autorizado; cero reintentos.
  La protección local consume el intento antes de esperar respuesta; la reserva SQL
  mantiene idempotencia entre instancias. No equivale a presupuesto global de cuatro casos.
- Errores, timeout, respuesta incierta o recibo incoherente requieren recuperación
  de lectura/conciliación; nunca volver a enviar para “ver si funciona”.

Tarifas oficiales consultadas 30/10/2026: entrada 2,50 USD/M, caché 0,25 USD/M,
salida 15 USD/M; cálculo conservador sin descuento de caché. No usar Batch/Flex.
Techo CONDICIONADO de tokens por generación:
(12000 × 2,50 + 5120 × 15) / 1000000 = 0,1068 USD.
Cuatro casos = 0,4272 USD, únicamente si los cuatro se autorizan por separado.

Escenarios de planificación, NO predicciones ni límites: entrada proxy bytes/4,
salida supuesta según extensión. La primera rutina real tuvo 2454/2050 tokens,
pero una única muestra no permite extrapolar tamaños con confianza.

| Caso | Salida supuesta, tokens totales | Coste escenario USD | Máximo condicionado estándar USD |
| --- | ---: | ---: | ---: |
| A | 1300–2300 | 0,025310–0,040310 | 0,1068 |
| B | 2000–3300 | 0,039495–0,058995 | 0,1068 |
| C | 2700–4500 | 0,050085–0,077085 | 0,1068 |
| D | 1300–2600 | 0,025865–0,045365 | 0,1068 |
| Total hipotético | — | 0,140755–0,221755 | 0,4272 |

No hay techo monetario contractual garantizado. No está acreditada la facturación
independiente del endpoint de conteo, el contrato/saldo/impuestos de la cuenta ni
cargos de hosting. El guard no convierte una estimación en límite del proveedor.
Con recargo regional del 10%, los máximos de tokens serían 0,11748 por caso /
0,46992 total; el endpoint configurado es api.openai.com, no se ha habilitado uno
regional. Si cambia modalidad/tarifa o aparece un cargo inesperado, detenerse y
revisar autorización. El umbral de contexto largo >272k no corresponde al límite
de entrada de este ensayo. No se han consultado endpoints de la API para facturación
ni para conteo.

Fuentes oficiales:
- https://developers.openai.com/api/docs/models/gpt-5.4
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/token-counting
La página de conteo no se presenta como prueba de gratuidad; la tarifa del conteo
continúa sin certificarse. No leer claves para esta preparación.

## Ejecución futura: una autorización y un caso a la vez

1. Seleccionar A/B/C/D y aprobar su JSON/hash, variante temporal, máximo un conteo/
   una generación, riesgo de facturación y ventana owner/reviewer <=60 minutos.
   Reutilizar las identidades sintéticas existentes del plan anterior; verificar
   UUID/rol y proyecto desde las evidencias privadas, sin crear cuentas nuevas.
2. Preparar runner, sesiones en memoria, SQL exactos de activación/desactivación y
   limpieza antes de empezar el reloj. No ejecutar scripts históricos sin adaptar:
   el runner real antiguo fija intake/hash del primer ensayo y no sirve tal cual.
   La operación debe crearla la Edge real, nunca sembrarla para simular generación.
3. Capturar las 27 referencias y catálogo de seguridad, funciones/owners/ACL.
   Configs vacíos; sin operaciones/intakes/feedback/salud Basic ajenos, sin cola
   Premium ajena accesible ni actividad de otros escritores. Verificar ausencia de
   nuevos grants/configs concurrentes y comprobar idempotencia/kill switches vigentes.
   Un sondeo SQL no garantiza exclusión de actividad futura: exigir ventana staging
   exclusiva coordinada; si no puede garantizarse, NO habilitar reviewer global.
4. Guardar recibo local privado del caso con UUID nuevos de run/key. Habilitar
   únicamente owner/reviewer sintéticos autorizados; SDK sin persistencia de tokens.
   Crear consentimiento e intake mediante el flujo normal, registrar UUID/versiones.
   No cambiar roles, RLS, cuotas, Financial P1 ni presupuestos.
5. Registrar intención ANTES del envío, mismo owner/intake/key. Una invocación Edge
   como máximo. Guardar contador y resultado del conteo; solo generar si pasa.
   No enviar directamente OpenAI desde frontend/runner ni aceptar parámetros del cliente.
6. Capturar respuesta original, response/request ID, modelo, tier, tokens entrada/
   caché/salida/razonamiento si existe, latencia y error sanitizado. Conciliar recibo
   contra conteo y límites. Separar coste calculado de factura confirmada.
7. Recuperar operación solo con lecturas autenticadas. Si propuesta válida, mantener
   pending_review; obtener proyección reviewer y aplicar esta rúbrica con evidencia
   por serie/día. No aprobar, aceptar, crear rutina o entrenamiento.
8. Cerrar accesos inmediatamente después de capturar evidencia. Cerrar ventana no
   cancela una petición ya enviada: confirmar fin/ausencia de llamada en vuelo.
   No iniciar el siguiente caso hasta cerrar íntegramente este.
9. Limpiar solo operación, intake y consentimiento exactos, con recibo reconciliado,
   igualdad de filas/referencias y transacción. Recuperar IDs por relaciones exactas;
   jamás borrar por email, fecha o patrón. Cero rutina/revisión/workout/nota esperados.
   Si hay referencias o coste sin conciliar, conservar evidencia, scopes off y detenerse.
10. Verificar las 27 referencias, funciones y seguridad, configs vacíos y cero
    operaciones/intakes pendientes. Conservar consumo real, recibos y auditoría;
    borrar la fixture no borra el gasto ni autoriza poner contabilidad a cero.

El caso siguiente requiere otra autorización; ni éxito ni fallo habilitan un reintento.
Ante pérdida de respuesta: no volver a invocar, consultar por propietario/intake/key.
Paradas adicionales: versión/hash diferente, permisos o datos ajenos, identidad
inesperada, body fuera de límite, conteo fallido/excedido, respuesta truncada,
recibo imposible de conciliar, escrituras concurrentes o limpieza insegura.

## Segmentación futura del reviewer: propuesta, sin SQL aplicado

Modelo conceptual mínimo: asignación temporal gestionada por servidor con reviewer_id,
owner_id, operation_id y caducidad/revocación; operation_id debe pertenecer al owner
y a la versión/consentimiento vigentes. Cada RPC de cola, detalle y decisión comprobaría
la misma asignación y auth.uid(); métricas/feedback también quedarían limitados a ese
scope, para no conservar vías laterales globales. No confiar en IDs enviados por
frontend ni conceder lectura REST de intakes/operaciones/revisiones privadas.

Probar posteriormente con JWT: asignado permitido para una operación; mismo owner
otra operación, otro owner, otro reviewer, trainer, client y anon denegados;
caducidad/revocación y cambio de contexto respetados. Mantener las proyecciones sin
salud. Elegir tabla privada o registro de autorización equivalente tras revisión
arquitectónica y autorización separada. No se ha creado ninguna tabla/policy/RPC.

La secuencia aislada actual sirve solo para estos ensayos sintéticos. No demuestra
que los permisos actuales estén segmentados para pilotos simultáneos con clientes.

## Plantilla obligatoria de evaluación de cada respuesta real

- Caso, hash de training/cuerpo real, versión Edge/contrato/evaluador y estado de operación.
- Intentos autorizados/enviados, conteo, response ID y usage; coste calculado/factura/ND.
- Rutina íntegra por día: ID/nombre de catálogo, esquema y cada serie/reps/RIR/descanso.
- Duración estimada y margen, ejercicios/series por sesión y semana.
- Tabla de músculo directo/secundario/frecuencias y patrones sin doble contabilización.
- Diez dimensiones de rúbrica con puntuación o ND, evidencia y severidad de hallazgos.
- Matriz dato de entrada → efecto observado → justificación o limitación.
- Warnings originales íntegros, diferencias respecto al primer caso y alternativas válidas.
- Veredicto humano: ADECUADA / HOLD / RECHAZO ESTRUCTURAL. Actor/fecha/motivo;
  el veredicto documental no ejecuta aprobación en la aplicación.
- Recibo de cierre/limpieza/integridad y pendientes. Nunca ocultar muestras fallidas.

No concluir preparación comercial a partir de cuatro éxitos. Registrar desacuerdos
de evaluación, patrones de fallos y cobertura no probada antes de decidir si procede
un piloto supervisado con personas. Las cuatro respuestas siguen pendientes.
