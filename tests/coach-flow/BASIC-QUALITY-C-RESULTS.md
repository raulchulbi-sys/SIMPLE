# Basic V5 — perfil C: generación real y evaluación deportiva

Ensayo 01/11/2026, Europe/Madrid. Solo SIMPLE Security Test; PR #2 base remota ecb4701c73771661786b19b34ebefd8c7c2f2e6e. D no ejecutado.

## Dictamen documental

**ADECUADA como propuesta inicial para un avanzado dentro de un piloto supervisado, con cinco avisos que debe valorar el reviewer.** Dictamen asistido por IA, no aprobación humana ejecutada ni aceptación en la aplicación. No acredita resultados reales, tolerancia individual ni preparación comercial.

V5 válido, cero fallos estructurales, 47 series en 20 apariciones de ejercicios (19 distintos). Upper/lower lunes/martes y jueves/viernes; esfuerzo alto sin fallo indiscriminado. No se demuestra un problema importante que obligue a HOLD. Revisar los descansos del press de hombro, variedad y proporción de trabajo directo de brazos; no corregir automáticamente ni añadir volumen por rellenar 75 minutos.

## Petición, uso y coste

| Campo | Evidencia |
|---|---|
| Edge | simple-coach-mock v33 ACTIVE, verify_jwt=true; no redesplegada |
| Bundle SHA256 | 0de5d740f29f5615cfea2e1678f95f25f7528d6bea996e50ee1e5e543e3f4c20 |
| Modelo devuelto / contrato | gpt-5.4-2026-03-05 / basic-initial-v5 |
| Configuración | reasoning low, service_tier=default, store=false, truncation=disabled; sin herramientas |
| Cuerpo final | **15334 bytes** de 16384; margen 1050 |
| Hash preparado | 5e00a84a30ed1e7052f1b7f4e91faa8361c0f75d625b94c588e5dcde63562dd5 |
| Hash efectivo congelado | 830114ae203d86611428f2f10da2043d5794472385c3ef7229d1f1f3967bd102 |
| Llamadas | Exactamente **1 conteo + 1 generación**, cero reintentos |
| Conteo / entrada devuelta | **3702 / 3702 tokens** |
| Salida / caché | **2739 / 0 tokens** |
| Máximos exigidos | 12000 entrada contada; 5120 salida total, incluido razonamiento |
| Recibo | HTTP 200; receipt_within_limits |
| Latencia intento (conteo/proveedor) | **28586 ms**; no desglose separado disponible |
| Latencia Edge / ida-vuelta SDK | **28588 / 29393 ms** |
| Coste de tokens calculado | **0,05034 USD** |
| Estado antes de limpiar | pending_review, sin aprobación ni aceptación |

Cálculo: (3702 × 2,50 + 2739 × 15) / 1000000 = 0,009255 + 0,041085 USD. Coincide con estimated_cost. Uso real recibido del proveedor; gasto calculado, no factura/cargo certificado. No se acredita gratuidad del conteo, impuestos ni condiciones particulares de cuenta. Máximo condicionado autorizado 0,1068 USD, no techo contractual total.

