# Basic V5 — perfil A: generación real y evaluación

Ensayo completado el 31/10/2026, exclusivamente en SIMPLE Security Test.
Base remota PR #2: 38bc3971bf54b732af53c9cb9074640b8c08a5c9.
PR #2 permanece en borrador. B/C/D no ejecutados. Sin despliegues ni cambios de producto.

## Resultado y alcance del dictamen

**ADECUADA como propuesta inicial conservadora para un principiante en un piloto supervisado.**
Es un dictamen documental asistido por IA, pendiente del juicio final del reviewer humano;
no se ha aprobado ni aceptado en la aplicación. No equivale a preparación para un servicio
autónomo de pago ni demuestra resultados de hipertrofia.

Pasa V5 sin fallos estructurales. Hay 13 avisos informativos: diez de descanso y tres
de cobertura directa. No se ocultan ni convierten automáticamente en rechazo.
La dosis reducida y el RIR 4 responden a dos sesiones de 30 minutos y esfuerzo desconocido.
No hay evidencia de fallo sistemático, volumen comprimido o especialización injustificada.
Antes de aplicarla a una persona, un reviewer debe comprobar técnica del rumano/goblet,
cómo elegir la carga, montaje del remo con banda y conservación del rendimiento entre series.

## Continuidad y excepción exacta del preflight

El intento del 30/10 no arrancó: la revisión automática de ejecución quedó incompleta
por límite de uso. No había marcadores de sesión/activación/dispatch. Se conservaron los
diez archivos originales, run y clave. La conciliación previa del 31/10 confirmó configs
vacíos, cero operaciones/intakes Basic, 27 referencias y seguridad intactas; sin datos
Basic ajenos, cola Premium ajena accesible ni consultas activas de otros clientes.

Se añadió un preflight de reanudación; no se sobrescribió el original ni se modificó Edge.
Excepción SOLO para supabase/functions/simple-coach-mock/contract-v5.mjs:

| Copia original | Bytes UTF-8 | SHA-256 |
|---|---:|---|
| Local | 10024 | 5feb6db3f85b0a500bba6c3743d953e26d535ea6d36839adb9deb7545ef3fe4f |
| Desplegada | 9983 | 101c3c02c2701500284a3b92c15b031c53e52dbe26aeabdd5f474549bd443039 |

Tras la normalización CRLF ya existente: local 9981 bytes, desplegado 9982.
La copia desplegada equivale EXACTAMENTE a la local normalizada más un LF final.
Sufijos originales hex: local 297d3b0d0a7d0d0a; desplegado 297d3b0a7d0a0d0a.
La excepción exige ambos hashes y tamaños originales; no usa trimEnd general.
Tres negativos rechazan cambio de contenido, un salto extra y otro nombre de archivo.
Las otras nueve dependencias coinciden normalizando CRLF. El entrypoint coincide
exactamente con el aprobado de staging, incluidos sus CORS propios.

Se ejecutó el MISMO comando run.cjs --run-once por la aprobación normal de plataforma.
Las cuatro sesiones sintéticas estaban listas en memoria antes de abrir la ventana.
La cuenta adicional retry del manifiesto compartido no se utilizó. Sin tokens persistidos.

## Solicitud, uso y coste

| Campo | Evidencia |
|---|---|
| Edge | simple-coach-mock v33, ACTIVE, verify_jwt=true |
| Bundle | 0de5d740f29f5615cfea2e1678f95f25f7528d6bea996e50ee1e5e543e3f4c20 |
| Modelo devuelto | gpt-5.4-2026-03-05 |
| Contrato / cuestionario | basic-initial-v5 / basic-intake-v2 |
| Modalidad / parámetros | default; store=false; truncation=disabled; reasoning=low; sin herramientas |
| Petición final registrada antes del envío | 9296 bytes UTF-8 |
| SHA-256 efectivo | 9d647afc034783046d59bb209707789c94e83724959e6eaead148725fd22b761 |
| Conteos / generaciones | 1 / 1; sin reintentos |
| Conteo real | 2150 tokens |
| Uso devuelto | 2150 entrada; 1864 salida; 0 caché |
| Recibo | HTTP 200; receipt_within_limits |
| Latencia del intento proveedor/conteo | 32818 ms; resultado proveedor 32820 ms |
| Ida/vuelta Edge | 34083 ms |
| Coste calculado de tokens | **0,033335 USD** |
| Estado antes de limpiar | pending_review |

