# Basic V5 — perfil D: generación real, fútbol y cierre de batería

Ensayo 01/11/2026, Europe/Madrid. Solo SIMPLE Security Test; PR #2 base 850832b836933b2816c53e207027c86292fa0e2c. Primera muestra/A/B/C no repetidos. No ensayos adicionales.

## Dictamen documental

**HOLD para revisión humana de recuperación y distribución del viernes.** V5 estructuralmente válido, sin rechazo técnico. Dictamen asistido por IA; no aprobación, aceptación ni bloqueo nuevo en producto.

14 series a RIR 3 y una dosis inicial conservadora son compatibles con learning/regain_mass. Sin embargo, toda la exposición femoral directa (RDL 2 +curl 1) está el viernes, entre fútbol jueves y sábado. No conocemos duración, intensidad, horarios ni recuperación. No se afirma daño, interferencia inevitable o volumen excesivo. Para aceptar esa distribución como adecuada para una persona concreta hace falta comprobar la carga y la tolerancia de la cadena jueves→viernes→sábado, en lugar de asumir fútbol suave o duro. No es HOLD por faltar aislamientos ni una regla automática para todo deporte cercano.

El evaluador solo señala la relación posterior al jueves; no muestra la relación previa al sábado porque exige más de 4 series inferiores en su regla de víspera. D tiene 3, aun siendo su sesión inferior más cargada. Esta limitación de cobertura del aviso está demostrada; no se cambió la regla.

## Petición, consumo y límites

| Campo | Evidencia |
|---|---|
| Edge | simple-coach-mock v33 ACTIVE, verify_jwt=true, sin redespliegue |
| Bundle SHA256 | 0de5d740f29f5615cfea2e1678f95f25f7528d6bea996e50ee1e5e543e3f4c20 |
| Modelo / contrato | gpt-5.4-2026-03-05 / basic-initial-v5 |
| Configuración | reasoning low; service_tier=default; store=false; truncation=disabled; sin herramientas |
| Cuerpo definitivo | **10181 bytes** de 16384; margen 6203 |
| Hash preparado | 6489a313251344e3d9a5ba4ae20e8ac7f7e4dd354375bb038ef7eb767ba16d3d |
| Hash efectivo congelado | 289ba78afd890d6bb36cde 49311fef10014db054d1133bd12795bce5e27582fe |
| Llamadas | **1 conteo + 1 generación**; cero reintentos |
| Conteo / entrada devuelta | **2381 /2381 tokens** |
| Salida / caché | **1581 /0 tokens** |
| Máximos intactos | 12000 entrada contada /5120 salida total incluido razonamiento |
| Recibo | HTTP 200; receipt_within_limits |
| Latencia del intento conteo/proveedor | **25597 ms**, sin desglose entre ambos |
| Latencia Edge /ida-vuelta SDK | **25600 /26280 ms** |
| Coste de tokens calculado | **0,0296675 USD** |
| Estado antes de limpiar | pending_review; no aprobación ni aceptación |

(2381 × 2,50 + 1581 × 15) /1000000 =0,0059525 + 0,023715 USD. Coincide con estimated_cost. Uso real devuelto por OpenAI, coste calculado a tarifa estándar; no factura/cargo certificado. Conteo separado, impuestos y términos particulares siguen sin acreditarse. No afirmar gratuidad ni techo contractual total.