[Tarifa oficial GPT-5.4 consultada para esta ejecución](https://developers.openai.com/api/docs/models/gpt-5.4). Modalidad estándar, endpoint global api.openai.com, sin configuración regional añadida ni cargos inesperados observados en lo verificable. Se conservan IDs de respuesta y petición únicamente en evidencia privada. El recibo retenido no desglosa tokens de razonamiento; no inventar ese valor.

Hash distinto del preparado por orden de propiedades JSONB: se probó igualdad semántica, se recompuso el cuerpo definitivo y se congeló antes del dispatch. Ningún recorte de catálogo/prompt/contexto. Una misma clave y una operación. La Edge creó la operación y la propuesta real; no se sembró una respuesta sintética.

## Anamnesis exacta

- experience=gt4; goal=balanced_mass; days=4; weekdays=[mon,tue,thu,fri]; minutes=75; effort=habitual.
- excluded=[]; activity={type:none,weekdays:[]}; inventory.custom=[].
- Inventario V5 completo de 39 IDs, exactamente el perfil versionado: chest_press, incline_press, convergent_press, pec_deck, pulldown, horizontal_row, convergent_row, supported_row, high_row, low_row, pullover, pullup, hack, pendulum, press45, horizontal_press, leg_extension, seated_curl, lying_curl, adductor, abductor, hip_thrust, seated_calf, standing_calf, shoulder_press, lateral, rear_delt, preacher, curl, triceps, smith, bench, barbell, rack, dumbbells, cables, bands, ab_machine, ab_wheel.
- Sin datos personales, salud, preferencias inventadas o selección de ejercicios a incluir. Más de cuatro años no acredita volumen tolerado, cargas ni precisión real del RIR.

## Rutina original completa

Nombre: **Basic · rutina inicial**. Se conserva la propuesta normalizada original de la Edge, sin editar. No se conserva el sobre HTTP bruto ni el JSON compacto anterior a decodeOutput. No se inventan cargas.

### Lunes — 5 ejercicios, 12 series

| Orden | Ejercicio / catálogo | Esquema | Serie | Reps | RIR | Descanso |
|---|---|---|---:|---|---:|---|
| 1 | Press inclinado en máquina / incline_press | top_backoff | 1 | 6–8 | 1 | 3 min |
| 1 | Press inclinado en máquina / incline_press | top_backoff | 2 | 8–10 | 2 | 3 min |
| 1 | Press inclinado en máquina / incline_press | top_backoff | 3 | 8–10 | 2 | 3 min |
| 2 | Jalón al pecho / pulldown | top_backoff | 1 | 6–8 | 1 | 3 min |
| 2 | Jalón al pecho / pulldown | top_backoff | 2 | 8–10 | 2 | 3 min |
| 2 | Jalón al pecho / pulldown | top_backoff | 3 | 8–10 | 2 | 3 min |
| 3 | Remo con pecho apoyado / supported_row | straight | 1 | 8–12 | 1 | 3 min |
| 3 | Remo con pecho apoyado / supported_row | straight | 2 | 8–12 | 1 | 3 min |
| 4 | Elevaciones laterales en máquina / lateral | varied | 1 | 12–15 | 1 | 2 min |
| 4 | Elevaciones laterales en máquina / lateral | varied | 2 | 12–15 | 0 | 2,5 min |
| 5 | Extensión de tríceps en máquina / triceps | varied | 1 | 10–12 | 1 | 2 min |
| 5 | Extensión de tríceps en máquina / triceps | varied | 2 | 10–15 | 0 | 2,5 min |

Estimación V5: **57 min 08 s**, mostrada 58 min. Margen hasta 75 min: 17 min 52 s. Series inferiores: 0. Series RIR 0: 2.

### Martes — 5 ejercicios, 12 series

| Orden | Ejercicio / catálogo | Esquema | Serie | Reps | RIR | Descanso |
|---|---|---|---:|---|---:|---|
| 1 | Sentadilla hack / hack | top_backoff | 1 | 6–8 | 1 | 4 min |
| 1 | Sentadilla hack / hack | top_backoff | 2 | 8–10 | 2 | 4 min |
| 1 | Sentadilla hack / hack | top_backoff | 3 | 8–10 | 2 | 4 min |
| 2 | Peso muerto rumano con barra / bar_rdl | straight | 1 | 6–10 | 2 | 4 min |
| 2 | Peso muerto rumano con barra / bar_rdl | straight | 2 | 6–10 | 2 | 4 min |
| 2 | Peso muerto rumano con barra / bar_rdl | straight | 3 | 6–10 | 2 | 4 min |
| 3 | Curl femoral sentado / seated_curl | varied | 1 | 10–12 | 1 | 2 min |
| 3 | Curl femoral sentado / seated_curl | varied | 2 | 10–15 | 0 | 2,5 min |
| 4 | Gemelo sentado / seated_calf | straight | 1 | 10–15 | 1 | 2 min |
| 4 | Gemelo sentado / seated_calf | straight | 2 | 10–15 | 1 | 2 min |
| 5 | Crunch abdominal en máquina / machine_crunch | straight | 1 | 10–12 | 1 | 1,5 min |
| 5 | Crunch abdominal en máquina / machine_crunch | straight | 2 | 10–12 | 1 | 1,5 min |

Estimación V5: **59 min 46 s**, mostrada 60 min. Margen hasta 75 min: 15 min 14 s. Series inferiores: 10. Series RIR 0: 1.

### Jueves — 5 ejercicios, 12 series

| Orden | Ejercicio / catálogo | Esquema | Serie | Reps | RIR | Descanso |
|---|---|---|---:|---|---:|---|
| 1 | Press de pecho en máquina / chest_press | straight | 1 | 8–12 | 1 | 3 min |
| 1 | Press de pecho en máquina / chest_press | straight | 2 | 8–12 | 1 | 3 min |
| 1 | Press de pecho en máquina / chest_press | straight | 3 | 8–12 | 1 | 3 min |
| 2 | High row / high_row | straight | 1 | 8–12 | 1 | 3 min |
| 2 | High row / high_row | straight | 2 | 8–12 | 1 | 3 min |
| 2 | High row / high_row | straight | 3 | 8–12 | 1 | 3 min |
| 3 | Aperturas en contractora / pec_deck | varied | 1 | 12–15 | 1 | 2 min |
| 3 | Aperturas en contractora / pec_deck | varied | 2 | 12–15 | 0 | 2,5 min |
| 4 | Press de hombro en máquina / shoulder_press | straight | 1 | 8–12 | 1 | 2,5 min |
| 4 | Press de hombro en máquina / shoulder_press | straight | 2 | 8–12 | 1 | 2,5 min |
| 5 | Curl Scott en máquina / preacher | varied | 1 | 10–12 | 1 | 2 min |
| 5 | Curl Scott en máquina / preacher | varied | 2 | 10–15 | 0 | 2,5 min |

Estimación V5: **57 min 12 s**, mostrada 58 min. Margen hasta 75 min: 17 min 48 s. Series inferiores: 0. Series RIR 0: 2.

### Viernes — 5 ejercicios, 11 series

| Orden | Ejercicio / catálogo | Esquema | Serie | Reps | RIR | Descanso |
|---|---|---|---:|---|---:|---|
| 1 | Sentadilla pendular / pendulum | top_backoff | 1 | 6–8 | 1 | 4 min |
| 1 | Sentadilla pendular / pendulum | top_backoff | 2 | 8–10 | 2 | 4 min |
| 1 | Sentadilla pendular / pendulum | top_backoff | 3 | 8–10 | 2 | 4 min |
| 2 | Extensión de cuádriceps / leg_extension | varied | 1 | 12–15 | 1 | 2 min |
| 2 | Extensión de cuádriceps / leg_extension | varied | 2 | 12–15 | 0 | 2,5 min |
| 3 | Curl femoral sentado / seated_curl | varied | 1 | 10–12 | 1 | 2 min |
| 3 | Curl femoral sentado / seated_curl | varied | 2 | 10–15 | 0 | 2,5 min |
| 4 | Gemelo de pie en máquina / standing_calf | straight | 1 | 10–15 | 1 | 2 min |
| 4 | Gemelo de pie en máquina / standing_calf | straight | 2 | 10–15 | 1 | 2 min |
| 5 | Crunch en polea / cable_crunch | straight | 1 | 10–12 | 1 | 1,5 min |
| 5 | Crunch en polea / cable_crunch | straight | 2 | 10–12 | 1 | 1,5 min |

Estimación V5: **52 min 16 s**, mostrada 53 min. Margen hasta 75 min: 22 min 44 s. Series inferiores: 9. Series RIR 0: 2.

Instrucción original:

> Respeta el RIR de cada serie. RIR 0 significa no poder completar otra repetición con técnica estable; no fuerces repeticiones. Progresa cada serie o bloque por separado: cuando alcances su techo de reps con el RIR indicado y técnica estable, aumenta ligeramente su carga. Ajusta la carga entre bloques si cambian los objetivos. No se automatizan pesos ni cambios de rutina.

## Volumen y frecuencia

Atribución del catálogo V5: participación secundaria NO equivale a una serie directa. Una serie puede contar para varios músculos; no sumar estas filas para obtener 47. Espalda alta es subconjunto de espalda. Regiones del deltoides: ND, el catálogo no las separa. Aductores 0 significa ninguna atribución en este catálogo, no ausencia fisiológica de participación.

| Grupo | Directas | Secundarias | Frecuencia directa / secundaria |
|---|---:|---:|---|
| Pectoral | 8 | 0 | 2 / 0 |
| Espalda / dorsal | 8 | 0 | 2 / 0 |
| Espalda alta (subconjunto) | 5 | 0 | 2 / 0 |
| Cuádriceps | 8 | 0 | 2 / 0 |
| Femorales | 7 | 0 | 2 / 0 |
| Glúteos | 9 | 0 | 2 / 0 |
| Deltoides | 4 | 11 | 2 / 2 |
| Bíceps | 2 | 8 | 1 / 2 |
| Tríceps | 2 | 8 | 1 / 2 |
| Gemelos | 4 | 0 | 2 / 0 |
| Zona media | 4 | 3 | 2 / 1 |
| Aductores | 0 | 0 | 0 / 0 |

Patrones (series): horizontal_push=6; vertical_pull=3; horizontal_pull=5; shoulder_abduction=2; elbow_extension=2; squat=6; hinge=3; knee_flexion=4; plantar_flexion=4; trunk_flexion=4; horizontal_adduction=2; vertical_push=2; elbow_flexion=2; knee_extension=2.

Distribución sin doble conteo: inferior **19/47 (40,4%)**, superior **24/47 (51,1%)**, zona media **4/47 (8,5%)**.

## Las siete series RIR 0

| Día | Ejercicio | Serie | Reps | Descanso | Clasificación |
|---|---|---:|---|---|---|
| Lunes | Elevaciones laterales en máquina | 2/2 | 12–15 | 2,5 min | Aislamiento en máquina estable; coste bajo catalogado |
| Lunes | Extensión de tríceps en máquina | 2/2 | 10–15 | 2,5 min | Aislamiento en máquina estable; coste bajo catalogado |
| Martes | Curl femoral sentado | 2/2 | 10–15 | 2,5 min | Aislamiento en máquina estable; coste bajo catalogado |
| Jueves | Aperturas en contractora | 2/2 | 12–15 | 2,5 min | Aislamiento en máquina estable; coste bajo catalogado |
| Jueves | Curl Scott en máquina | 2/2 | 10–15 | 2,5 min | Aislamiento en máquina estable; coste bajo catalogado |
| Viernes | Extensión de cuádriceps | 2/2 | 12–15 | 2,5 min | Aislamiento en máquina estable; coste bajo catalogado |
| Viernes | Curl femoral sentado | 2/2 | 10–15 | 2,5 min | Aislamiento en máquina estable; coste bajo catalogado |

Siete aislamientos y siete máquinas estables: categorías solapadas, no catorce series. Cero series RIR 0 de alto coste. Todas son últimas series, con 2,5 min prescritos; ese descanso final no demuestra recuperación medida entre sesiones. Siete de 47 series (14,9%); RIR 1: 29 (61,7%); RIR 2: 11 (23,4%); media 1,0851.

## Cinco warnings originales íntegros

1. **rest_performance_review** — Jueves / Press de hombro en máquina / serie 1: Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia 3 min, motivo moderate_compound.

2. **rest_performance_review** — Jueves / Press de hombro en máquina / serie 2: Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia 3 min, motivo moderate_compound.

3. **excess_variety** — : Variedad superior a la referencia del nivel. Únicos 19, referencia 16.

4. **small_direct_coverage** — biceps: Cobertura para revisar: 2 series directas (días: 1) y participación secundaria en 8 series / 2 días. Comparación interna con la mediana de grandes grupos cubiertos (8 series), no un mínimo universal. Revisar si la selección y el trabajo indirecto encajan con el objetivo equilibrado; no exige aislamientos ni añadir series.

5. **small_direct_coverage** — triceps: Cobertura para revisar: 2 series directas (días: 1) y participación secundaria en 8 series / 2 días. Comparación interna con la mediana de grandes grupos cubiertos (8 series), no un mínimo universal. Revisar si la selección y el trabajo indirecto encajan con el objetivo equilibrado; no exige aislamientos ni añadir series.

## Diez dimensiones de la rúbrica previa

Escala original: 2 adecuado, 1 mejorable/incertidumbre, 0 problema importante, ND no determinable. No sumar para aprobar ni usar promedio para compensar problemas.

| Dimensión | Puntuación | Justificación |
|---|---:|---|
| Objetivo y experiencia | 2 | 47 series, RIR0–2 por demanda y bloques registrables, coherentes con experiencia habitual. No se inventa especialización ni se considera obligatoria tanta dosis para todo avanzado. |
| Días, tiempo y material | 2 | Lunes/martes/jueves/viernes exactos; 52:16–59:46 estimados, margen de 15:14–22:44 respecto a 75 min. Todos los requisitos de equipo disponibles. |
| Ejercicios y patrones | 2 | Rodilla, bisagra, flexión de rodilla, empujes horizontales/verticales, tirones horizontales/verticales, gemelos/core. Variedad alta que revisar, sin redundancia diaria inequívoca. |
| Volumen muscular | 1 | Grandes grupos 7–9 directas nominales; deltoides y gemelos 4, brazos 2 directas y 8 secundarias. Equilibrio plausible, dosis individual y regiones del hombro desconocidas. |
| Frecuencia y distribución | 2 | Dos exposiciones principales por músculo; alternancia superior/inferior en días consecutivos. Martes concentra seis series de coste alto; monitorizar tolerancia, no asumir agotamiento. |
| Reps, RIR y descansos | 1 | 6–15 reps, RIR0 solo final de aislamientos; descansos de 4 min en ejercicios costosos. Press de hombro RIR1 a 2,5 min bajo referencia preferida de 3; dos avisos concretos. |
| Actividad externa | 2 | No declarada: no se inventan deporte ni interferencias. No equivale a conocer toda la actividad cotidiana. |
| Progresión y seguimiento | 2 | Objetivos por serie, top/backoff y doble progresión separados; instrucciones legibles. No se probaron cargas iniciales, incrementos ni respuesta al estancamiento. |
| Revisión humana | 1 | Cinco avisos preservados, con incertidumbres explícitas. Faltan volumen previo tolerado, tiempo real, precisión de RIR y ajuste de máquinas; no se fabrica un juicio clínico. |
| Personalización | 2 | Cuatro días upper/lower, dosis/esquemas distintos de A/B, equipo compatible y esfuerzo habitual. No basta una muestra avanzada para probar individualización profunda. |

La puntuación de volumen o descansos no implica fallo estructural ni obligación de añadir aislamientos. La ausencia de datos individuales impide afirmar optimalidad. Si el humano detecta intolerancia o incompatibilidad real, debe dejar HOLD antes de aceptar.

## Distribución de fatiga y recuperación

- Lunes/jueves: superior, 12 series cada día. Martes: 10 inferiores +2 core. Viernes: 9 inferiores +2 core. Son 12/12/12/11 series por sesión, pero conteos parecidos NO significan coste igual.
- Exposición principal superior lunes→jueves y inferior martes→viernes: 72 h nominales; de jueves→lunes y viernes→martes: 96 h. Los días consecutivos alternan regiones; ello evita repetir el mismo bloque principal, no garantiza recuperación sistémica.
- Martes reúne hack 3 y RDL 3: seis series de alto coste catalogado. Viernes pendular 3: tres de alto coste; extensión/curl/gemelos son accesorios. RDL RIR2 y descansos4 min moderan la exigencia prevista. No se prescribe fallo en ninguno.
- Los tirones del lunes pueden dejar fatiga residual de agarre/espalda para el RDL del martes. Revisar rendimiento y estabilidad de la bisagra después de hack; no consta que ocurra interferencia real. Remo apoyado reduce demanda de sostener el torso, sin borrar todo solapamiento.
- Tríceps al fallo lunes, bíceps al fallo jueves: unas 72–96 h hasta el siguiente bloque superior. Curl sentado al fallo martes/viernes: 72/96 h nominales. No se puede deducir recuperación individual solo por el calendario.
- 36/47 series están a RIR0–1. Es esfuerzo alto justificable para el perfil, no exigencia universal. Los 11 RIR2 se concentran en backoffs y RDL. Mantener vigilancia de caída de rendimiento, exactitud de RIR y técnica; no hace falta imponer técnicas intensivas adicionales.
- Los siete RIR0 son selectivos, de coste bajo y última serie. No hay fallo en hack, pendular, RDL, presses o remos. No se detectó acumulación de RIR0 de alto coste ni se creó un umbral nuevo.

## Descansos y viabilidad temporal

| Familia / series C | Prescrito | Referencia V5 | Lectura |
|---|---|---|---|
| Hack, RDL, pendular (9 series) | 4 min | mínimo3 / preferido4 | Recuperación orientada a demanda y carga; no depende solo de ser avanzado. |
| Presses de pecho, jalón, remos (14 series) | 3 min | mínimo2,5 / preferido3 | Coherente con RIR1–2 y reps6–12. |
| Press hombro (2 series) | 2,5 min | mínimo2,5 / preferido3 | Dos avisos: revisar rendimiento siguiente; no fallo universal. |
| Aislamientos RIR0 (7 series) | 2,5 min | mínimo2 / preferido2,5 | Referencia cumplida. |
| Otros aislamientos/gemelos (11 series) | 2 min | mínimo1,5 / preferido2 | Referencia cumplida. |
| Crunch máquina/polea (4 series) | 1,5 min | mínimo1,5 / preferido2 | Bajo preferido con RIR1, sin aviso automático por ser accesorio. |

0/47 por debajo del mínimo; 6/47 bajo preferido (dos press hombro + cuatro crunch). No se oculta la diferencia entre mínimo y preferido. Los cinco avisos no modificaron series ni descansos.

Tiempo V5 =5 min iniciales +2 min por ejercicio +4 s por repetición máxima +descanso tras cada serie, incluida la última. No hay unilateral en C. No mide colas, calentamientos específicos, cargas ni transiciones reales. Umbral estructural actual 90% de75=67,5 min; todas pasan, ninguna supera el80% exacto (martes59:46, no60:00). El redondeo mostrado a60 no altera el test.

Sensibilidad offline, NO cambio de rutina: elevar los seis descansos bajo preferido añadiría 1 min martes/jueves/viernes; estimaciones60:46/58:12/53:16, lunes57:08. Seguirían bajo67,5. No implica ordenar ese cambio ni ocupar todo el tiempo con volumen. Margen actual hasta75: lunes17:52, martes15:14, jueves17:48, viernes22:44.

## Selección, cobertura y esquemas

Pectoral: press inclinado3 + horizontal3 + contractora2. Espalda: jalón3 + remo apoyado2 + high row3. Rodilla: hack3 + pendular3 + extensión2. Femorales: RDL3 + curl sentado4. Glúteos: hack/pendular/RDL9 por atribución del catálogo. Deltoides: laterales2 + press2 directas y11 participaciones secundarias. Bíceps2 y tríceps2 directas con8 secundarias cada uno. Gemelos4 y core4 directas, core3 secundarias del RDL.

Las regiones del hombro no se separan en la métrica agregada: press, laterales y remos no son estímulos intercambiables. No hay aislamiento posterior explícito; no constituye omisión demostrada por sí sola. Gemelos sentado y de pie aportan variantes razonables sin inventar métricas regionales. Brazos con dos directas pueden ser adecuados junto a tirones/presses; la suficiencia individual requiere seguimiento.

Equipo sin doble conteo: 39 series en máquinas dedicadas (incluye high row), 3 en jalón de cable dedicado, 3 con barra libre (RDL), 2 con polea regulable (crunch); total47. Ningún equipo inexistente. Que el catálogo liste todo el gimnasio no significa preferencia por máquinas; predominio válido, no obligación ni razonamiento interno acreditado.

Cada variante tiene un papel defendible: estabilidad de presses/remos para esfuerzo alto; hack/pendular para rodilla; RDL para bisagra; curl para flexión de rodilla; accesorios para brazos/hombros/gemelos/core. Más de cuatro años no obliga a ejercicios complejos. No se eligieron ejercicios por parte del atleta.

19 ejercicios distintos en20 apariciones. Solo curl sentado se repite entre días; cero duplicados dentro de cada sesión. Aviso excess_variety usa referencia16, no máximo fisiológico. Repetir más variantes principales podría facilitar seguimiento y aprendizaje de cargas; sustituir por preferencias del evaluador no está justificado automáticamente. Hack y pendular no constituyen redundancia inútil demostrada por estar en días diferentes.

13 apariciones de2 series y7 de3; **47 series**, no plantilla universal de dos. Cuatro top_backoff (inclinado, jalón, hack, pendular), siete varied (accesorios con última aRIR0) y nueve straight. Once ejercicios heterogéneos. La dosis de3 se concentra en principales; accesorios2. Es una elección coherente, no evidencia de que todo avanzado necesite esa estructura.

Progresión: top set6–8 RIR1 y backoffs8–10 RIR2 requieren ajustar carga; registrar cada bloque por separado. En varied cambia RIR y a veces techo de reps; no progresar todas las series a la vez por comparación incorrecta. La instrucción fija lo contempla, pero no explica kg concretos, estancamiento o descarga; limitaciones conocidas de Basic, sin afirmar adaptación automática.

## Comparación con las tres muestras anteriores

Evidencia histórica reutilizada, sin nuevas llamadas ni reejecución A/B/primera. Primera generada en v32, avisos posteriores reevaluados offline con v33; no reescribir su recibo.

| Métrica | Primera intermedia | A principiante | B intermedio | C avanzado |
|---|---|---|---|---|
| Días / minutos | lu/mi/vi,60 | ma/vi,30 | ma/ju/sa,60 | lu/ma/ju/vi,75 |
| Series | 30 | 10 | 30 | 47 |
| Apariciones / distintos | 15/12 | 6/5 | 15/11 | 20/19 |
| Series por ejercicio | 2 en todos | 1 o2 | 2 en todos | 2 o3 |
| Duración mostrada | 46/47/47 | 24/24 | 49/50/49 | 58/60/58/53 |
| RIR0 / RIR1 / RIR2 / RIR4 | 0/9/21/0 | 0/0/0/10 | 0/16/14/0 | 7/29/11/0 |
| Bajo mínimo descanso | 0 | 10 | 0 | 0 |
| Bajo preferido | No comparado aquí | No comparado aquí | 10 | 6 |
| Avisos pequeños v33 | 4 | 3 | 4 | 2 |
| Coste tokens USD | 0,036885 | 0,033335 | 0,0369025 | 0,05034 |

Personalización visible C: cuatro días agrupados en superior/inferior, más tiempo y series semanales, RIR0 selectivo, series heterogéneas y descansos4 min donde corresponde; no “avanzado=4 min siempre”. A tiene material limitado/RIR desconocido y B tres días con exclusión concreta; esas diferencias impiden atribuir causalidad únicamente al nivel.

Cobertura directa pequeña vuelve a producir avisos, pero cambia el patrón: C incluye gemelos y brazos; la ausencia total de gemelos de B no es universal. Los10 short_rest de A no se repiten en B/C. Hay diferencias entre descansos mínimos y preferidos en B/C; no todas activan warning. Uniformidad2 series de ambas intermedias no aparece universalmente en C. Son observaciones de cuatro muestras, no fallos sistemáticos demostrados ni garantía de calidad general.

## Hallazgos y decisiones pendientes

- **Fallos estructurales comprobados: ninguno.** Sin cambios de catálogo, datos, días o límites para hacerla pasar.
- **Mejoras menores/revisión:** 2,5→3 min en press hombro si el rendimiento lo requiere; valorar repetición de variantes para seguimiento; justificar trabajo directo de brazos según respuesta. No son instrucciones de modificación automática.
- **Incertidumbres:** volumen previo tolerado, ejecución de RDL tras hack, precisión real del RIR, recuperación, cargas, tiempos de cambio de aparato. No se inventan salud, lesiones, sueño, preferencias ni actividad externa.
- **Alternativas igualmente válidas:** menos variantes, otro reparto de accesorios o más pesos libres. No se penaliza C solo por no coincidir con otra rutina razonable.
- No modificar generador/evaluador durante esta comparación. Más evidencia y revisión humana posterior antes de concluir preparación para pago; D no autorizado.

## SDK real, limpieza e integridad

24/24 comprobaciones SDK/JWT NUEVAS: cuatro logins, identidades y roles verificados por servidor; acceso owner; cola vacía; consentimiento; intake exacto; operación única owner/intake/key; ninguna rutina/retry; REST privado denegado a otro client/trainer/reviewer; pending_review; única proyección segura reviewer; intento consumido sin retry. La cuenta etiquetada real en el arnés es sintética, no una persona real.

Se reutilizó el runner de B adaptando solo perfil/hash/bytes/IDs. SDK2.115.0. Retry excluido; tokens únicamente en memoria, sin persistSession ni auto refresh; cuatro signOut(local) confirmados. Recuperación real por relectura de la operación, sin nueva prueba de corte de red o recarga. No se cuentan mocks como JWT. No hubo nueva aprobación, aceptación, rutina, revisión, workout ni nota.

Ventana abierta 11:57:46 Europe/Madrid; SDK finalizó11:58:25; desactivación ejecutada tras captura, lectura12:01:06 confirmó ambas configs vacías y cero operaciones reservadas. Todo dentro de60 min. Recibo final HTTP200 y operación terminada, ninguna petición del ensayo incierta/en vuelo. El global reviewer solo tuvo este dato sintético en un staging aislado; no prueba segmentación para pilotos simultáneos.

Preflight: bundle v33 exacto; excepción del LF final de contract-v5 fijada por hashes idéntica aA/B, sin normalización nueva ni redeploy. Dos lecturas extensas de captura devolvieron error interno MCP antes de activar; una lectura reducida y una transacción de SOLO LECTURA verificaron en PostgreSQL las mismas referencias, funciones, propietarios y ACL. La activación volvió a verificar integridad/concurrencia. No se omitió una condición ni se confundió ese error con generación.

Limpieza ejecutada una sola vez: transacción con recibo conciliado e igualdad completa de filas, referencias y scopes cerrados. Eliminados exactamente tres UUID de C: consentimiento, anamnesis y operación. Ningún borrado por fecha/email/patrón, ningún reseteo contable. Recibos del gasto y originales conservados en carpeta privada ignorada por Git.

Final: **27/27 referencias idénticas**, metadata/actores iguales, **16 funciones críticas** (definición/owner/ACL), **224 funciones** y roles/membresías/esquemas/triggers iguales; RLS y ACL intactos. v33/configuración/bundle idénticos antes/después. Configs Basic/reviewer vacías,0 intakes/operaciones Basic;19 rutinas,4 revisiones,22 workouts,4 notas y10 consentimientos preexistentes. Auth comparado por identidad/campos estables; no se afirma igualdad de timestamps de login.

Auditoría offline de evidencia: node tests/coach-flow/basic-quality-c-evidence.cjs. **14/14 comprobaciones nuevas**, distintas de las24 JWT. Requiere originales privados, sin red ni escrituras; no representa nuevas generaciones ni suma pruebas históricas.

## Entrega Git

Solo informe y auditoría saneados, PR #2 en borrador. Main 0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663 y PR #1 81fe65f4b9b5a9b7c3d905c2ea3c432f8ef5d839 intactos. No despliegues ni cambios de producción/Cloudflare/V5/prompt/cuestionario/SQL/RLS/cuotas/Financial P1/secretos. No nueva auditoría productiva: se confirma que esta ejecución no los modificó. **Detenido tras C; D requiere autorización independiente.**