Cálculo: 2150 × 2,50 / 1M + 1864 × 15 / 1M = 0,005375 + 0,027960 USD.
Coincide con estimated_cost y el recibo real del proveedor. Los IDs de respuesta y
petición se conservan privados. No se verificó factura/cargo definitivo ni posibles
cargos independientes del conteo, impuestos o condiciones de cuenta.
El máximo de tokens condicionado a tarifa estándar era 0,1068 USD, no un tope contractual.

[Tarifas del modelo](https://developers.openai.com/api/docs/models/gpt-5.4).
Los parámetros y límites (16384 bytes, 12000 entrada contada, 5120 salida) permanecieron
intactos. Se usó api.openai.com, sin seleccionar endpoint regional.
El hash efectivo difiere del preparado offline por el orden de propiedades JSONB;
la anamnesis es semánticamente idéntica. Se conservó cuerpo final y cuerpo de conteo
antes del único envío. El código desplegado congela ese mismo cuerpo para el transporte.

La evidencia conserva la propuesta normalizada ORIGINAL que entregó la Edge y su
recibo; no se ha retocado. El flujo no conserva el sobre HTTP completo de OpenAI ni
una transcripción independiente de su JSON compacto previo a decodeOutput. No se
presenta la propuesta normalizada como un volcado bruto de ese sobre.

## Anamnesis A exacta

- Experiencia lt6; objetivo balanced_mass; estimación RIR unknown.
- Martes y viernes; **30 minutos por sesión**, sin ampliar a 35/40/45.
- Mancuernas y bandas; inventario personalizado vacío.
- Exclusión pushup (flexiones); ninguna actividad externa declarada.
- Sin datos personales, salud, lesiones, carga disponible de mancuernas o resistencia
  de bandas inventadas. El inventario indica disponibilidad, no preferencia.
- No se eligieron ejercicios a incluir.

## Rutina completa original

Nombre: Basic · rutina inicial. Esquema straight en todos los ejercicios.

### Martes — 3 ejercicios, 5 series

| Orden | Ejercicio (catálogo) | Serie | Repeticiones | RIR | Descanso |
|---|---|---:|---|---:|---|
| 1 | Sentadilla goblet (goblet) | 1 | 6–8 | 4 | 2 min |
| 1 | Sentadilla goblet (goblet) | 2 | 6–8 | 4 | 2 min |
| 2 | Remo con banda (band_row) | 1 | 6–8 | 4 | 2 min |
| 2 | Remo con banda (band_row) | 2 | 6–8 | 4 | 2 min |
| 3 | Press de suelo con mancuernas (floor_press) | 1 | 6–8 | 4 | 2 min |

Estimación V5: **23 min 40 s**, interfaz 24 min. Margen nominal: 6 min 20 s.

### Viernes — 3 ejercicios, 5 series

| Orden | Ejercicio (catálogo) | Serie | Repeticiones | RIR | Descanso |
|---|---|---:|---|---:|---|
| 1 | Peso muerto rumano con mancuernas (db_rdl) | 1 | 6–8 | 4 | 2,5 min |
| 1 | Peso muerto rumano con mancuernas (db_rdl) | 2 | 6–8 | 4 | 2,5 min |
| 2 | Press de suelo con mancuernas (floor_press) | 1 | 6–8 | 4 | 2 min |
| 2 | Press de suelo con mancuernas (floor_press) | 2 | 6–8 | 4 | 2 min |
| 3 | Crunch inverso (reverse_crunch) | 1 | 10–12 | 4 | 1 min |

Estimación V5: **23 min 56 s**, interfaz 24 min. Margen nominal: 6 min 4 s.
Total: 10 series, 5 ejercicios distintos; ninguna serie RIR 0/1/2/3.
No hay duplicados intrasesión; repetir floor_press permite practicar y progresar.

Instrucción íntegra de la propuesta (texto fijo del contrato, no consejo personalizado
adicional escrito por el modelo):

> Prioriza técnica y constancia; empieza dejando 3–4 repeticiones posibles. Progresa cada serie o bloque por separado: cuando alcances su techo de reps con el RIR indicado y técnica estable, aumenta ligeramente su carga. Ajusta la carga entre bloques si cambian los objetivos. No se automatizan pesos ni cambios de rutina.

## Volumen y distribución

Conteos según etiquetas del catálogo, no equivalencias fisiológicas. Las secundarias
NO se convierten en directas. Una serie multiarticular puede figurar en varios grupos;
no sumar estas filas para obtener el total de diez series.

| Grupo | Directas | Secundarias | Frecuencia directa/secundaria | Procedencia |
|---|---:|---:|---|---|
| Pecho | 3 | 0 | 2 / 0 | Press de suelo |
| Espalda | 2 | 0 | 1 / 0 | Remo con banda |
| Espalda alta (subconjunto de espalda) | 2 | 0 | 1 / 0 | Mismas dos series de remo |
| Cuádriceps | 2 | 0 | 1 / 0 | Goblet |
| Femoral | 2 | 0 | 1 / 0 | Rumano |
| Glúteos | 4 | 0 | 2 / 0 | Goblet + rumano |
| Deltoides | 0 | 5 | 0 / 2 | Remo + press; regiones no cuantificadas por catálogo |
| Bíceps | 0 | 2 | 0 / 1 | Remo |
| Tríceps | 0 | 3 | 0 / 2 | Press |
| Gemelos | 0 | 0 | 0 / 0 | Sin trabajo contabilizado |
| Zona media | 1 | 4 | 1 / 2 | Crunch directo; goblet/rumano secundarios |
| Aductores | 0 | 0 | 0 / 0 | Sin etiqueta de estímulo contabilizado; no prueba ausencia fisiológica |

Patrones: sentadilla 2, bisagra 2, tirón horizontal 2, empuje horizontal 3,
flexión de tronco 1. No hay empuje/tirón vertical ni flexión aislada de rodilla:
son omisiones descriptivas, no fallos automáticos en este contexto limitado.
Tren inferior 4 series (40%); superior 5 (50%); abdomen directo 1 (10%).
Martes: 2 inferior + 3 superior. Viernes: 2 inferior + 2 superior + 1 abdomen.
Martes→viernes: tres días de separación; viernes→martes: cuatro. No se conocen
horarios exactos. No hay actividad externa declarada que evaluar ni running supuesto.

## Avisos V5 íntegros en contenido

Diez short_rest, uno por cada serie:

| Día / ejercicio | Series afectadas | Prescrito | Referencia mínima heurística | Preferido heurístico | Motivo |
|---|---|---|---|---|---|
| Martes / Goblet | 1, 2 | 120 s | 150 s | 180 s | moderate_compound |
| Martes / Remo banda | 1, 2 | 120 s | 150 s | 180 s | moderate_compound |
| Martes / Press suelo | 1 | 120 s | 150 s | 180 s | moderate_compound |
| Viernes / Rumano | 1, 2 | 150 s | 180 s | 240 s | high_cost |
| Viernes / Press suelo | 1, 2 | 120 s | 150 s | 180 s | moderate_compound |
| Viernes / Crunch inverso | 1 | 60 s | 90 s | 90 s | accessory |

Mensaje original común: “Descanso inferior a la orientación práctica del ejercicio y la
serie; reducir volumen redundante antes de comprimir la recuperación.”

Tres small_direct_coverage:
- deltoids: 0 directas / 0 días, 5 secundarias / 2 días.
- biceps: 0 directas / 0 días, 2 secundarias / 1 día.
- calves: 0 directas / 0 días, 0 secundarias / 0 días.

Mensaje original parametrizado para cada fila:
“Cobertura para revisar: {direct} series directas (días: {frequency}) y participación
secundaria en {secondary} series / {secondary_frequency} días. Comparación interna con
la mediana de grandes grupos cubiertos (2 series), no un mínimo universal. Revisar si la
selección y el trabajo indirecto encajan con el objetivo equilibrado; no exige aislamientos
ni añadir series.”

No se advierte tríceps porque el catálogo permitido no tiene opción directa con este
inventario. Eso describe una limitación de representación del catálogo; no significa
que en el mundo real no puedan entrenarse tríceps con mancuernas/bandas.
No hay aviso de deporte externo: activity=none. Sin fallos estructurales.

## Rúbrica aplicada antes de conocer otras muestras

| Dimensión | Nota | Justificación |
|---|---|---|
| Objetivo/experiencia | 2 | Dosis inicial pequeña, RIR4, cinco movimientos, sin técnicas avanzadas ni fallo. Hipertrofia equilibrada como comienzo, no especialización. |
| Días/tiempo/material | 2 | Días exactos, 30 min, material permitido, flexiones excluidas. Estimación deja margen para aprendizaje; no es cronometraje real. |
| Ejercicios/patrones | 1 | Cubre rodilla/cadera/empuje/tirón/core; rumano tiene complejidad high en catálogo y necesita demostración. No obliga a excluirlo de principiantes. |
| Volumen muscular | 1 | Cobertura general con 10 series; pequeños grupos limitados. Puede ser dosis de entrada razonable, no se demuestra insuficiencia individual. |
| Frecuencia/distribución | 2 | Sesiones separadas, sin acumulación consecutiva; pecho/glúteos dos exposiciones, espalda/quads/femoral una. No se impone una frecuencia universal. |
| Reps/RIR/descansos | 1 | Margen amplio y objetivos estables; diez descansos bajo referencia V5. Su suficiencia real a RIR4 debe comprobarse, no se deduce riesgo de los warnings. |
| Actividad externa | 2 | Respeta none; no añade restricciones o carga deportiva inventada. |
| Progresión/seguimiento | 1 | Doble progresión por serie definida; falta explicar carga inicial, saltos disponibles y cómo registrar tensión/longitud de banda. |
| Revisión humana | 1 | Advertencias informativas preservadas; no mide ejecución, RIR real, montaje ni tolerancia. Se detallan las comprobaciones pendientes. |
| Personalización | 2 | Dos días cortos/material limitado/unknown producen un plan claramente más conservador que el intermedio; no exige ejercicios exclusivos. |

No se calcula una nota total. No aparece contradicción deportiva importante demostrada
que obligue a HOLD, ni fallo estructural. La adecuación es para empezar con supervisión.
Si el reviewer observa técnica inestable, imposibilidad de mantener el margen o una
duración real incompatible, debe dejar HOLD y revisar antes de aplicar.

### Qué está bien y qué necesita atención

- Aprendizaje: tres ejercicios por sesión y esquemas rectos reducen carga de instrucciones.
  Solo floor_press se repite dos días; practicar goblet/rumano/remo una vez por semana
  puede limitar oportunidades de aprendizaje, pero no prueba una programación incorrecta.
- Rumano: es el movimiento más exigente técnicamente; se coloca primero el viernes y
  lejos del fallo. Verificar bisagra y control antes de añadir carga. No se inventan lesiones.
- RIR unknown: todas las series a 4 dejan margen nominal; un principiante puede estimarlo
  mal. Explicar “repeticiones posibles con técnica estable”, elegir carga inicial conservadora
  y confirmar el esfuerzo observado. No asumir que RIR4 prescrito equivale a RIR4 realizado.
- Reps 6–8: rango válido del contrato, no maximal. En bandas hay que comprobar que puede
  estandarizarse recorrido/tensión y progresión. Un rango moderado algo más alto sería
  otra opción válida, no una corrección obligatoria ni algo aplicado.
- Descansos: 2 min y RIR4 pueden preservar rendimiento con estas dosis; no hay datos reales
  para declararlos insuficientes. El patrón de diez avisos merece revisión, especialmente
  rumano, sin atribuir una intención al modelo. El plan no necesita más volumen.
- Sensibilidad temporal, sin editar la propuesta: añadir 30 s a cada descanso para alcanzar
  las referencias mínimas V5 daría 26:10 el martes y 26:26 el viernes, todavía bajo 27 min.
  Esto muestra margen estimado para ajustar recuperación; no demuestra duración real.
  V5 incluye 5 min iniciales, 2 min por ejercicio, 4 s por repetición y descanso tras cada
  serie, incluida la última. No separa enseñanza detallada o montaje específico de bandas.
- Gemelos no tienen trabajo contabilizado; brazos/hombros reciben participación indirecta.
  Añadir aislamiento por obligación sería injustificado con este tiempo. Revisar prioridades
  y evolución antes de redistribuir. No equivaler indirecto a directo ni declarar “cuerpo
  completo óptimo” solo por pasar cobertura mayor.
- Montaje: mancuernas y bandas están disponibles; no constan pesos, resistencias ni tipo de
  anclaje. Confirmar que el remo puede montarse de forma estable; no afirmar que existe
  un anclaje concreto ni introducir material no declarado.

Alternativas igualmente válidas a discutir: algo más de repetición de patrones entre días,
mayor rango de reps en algún movimiento, más descanso donde el rendimiento lo necesite,
o una redistribución conservadora de las diez series. Ninguna se aplicó ni se generó otra rutina.

## Comparación con la primera muestra intermedia

| Métrica | A principiante | Primera intermedia |
|---|---|---|
| Sesiones / disponibilidad | 2 × 30 min | 3 × 60 min |
| Material | Mancuernas/bandas | Máquinas, mancuernas, banco y poleas declarados |
| Series semanales | 10 | 30 |
| Ejercicios por sesión | 3 / 3 | 5 / 5 / 5 |
| RIR medio | 4 | Aproximadamente 1,7 |
| Descansos | 1–2,5 min | 1,5–3 min |
| Estimación por sesión | 24 / 24 min | 46 / 47 / 47 min |
| Actividad externa | Ninguna declarada | Running dominical |
| Uso entrada/salida | 2150 / 1864 | 2454 / 2050 |
| Coste calculado USD | 0,033335 | 0,036885 |

El menor volumen y mayor margen son adaptaciones coherentes al perfil, no fallos.
La comparación no prueba causalidad ni consistencia del generador con solo dos muestras.
La primera rutina se evaluó inicialmente con v32; sus cinco avisos posteriores provienen
de reevaluación v33. No comparar sus cero avisos originales con los trece actuales como
si fueran el mismo evaluador. A no requiere avisos de running.

## Seguridad, limpieza y evidencia

- 24/24 checks SDK/JWT nuevos de A: cuatro identidades/roles; scope propietario;
  consentimiento/intake; operación única; relectura owner/key; tres denegaciones REST;
  proyección reviewer de solo esta operación; intento consumido sin reintento.
- La recuperación probada es relectura tras éxito, no nueva simulación de timeout.
  No se ejecutaron decisiones ni se creó rutina/revisión/workout/nota.
- El scope reviewer sigue global: solo fue aceptable en este entorno sintético vacío,
  con único propietario habilitado, lectura inicial vacía y guard transaccional de
  datos/concurrencia. Un sondeo no garantiza ausencia futura de otro administrador;
  esto NO valida permisos segmentados para varios clientes simultáneos.
- Ventana iniciada 31/10 a las 20:36:14 UTC (21:36:14 Europe/Berlin), cerrada tras recibir
  evidencia. Cuatro signOut locales correctos, sin sesiones persistidas por el runner.
- La primera confirmación obligatoria de limpieza caducó. Se releyó el estado antes de
  renovar la misma solicitud; no se repitió una escritura sin conciliación.
- Eliminados exactamente tres UUID: consentimiento, anamnesis y operación; igualdad
  íntegra de filas y ausencia de referencias comprobadas dentro de una transacción.
  Recibos privados del gasto y respuesta permanecen guardados e ignorados por Git.
- 27/27 referencias originales restauradas. Configs owner/reviewer vacíos.
  Cero intakes/operaciones Basic; 10 consentimientos preexistentes intactos.
- Coinciden las 16 funciones críticas/owners/ACL y la comparación ampliada de 224
  funciones, roles, membresías, esquemas y triggers. Edge v33 y bundle intactos.
- Producción, main, PR #1, Cloudflare, Auth/OAuth, RLS, cuotas y Financial P1 sin cambios.
  Solo se abrieron/restauraron los dos scopes temporales ya autorizados.
- Diez archivos privados originales byte-idénticos al checkpoint. Los nuevos recibos
  no incluyen credenciales ni JWT. Manifest original no se copió ni publicó.

Reproducción de conciliación offline (sin red, activaciones ni escrituras):
node tests/coach-flow/basic-quality-a-evidence.cjs
Los resultados autenticados se mantienen separados de los checks offline del informe.
Resultado del auditor: **12/12 comprobaciones offline nuevas superadas**, sin red ni
escrituras. Se reutilizan los 24 resultados JWT de este ensayo; no se cuentan otra vez
como ejecuciones autenticadas. Los tres negativos de la excepción de terminador son
comprobaciones locales de preflight, no llamadas a servicios.

## Siguiente decisión

No ejecutar otra muestra automáticamente. Revisar esta propuesta y los avisos con un
reviewer humano. B, C y D requieren autorización independiente. No modificar V5 por
una sola muestra; valorar en más perfiles si la tendencia a descansos inferiores a las
referencias y las instrucciones de progresión justifican un ajuste posterior.