[Tarifa oficial de GPT-5.4 consultada 01/11/2026](https://developers.openai.com/api/docs/models/gpt-5.4): entrada 2,50/caché 0,25/salida 15 USD por millón. Endpoint global api.openai.com sin selección regional; no modalidad inesperada detectada en configuración verificable. Máximo condicionado autorizado 0,1068 USD. El recibo retenido no desglosa razonamiento; no inventar su consumo.

Cambio de hash debido únicamente al orden de propiedades JSONB: igualdad semántica comprobada con perfil exacto antes del único dispatch. Sin recortar instrucciones, catálogo o contexto. Misma clave y una operación creada por la Edge auténtica. IDs de respuesta/petición/actores permanecen privados.

## Anamnesis exacta

experience=y 1_2; goal=regain_mass; effort=learning; days=2; weekdays=[tue, fri]; minutes=45; activity={type:football, weekdays:[thu, sat]}; excluded=[dead_bug, bird_dog].

inventory.equipment=[chest_press, pulldown, supported_row, press45, seated_curl, dumbbells, cables, bench]; inventory.custom=[]; schema_version=basic-intake-v2.

No duración/intensidad/horarios de fútbol, causas de retorno, salud, lesiones, edad, historial, cargas ni preferencias inventados. No sustituir45 minutos ni reinterpretar regain_mass como desentrenamiento clínico acreditado.


## Rutina original completa

Nombre: **Basic · rutina inicial**. Todas las series son straight. Se conserva la propuesta normalizada original de la Edge; sin editar output ni inventar cargas.

### Martes — 4 ejercicios, 7 series

| Orden | Ejercicio / ID | Serie | Reps | RIR | Descanso |
|---|---|---:|---|---:|---|
| 1 | Prensa de piernas / leg_press | 1 | 8–10 | 3 | 3 min |
| 1 | Prensa de piernas / leg_press | 2 | 8–10 | 3 | 3 min |
| 2 | Press de pecho en máquina / chest_press | 1 | 8–10 | 3 | 2,5 min |
| 2 | Press de pecho en máquina / chest_press | 2 | 8–10 | 3 | 2,5 min |
| 3 | Jalón al pecho / pulldown | 1 | 8–10 | 3 | 2,5 min |
| 3 | Jalón al pecho / pulldown | 2 | 8–10 | 3 | 2,5 min |
| 4 | Crunch en polea / cable_crunch | 1 | 12–15 | 3 | 1,5 min |

Estimación V5: **35 min 30 s**, mostrada 36 min. Margen hasta 45: 9 min 30 s. Series inferiores: 2.

### Viernes — 4 ejercicios, 7 series

| Orden | Ejercicio / ID | Serie | Reps | RIR | Descanso |
|---|---|---:|---|---:|---|
| 1 | Peso muerto rumano con mancuernas / db_rdl | 1 | 8–10 | 3 | 3 min |
| 1 | Peso muerto rumano con mancuernas / db_rdl | 2 | 8–10 | 3 | 3 min |
| 2 | Remo con pecho apoyado / supported_row | 1 | 8–10 | 3 | 2,5 min |
| 2 | Remo con pecho apoyado / supported_row | 2 | 8–10 | 3 | 2,5 min |
| 3 | Press de suelo con mancuernas / floor_press | 1 | 8–10 | 3 | 2,5 min |
| 3 | Press de suelo con mancuernas / floor_press | 2 | 8–10 | 3 | 2,5 min |
| 4 | Curl femoral sentado / seated_curl | 1 | 10–12 | 3 | 2 min |

Estimación V5: **35 min 48 s**, mostrada 36 min. Margen hasta 45: 9 min 12 s. Series inferiores: 3.

Instrucción original de la aplicación:

> El RIR es orientativo; conserva margen mientras aprendes a estimarlo. Progresa cada serie o bloque por separado: cuando alcances su techo de reps con el RIR indicado y técnica estable, aumenta ligeramente su carga. Ajusta la carga entre bloques si cambian los objetivos. No se automatizan pesos ni cambios de rutina.

Esta instrucción se incorpora determinísticamente al decodificar V5 según effort=learning; no es una explicación individual redactada por el modelo. No se conserva el sobre HTTP bruto ni el JSON compacto anterior a decodeOutput.

## Volumen y frecuencia

Atribución del catálogo V5: participación secundaria NO equivale a una serie directa. Las filas se solapan y no suman14. Espalda alta es subconjunto de espalda; regiones deltoideas ND. El fútbol NO se contabiliza como series de hipertrofia.

| Grupo | Directas | Secundarias | Frecuencia directa / secundaria |
|---|---:|---:|---|
| Pectoral | 4 | 0 | 2 / 0 |
| Espalda / dorsal | 4 | 0 | 2 / 0 |
| Espalda alta (subconjunto) | 2 | 0 | 1 / 0 |
| Cuádriceps | 2 | 0 | 1 / 0 |
| Femorales | 3 | 0 | 1 / 0 |
| Glúteos | 4 | 0 | 2 / 0 |
| Deltoides | 0 | 6 | 0 / 2 |
| Bíceps | 0 | 4 | 0 / 2 |
| Tríceps | 0 | 4 | 0 / 2 |
| Gemelos | 0 | 0 | 0 / 0 |
| Zona media | 1 | 2 | 1 / 1 |
| Aductores | 0 | 0 | 0 / 0 |

Patrones: squat=2; horizontal_push=4; vertical_pull=2; trunk_flexion=1; hinge=2; horizontal_pull=2; knee_flexion=1.

Inferior **5/14 (35,7%)**, superior **8/14 (57,1%)**, zona media **1/14 (7,1%)**, sin doble conteo. Martes2 inferiores+ 4 superiores+ 1 core; viernes3 inferiores+ 4 superiores.

## Warning original íntegro

**sport_after_activity**, Viernes, 3 series inferiores, relation=after, activity_day=thu:

> Tren inferior el día después de Jueves con Fútbol. No conocemos duración, intensidad ni carga; comprobar recuperación percibida y rendimiento esperado. La proximidad no demuestra interferencia ni riesgo y no exige cambiar la rutina.

## Diez dimensiones de la rúbrica

Escala original:2 adecuado,1 mejorable/incertidumbre,0 problema importante, ND no determinable. Sin suma ni promedio aprobatorio. HOLD se debe a una incertidumbre relevante que el reviewer debe cerrar, no a JSON inválido ni a certeza de daño.

| Dimensión | Nota | Evidencia y límite |
|---|---:|---|
| Objetivo y experiencia | 2 | 14 series semanales y RIR 3 como inicio conservador para regain_mass/learning. No se conoce volumen previo tolerado ni causa del retorno; no se prescribe rehabilitación. |
| Días, tiempo y material | 2 | Martes/viernes exactos,35:30/35:48 estimados,8 elementos disponibles y exclusiones respetadas. No colas o duración real medidas. |
| Ejercicios y patrones | 2 | Prensa, bisagra, flexión de rodilla, empuje horizontal, tirones vertical/horizontal y core. Complejidad del RDL requiere observar técnica, no invalida por sí sola1–2 años. |
| Volumen muscular | 1 | Dosis inicial2–4 directas grandes; brazos/deltoides solo secundarios, gemelos 0. Revisión de cobertura sin mínimos universales ni obligación de aislamiento. |
| Frecuencia y distribución | 1 | Pecho/espalda/glúteos dos días; cuádriceps/femoral uno cada uno. Tres series femorales el viernes frente a dos de prensa el martes: concentración que debe confrontarse con fútbol. |
| Reps, RIR y descansos | 1 | Todas RIR 3, sin fallo y8–15 reps; mínimos cumplidos. Trece de 14 series bajo preferido V5, aunque no activan aviso por RIR>1. Revisar rendimiento y calibración del esfuerzo. |
| Actividad externa | 1 | Viernes después del jueves y antes del sábado. Solo relación posterior advertida automáticamente; carga real ND. HOLD antes de aprobación para una persona. |
| Progresión y seguimiento | 2 | Series straight, objetivos repetibles y progresión gradual; RIR orientativo explícito. Incrementos concretos y evaluación de técnica no están individualizados. |
| Revisión humana | 1 | El reviewer ve contexto y un warning, pero debe advertir además la víspera y grupos pequeños sin confiar en el número de avisos. |
| Personalización | 2 | Menor dosis/esfuerzo que B/C, material y exclusiones exactos. No puede atribuirse causalmente cada elección al fútbol ni afirmar que el modelo optimizó recuperación. |

## Fútbol: las dos relaciones y la incertidumbre relevante

Calendario nominal: martes gimnasio → jueves fútbol → viernes gimnasio → sábado fútbol → martes gimnasio. No se conocen horas; “día anterior/posterior” no equivale a24 horas exactas.

- **Viernes después del jueves: ** sport_after_activity identifica correctamente3 series inferiores y pide comprobar recuperación; no inventa intensidad.
- **Viernes antes del sábado: ** relación real omitida del warning automático. La condición vigente es legSets>4 Y máximo semanal Y deporte al día siguiente. Viernes=3 y máximo=3; falla solo el umbral>4. No ausencia de relación ni prueba de irrelevancia.
- **No coinciden el mismo día: ** sport_same_day no procede. Tampoco se inventa otra actividad el martes.
- **Carga concentrada: ** viernes RDL 2+curl 1, las3 directas femorales semanales; martes prensa2, las2 directas de cuádriceps. RDL está catalogado de coste alto y complejidad alta, aunque prescrito a RIR 3. Dos series no prueban fatiga excesiva, pero el conteo bruto por sí solo no expresa recuperación o coste individual.
- Hay72/96 h nominales entre sesiones de gimnasio. Eso NO prueba recuperación de piernas cuando hay fútbol intercalado. No contar fútbol como sustituto equivalente de gemelos/femoral o “volumen completado”.
- Dosis baja y margen RIR son argumentos a favor, no una medición de cómo llega el viernes o necesita rendir el sábado. Antes de aceptar: conocer carga/hora de ambos días y recuperación percibida/rendimiento del viernes, más familiaridad con RDL y precisión del RIR. No pedir ni inventar datos de salud.
- **Decisión: ** HOLD documental hasta que el reviewer contraste esos datos. Si confirma buena tolerancia y compatibilidad, esta programación puede resultar adecuada sin cambios. Si no, decidir una redistribución dentro de los días autorizados en otra fase. Nada se ha cambiado ahora.

El warning no bloqueó pending_review. Ninguna regla nueva ni umbral ajustado para hacer pasar este caso. El defecto demostrado es información temporal incompleta en el aviso, no una rutina peligrosa demostrada.

## Descansos, esfuerzo y tiempo

| Ejercicio/familia | Series | Prescrito | Mínimo/preferido V5 | Observación |
|---|---:|---|---|---|
| Prensa +rumano mancuernas | 4 | 3 min | 3/4 min | reps_min8 activa referencia heavy; no demuestra una carga real “pesada”. |
| Press máquina, jalón, remo apoyado, press suelo | 8 | 2,5 min | 2,5/3 min | Margen nominal RIR 3; observar calidad siguiente serie. |
| Crunch polea | 1 | 1,5 min | 1,5/2 min | Accesorio, rango12–15. |
| Curl femoral sentado | 1 | 2 min | 1,5/1,5 min | Por encima de ambas referencias vigentes. |

**0/14 bajo mínimo,13/14 bajo preferido.** No hay short_rest. La regla rest_performance_review para compuestos bajo preferido exige RIR≤1; D usa 3. Por eso no avisa, no porque se haya alcanzado la referencia preferida. No se cambió evaluador.

Tiempo V5: 5 min iniciales + 2 min por ejercicio + 4 s por repetición máxima +descanso tras cada serie, incluida la última; sin unilateral. Martes35:30, viernes35:48 (36/36 mostrados). Márgenes hasta 45:9:30 y9:12. Ambas bajo80% exacto y bajo límite estructural40,5 min. No usar redondeo36 para inventar duración_80_90.

Sensibilidad offline, sin editar: llevar13 descansos al preferido añadiría 4:30 el martes y 4:00 el viernes; 40:00 y 39:48, bajo 40:30 pero con solo 30/42 s respecto al umbral estructural y5:00/5:12 hasta 45. No certifica viabilidad real de calentamiento/transiciones ni obliga a hacer ese cambio. Si falta tiempo real, priorizar revisión de dosis redundante antes que comprimir descansos.

RIR 3 homogéneo deja margen nominal y la instrucción reconoce learning. No es fallo automático de personalización. Un autoinforme learning no permite certificar que distingue3 de 1; verificar selección de carga/técnica antes de progresar. No hay RIR 0, técnicas intensivas ni necesidad de imponerlas a un intermedio.

## Cobertura y selección

- Pectoral 4=press máquina 2+suelo 2; espalda 4=jalón 2+remo 2; cuádriceps 2=prensa; femoral 3=RDL 2+curl 1; glúteos 4=prensa+RDL; core 1 directo=crunch y 2 secundarios=RDL.
- Deltoides 0 directas/6 secundarias, bíceps 0/4, tríceps 0/4, gemelos 0/0. Son datos que revisar, no volumen equivalente ni argumento para añadir aislamientos obligatorios. Sin datos previos no declarar insuficiencia individual.
- No hay small_direct_coverage porque esa regla se activa únicamente con goal=balanced_mass; D es regain_mass. La tabla smallMuscles SÍ conserva los ceros. Un warning frente a siete en B no significa cobertura superior.
- Material exacto: prensa usa press45; press máquina chest_press; jalón pulldown; remo supported_row; RDL/press suelo dumbbells; crunch cables; curl seated_curl. Banco disponible no usado: permitido, no obligación de usar todo.
- 4 series en pesos libres,7 en máquinas dedicadas,2 en jalón dedicado,1 en polea regulable; 14 total. Sin equipamiento inventado; dead_bug y bird_dog ausentes.
- Ocho ejercicios distintos/ocho apariciones, cero duplicados diarios. Press máquina y suelo son variantes de la misma familia en días diferentes; alternativas razonables. No se infiere preferencia por máquinas del inventario.
- Seis ejercicios de 2 series y dos de 1 (core/curl), todos straight. Conserva simplicidad para aprender RIR, sin afirmar que esta es la única dosis correcta para retorno.
- Progresión fija por serie/techo de reps: clara y registrable, pero no adaptación automática al fútbol, historial ni fatiga. El contrato no devuelve la justificación interna de elegir RDL viernes; solo podemos evaluar compatibilidad observable.

## Evidencia real, cierre e integridad

24/24 comprobaciones SDK/JWT NUEVAS: cuatro logins/identidades/roles existentes; acceso owner; cola vacía; consentimiento; intake exacto; operación única owner/intake/key; ninguna rutina/retry; privado denegado a otro client/trainer/reviewer; propuesta pending_review; proyección reviewer única y sin salud; intento consumido sin retries. Recuperación por relectura real; no nueva prueba de corte de red/recarga y no mocks.

SDK 2.115.0, runner de C adaptado solo a D/perfil/bytes/hashes/UUID. Cuenta retry excluida. Tokens únicamente en memoria; sin persistSession o refresh automático; cuatro signOut(local) correctos. Manifiesto sintético preexistente autorizado, no copiado ni publicado.

Preflight exacto: proyecto/nombre, bundle y 10 dependencias; excepción única fijada del LF final de contract-v5 igual a A/B/C, sin normalización nueva. 27 referencias, metadata,16 definiciones críticas/owners/ACL y 224 funciones/roles/membresías/esquemas/triggers iguales al cierre C. Configs vacías, cero datos Basic ajenos y actividad concurrente incompatible observada. Activación volvió a comprobar esas condiciones antes de habilitar owner/reviewer; global reviewer usado únicamente en ventana sintética aislada, no prueba permisos segmentados para múltiples usuarios.

Ventana abierta 12:13:18 Europe/Madrid; SDK finalizó 12:13:58; lectura 12:14:22 confirmó owner/reviewer vacíos y cero reservadas. Caducidad máxima 60 min. Una intención antes del envío, un conteo/generación verificados por guard y recibo; HTTP 200 terminado, sin incertidumbre en vuelo. Una primera consulta de log con filtro function_id no devolvió filas; consulta acotada de eventos guard devolvió exactamente el evento de D. No implicó reintento del proveedor.

Recibo conciliado antes de limpieza. Transacción única: igualdad completa de filas con recibo, referencias y scopes apagados, borrado de exactamente tres UUID (consentimiento, intake, operación); 27 referencias revalidadas dentro y después. No borrar por fechas/email/patrones. Ninguna rutina/revisión/workout/nota creada. Estado pending_review conservado hasta eliminación autorizada, sin aprobación/aceptación.

Final: **27/27 referencias iguales**,16 funciones críticas y 224 funciones/catálogo de seguridad iguales; RLS/ACL/owners intactos. Edge v33/bundle/CORS/JWT idénticos. Configs vacías, cero operaciones/intakes; 19 rutinas,4 revisiones,22 workouts,4 notas y 10 consentimientos preexistentes. Auth comparado por campos estables; timestamps normales de login no se declaran idénticos. Recibos reales de coste conservados privados; limpieza no borra gasto ni resetea Financial P1.

Auditoría offline: node tests/coach-flow/basic-quality-d-evidence.cjs, **14/14 controles de evidencia**, separada de 24/24 JWT. Sin red, sin escrituras y sin contar reejecuciones históricas.

## Comparación y siguientes decisiones

La comparación completa de cinco muestras, tiempos/costes y tendencias está en [BASIC-QUALITY-BATTERY-SUMMARY.md](BASIC-QUALITY-BATTERY-SUMMARY.md). Prioridades propuestas, NO aplicadas: revisión temporal del deporte bidireccional, contraste de mínimos/preferidos sin reglas rígidas, y revisión humana de cobertura/retorno antes de pilotos con personas.

## Estado de entrega

PR #2 borrador; solo documentación y auditoría saneadas. Main 0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663 y PR #1 81fe65f4b9b5a9b7c3d905c2ea3c432f8ef5d839 sin cambios. Producción/Cloudflare/modelo/guard/cuestionario/V5/prompt/SQL/RLS/permisos permanentes/cuotas/Financial P1 intactos por esta ejecución; no nueva auditoría productiva. **Batería detenida tras D; sin nuevas llamadas autorizadas ni cambios del generador.**
