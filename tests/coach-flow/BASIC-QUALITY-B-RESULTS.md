# Basic V5 — perfil B: generación real y evaluación deportiva

Ensayo: 01/11/2026, Europe/Madrid. Exclusivamente SIMPLE Security Test. Base remota PR #2: 0f163f55555dc5a8696a80ace2f41bafd5311631. PR en borrador; sin despliegue. C/D no ejecutados.

## Dictamen documental

**ADECUADA como propuesta inicial general para un intermedio en un piloto supervisado, con cobertura de músculos pequeños pendiente de valoración humana.** Dictamen asistido por IA, no aprobación del reviewer ni aceptación en la aplicación. No demuestra resultados de hipertrofia ni equivalencia con un entrenador autónomo de pago.

V5 válido, cero fallos estructurales, 30 series, 11 ejercicios distintos y 7 warnings informativos conservados. No se identifica contradicción importante demostrada con días, material, exclusión o experiencia. La ausencia de gemelos es el punto más débil para un objetivo equilibrado: no recibe trabajo directo ni secundario según el catálogo. No se convierte automáticamente en rechazo por faltar un aislamiento ni se afirma que el volumen de brazos sea insuficiente para esta persona.

## Petición y recibo real

| Campo | Resultado |
|---|---|
| Edge | simple-coach-mock v33, ACTIVE, verify_jwt=true |
| Bundle SHA256 | 0de5d740f29f5615cfea2e1678f95f25f7528d6bea996e50ee1e5e543e3f4c20 |
| Modelo devuelto | gpt-5.4-2026-03-05 |
| Contrato / cuestionario | basic-initial-v5 / basic-intake-v2 |
| Parámetros | tier default; store=false; truncation=disabled; reasoning low; sin herramientas |
| Bytes finales | 15192 / máximo 16384; margen 1192 bytes |
| Hash preparado | 58250f060ebd355cbb459a09ffec8cab37ff65bf066454bc2f8a46cfe68e766e |
| Hash efectivo | a7b16b42820de67e114bd4edecca901926562bfbc55d4075ddb57aa18dd27794 |
| Conteos / generaciones | 1 / 1; sin reintentos |
| Conteo y entrada efectiva | 3667 / 3667 tokens |
| Salida / caché | 1849 / 0 tokens |
| Recibo | HTTP 200; receipt_within_limits |
| Latencia proveedor/conteo | 21723 ms |
| Resultado Edge / ida-vuelta SDK | 21725 / 22525 ms |
| Coste calculado | **0,0369025 USD** |
| Estado antes de limpieza | pending_review |

Cálculo: (3667 × 2,50 + 1849 × 15) / 1.000.000 = 0,0091675 + 0,027735 USD. Coincide con estimated_cost. El uso proviene del recibo real de OpenAI recogido por la Edge; no se ha acreditado factura, cargo definitivo, impuestos ni posibles cargos separados del conteo. No se afirma un techo monetario contractual. Máximo condicionado autorizado: 0,1068 USD por tokens a tarifa estándar.

[Tarifa oficial GPT-5.4, consultada 01/11/2026](https://developers.openai.com/api/docs/models/gpt-5.4). Endpoint global api.openai.com, sin selección regional; la región de Supabase no implica por sí misma recargo de OpenAI. Límites intactos: 12000 entrada contada / 5120 salida. No se detectó tarifa/modalidad inesperada en la configuración comprobable.

Cuerpo congelado antes del dispatch. Cambio de hash exclusivamente por orden de propiedades JSONB: igualdad semántica comprobada, sin recortar prompt, catálogo o contexto. Una intención persistente, mismo owner/intake/key. IDs de respuesta, petición y usuarios privados. Se conserva la propuesta normalizada ORIGINAL de la Edge, no el sobre HTTP bruto ni el JSON compacto previo a decodeOutput.

## Anamnesis exacta

- experience=y1_2; goal=balanced_mass; days=3; weekdays=[tue,thu,sat]; minutes=60; effort=confident.
- excluded=[bar_squat]; activity={type:none,weekdays:[]}; inventory.custom=[].
- Sin datos personales o salud. El atleta no eligió ejercicios a incluir.
- Inventario versionado de 39 IDs: chest_press, incline_press, convergent_press, pec_deck, pulldown, horizontal_row, convergent_row, supported_row, high_row, low_row, pullover, pullup, hack, pendulum, press45, horizontal_press, leg_extension, seated_curl, lying_curl, adductor, abductor, hip_thrust, seated_calf, standing_calf, shoulder_press, lateral, rear_delt, preacher, curl, triceps, smith, bench, barbell, rack, dumbbells, cables, bands, ab_machine, ab_wheel.

## Rutina completa original

Nombre: **Basic · rutina inicial**. Esquema straight en todos los ejercicios. Ambas series se enumeran. No se inventan cargas.

### Martes — 5 ejercicios, 10 series

| Orden | Ejercicio / ID | Serie | Reps | RIR | Descanso |
|---|---|---:|---:|---:|---|
| 1 | Sentadilla hack / hack | 1 | 8–10 | 2 | 3,5 min |
| 1 | Sentadilla hack / hack | 2 | 8–10 | 2 | 3,5 min |
| 2 | Press de pecho en máquina / chest_press | 1 | 8–10 | 2 | 3 min |
| 2 | Press de pecho en máquina / chest_press | 2 | 8–10 | 2 | 3 min |
| 3 | Jalón al pecho / pulldown | 1 | 8–10 | 2 | 3 min |
| 3 | Jalón al pecho / pulldown | 2 | 8–10 | 2 | 3 min |
| 4 | Curl femoral sentado / seated_curl | 1 | 10–12 | 1 | 2 min |
| 4 | Curl femoral sentado / seated_curl | 2 | 10–12 | 1 | 2 min |
| 5 | Elevaciones laterales en máquina / lateral | 1 | 12–15 | 1 | 1,5 min |
| 5 | Elevaciones laterales en máquina / lateral | 2 | 12–15 | 1 | 1,5 min |

Estimación V5: **48 min 36 s**, mostrada 49 min. Margen hasta 60 min: 11 min 24 s. Cuatro series inferiores. Seis superiores.

### Jueves — 5 ejercicios, 10 series

| Orden | Ejercicio / ID | Serie | Reps | RIR | Descanso |
|---|---|---:|---:|---:|---|
| 1 | Prensa de piernas / leg_press | 1 | 10–12 | 2 | 3,5 min |
| 1 | Prensa de piernas / leg_press | 2 | 10–12 | 2 | 3,5 min |
| 2 | Press inclinado en máquina / incline_press | 1 | 8–10 | 2 | 3 min |
| 2 | Press inclinado en máquina / incline_press | 2 | 8–10 | 2 | 3 min |
| 3 | Remo horizontal en máquina / horizontal_row | 1 | 8–10 | 2 | 3 min |
| 3 | Remo horizontal en máquina / horizontal_row | 2 | 8–10 | 2 | 3 min |
| 4 | Hip thrust en máquina / hip_thrust | 1 | 10–12 | 1 | 2,5 min |
| 4 | Hip thrust en máquina / hip_thrust | 2 | 10–12 | 1 | 2,5 min |
| 5 | Crunch abdominal en máquina / machine_crunch | 1 | 12–15 | 1 | 1,5 min |
| 5 | Crunch abdominal en máquina / machine_crunch | 2 | 12–15 | 1 | 1,5 min |

Estimación V5: **49 min 52 s**, mostrada 50 min. Margen hasta 60 min: 10 min 8 s. Cuatro series inferiores. Cuatro superiores y dos de zona media.

### Sábado — 5 ejercicios, 10 series

| Orden | Ejercicio / ID | Serie | Reps | RIR | Descanso |
|---|---|---:|---:|---:|---|
| 1 | Sentadilla en multipower / smith_squat | 1 | 8–10 | 2 | 3,5 min |
| 1 | Sentadilla en multipower / smith_squat | 2 | 8–10 | 2 | 3,5 min |
| 2 | Press de pecho en máquina / chest_press | 1 | 8–10 | 1 | 3 min |
| 2 | Press de pecho en máquina / chest_press | 2 | 8–10 | 1 | 3 min |
| 3 | Remo horizontal en máquina / horizontal_row | 1 | 8–10 | 1 | 3 min |
| 3 | Remo horizontal en máquina / horizontal_row | 2 | 8–10 | 1 | 3 min |
| 4 | Curl femoral sentado / seated_curl | 1 | 10–12 | 1 | 2 min |
| 4 | Curl femoral sentado / seated_curl | 2 | 10–12 | 1 | 2 min |
| 5 | Crunch abdominal en máquina / machine_crunch | 1 | 12–15 | 1 | 1,5 min |
| 5 | Crunch abdominal en máquina / machine_crunch | 2 | 12–15 | 1 | 1,5 min |

Estimación V5: **48 min 36 s**, mostrada 49 min. Margen hasta 60 min: 11 min 24 s. Cuatro series inferiores. Cuatro superiores y dos de zona media.

Instrucción original:

> Respeta el RIR de cada serie. RIR 0 significa no poder completar otra repetición con técnica estable; no fuerces repeticiones. Progresa cada serie o bloque por separado: cuando alcances su techo de reps con el RIR indicado y técnica estable, aumenta ligeramente su carga. Ajusta la carga entre bloques si cambian los objetivos. No se automatizan pesos ni cambios de rutina.

## Diez dimensiones de la rúbrica previa

| Dimensión | 0/1/2/ND | Juicio y evidencia |
|---|---:|---|
| Objetivo y experiencia | 2 | Adecuado como inicio: 30 series, RIR1–2, estabilidad y ausencia de fallo obligatorio. Sin volumen previo individual para afirmar dosis óptima. |
| Días, tiempo y material | 2 | Días exactos, 48:36/49:52/48:36 estimados, requisitos disponibles y bar_squat ausente. |
| Ejercicios y patrones | 2 | Rodilla, extensión de cadera, flexión de rodilla, empujes, tirones y core. No RDL ni press vertical: alternativas, no obligatorias. |
| Volumen muscular | 1 | Grandes grupos cubiertos; deltoides 2 directas, brazos 0 directas con participación secundaria, gemelos 0/0. Revisar equilibrio sin mínimos universales. |
| Frecuencia y distribución | 2 | Full-body separados 48/48/72 h nominales; 10 series y cuatro inferiores cada día. Recuperación no medida. |
| Reps, RIR y descansos | 2 | 8–15 reps, 14 series RIR2 y 16 RIR1; cero RIR0. Cumple mínimos orientativos, con matices de preferencia. |
| Actividad externa | 2 | No declarada: no se inventa deporte ni interferencia. No implica conocer toda su actividad diaria. |
| Progresión y seguimiento | 2 | Series idénticas, subir carga al techo de reps conservando RIR/técnica; incrementos concretos pendientes. |
| Revisión humana | 1 | Siete avisos; revisar gemelos, intención de exclusión y margen real de tiempo. Sin datos de tolerancia/resultados. |
| Personalización | 2 | Días, tiempo, material, exclusión y esfuerzo respetados; mayor exigencia que A. No prueba personalización excelente con tres muestras. |

No se utiliza suma/promedio como aprobación. No hay fallo importante demostrado que obligue a HOLD. Si el humano confirma exclusión de cualquier sentadilla, material efectivo distinto o dosis intolerable, debe aclararse antes de aceptar; no se inventan esos supuestos ahora.

## Volumen directo, secundario y frecuencia

Conteo del catálogo V5, no equivalencia fisiológica. Una serie puede contribuir a varios grupos: no sumar filas para obtener 30 series. Espalda alta es subconjunto de espalda. Regiones del deltoides: ND, no están desglosadas; tampoco se inventa participación no catalogada.

| Grupo | Directas | Secundarias | Frecuencia directa / secundaria |
|---|---:|---:|---|
| Pectoral | 6 | 0 | 3 / 0 |
| Espalda / dorsal | 6 | 0 | 3 / 0 |
| Espalda alta (subconjunto de espalda) | 4 | 0 | 2 / 0 |
| Cuádriceps | 6 | 0 | 3 / 0 |
| Femorales | 4 | 0 | 2 / 0 |
| Glúteos | 8 | 0 | 3 / 0 |
| Deltoides | 2 | 10 | 1 / 3 |
| Bíceps | 0 | 6 | 0 / 3 |
| Tríceps | 0 | 6 | 0 / 3 |
| Gemelos | 0 | 0 | 0 / 0 |
| Core | 4 | 0 | 2 / 0 |
| Aductores | 0 | 0 | 0 / 0 |

Origen: pecho=press horizontal/inclinado; espalda=jalón/remo; cuádriceps=hack/prensa/multipower; glúteos=esos tres+hip thrust; femoral=curl sentado; deltoides=laterales directas y presses/remos secundarios; bíceps=tirones; tríceps=presses; core=crunch. Series secundarias no se convierten en directas.

Distribución sin duplicados: **inferior 12/30 (40%), superior 14/30 (46,7%), zona media 4/30 (13,3%)**. Patrones: squat=6; horizontal_push=6; vertical_pull=2; knee_flexion=4; shoulder_abduction=2; horizontal_pull=4; hip_extension=2; trunk_flexion=4.

Grandes grupos con 4–8 directas: dosis conservadora plausible, no suficiencia individual acreditada. Glúteos comparten trabajo de rodilla y añaden dos series propias; no especialización demostrada. Brazos: seis participaciones secundarias cada uno, respuesta desconocida. Gemelos: sin cobertura registrada, mejora prioritaria para discutir; no añadir series automáticamente.

## Selección, equipo y exclusiones

| Ejercicio | Material exigido | Papel |
|---|---|---|
| Sentadilla hack / hack | hack | squat; quads, glutes |
| Press de pecho en máquina / chest_press | chest_press | horizontal_push; chest |
| Jalón al pecho / pulldown | pulldown | vertical_pull; back |
| Curl femoral sentado / seated_curl | seated_curl | knee_flexion; hamstrings |
| Elevaciones laterales en máquina / lateral | lateral | shoulder_abduction; deltoids |
| Prensa de piernas / leg_press | press45 | squat; quads, glutes |
| Press inclinado en máquina / incline_press | incline_press | horizontal_push; chest |
| Remo horizontal en máquina / horizontal_row | horizontal_row | horizontal_pull; back, upper_back |
| Hip thrust en máquina / hip_thrust | hip_thrust | hip_extension; glutes |
| Crunch abdominal en máquina / machine_crunch | ab_machine | trunk_flexion; core |
| Sentadilla en multipower / smith_squat | smith | squat; quads, glutes |

Aparatos: 26 series de máquinas dedicadas, 2 de jalón (máquina de cable dedicada), 2 de multipower/barra guiada; **0 pesos libres y 0 polea regulable independiente**. Se separa jalón para no duplicarlo como máquina/polea. Todo permitido; no obligación de utilizar cada aparato.

Mayoría de máquinas: opción válida, no prueba de preferencia del atleta. Se describen compatibilidades con la entrada, no el razonamiento interno del modelo. Repetir press, remo, curl y crunch favorece seguimiento; cero duplicados dentro de un día. Disponibilidad no exige variedad.

bar_squat NO aparece. smith_squat sí: exclusión por ID concreto, no familia. No incumplimiento técnico; en un piloto con personas conviene confirmar si esa distinción refleja lo que pretendían excluir. Sin inferir lesiones ni razones no dadas.

## Descansos, esfuerzo y tiempo: comparación sin cambiar reglas

| Trabajo B | Descanso | Mínimo / preferido V5 | Lectura |
|---|---|---|---|
| Hack/multipower, RIR2, 8–10 | 3,5 min | 3 / 4 min | Sobre mínimo; 30 s bajo preferido. |
| Prensa, RIR2, 10–12 | 3,5 min | 3 / 3 min | Margen frente a referencia. |
| Presses/jalón/remos, RIR1–2 | 3 min | 2,5 / 3 min | Cumple preferencia. |
| Curl femoral, RIR1 | 2 min | 1,5 / 2 min | Cumple preferencia. |
| Hip thrust máquina, RIR1 | 2,5 min | 1,5 / 2 min | Catalogado accesorio; revisar coste real con carga exigente. |
| Laterales/crunch, RIR1 | 1,5 min | 1,5 / 2 min | Cumple mínimo; 30 s bajo preferido. |

**A: 10/10 series bajo mínimo; B: 0/30 bajo mínimo.** No se reproduce el patrón short_rest de A. Pero 10/30 series B quedan bajo el preferido: cuatro hack/multipower y seis laterales/crunch. El evaluador solo avisa de esta segunda condición en compuestos a RIR≤1, no aquí con RIR2/accesorios. Cero avisos NO significa alcanzar todos los preferidos ni rendimiento demostrado. No se cambió la regla.

Descansos B varían por demanda; no “intermedio=descanso fijo”. No puede atribuirse el resultado de A solo al nivel con dos muestras distintas. B: 16 series RIR1, 14 RIR2, media 1,4667; sin RIR0. Coherente con confident, tolerancia pendiente.

Tiempo V5: 5 min iniciales + 2 min por ejercicio + 4 s/repetición máxima y descanso tras cada serie, incluida la última. Sin colas ni calentamientos específicos medidos. Margen 11:24/10:08/11:24. Umbral estructural vigente 54 min, no ley fisiológica. No se comprimieron descansos.

Sensibilidad OFFLINE, sin editar: llevar los diez descansos citados al preferido sumaría 2/1/2 min; sesiones 50:36/50:52/50:36, aún bajo 54. No demuestra tiempo real ni ordena añadir volumen.

## Siete warnings originales

1. **duration_80_90** (Martes) Duración estimada entre el 80 y 90 % del tiempo disponible.

2. **duration_80_90** (Jueves) Duración estimada entre el 80 y 90 % del tiempo disponible.

3. **duration_80_90** (Sábado) Duración estimada entre el 80 y 90 % del tiempo disponible.

4. **small_direct_coverage** (deltoids) Cobertura para revisar: 2 series directas (días: 1) y participación secundaria en 10 series / 3 días. Comparación interna con la mediana de grandes grupos cubiertos (6 series), no un mínimo universal. Revisar si la selección y el trabajo indirecto encajan con el objetivo equilibrado; no exige aislamientos ni añadir series.

5. **small_direct_coverage** (biceps) Cobertura para revisar: 0 series directas (días: 0) y participación secundaria en 6 series / 3 días. Comparación interna con la mediana de grandes grupos cubiertos (6 series), no un mínimo universal. Revisar si la selección y el trabajo indirecto encajan con el objetivo equilibrado; no exige aislamientos ni añadir series.

6. **small_direct_coverage** (triceps) Cobertura para revisar: 0 series directas (días: 0) y participación secundaria en 6 series / 3 días. Comparación interna con la mediana de grandes grupos cubiertos (6 series), no un mínimo universal. Revisar si la selección y el trabajo indirecto encajan con el objetivo equilibrado; no exige aislamientos ni añadir series.

7. **small_direct_coverage** (calves) Cobertura para revisar: 0 series directas (días: 0) y participación secundaria en 0 series / 0 días. Comparación interna con la mediana de grandes grupos cubiertos (6 series), no un mínimo universal. Revisar si la selección y el trabajo indirecto encajan con el objetivo equilibrado; no exige aislamientos ni añadir series.

Informativos: no bloquearon pending_review, no cambiaron prescripción ni ejecutaron aprobación/aceptación. duration_80_90 describe margen, no exceso de límite. Sin aviso deportivo externo porque no se declaró actividad.

## Personalización y comparación

| Entrada B | Efecto observado / límite |
|---|---|
| 1–2 años | RIR1–2 frente RIR4 de A; mayor dosis. Sin historial de cargas. |
| Hipertrofia equilibrada | Grandes grupos/core; gemelos y cobertura pequeña mejorables. |
| Tres días | Full-body en fechas semanales exactas e intercaladas. |
| 60 min | Cinco ejercicios, diez series, 49–50 min estimados. |
| confident | Esfuerzo cercano al fallo, sin obligar RIR0; autoinforme no medición. |
| Gimnasio completo | Máquinas permitidas; no preferencia ni uso de todo. |
| bar_squat | Ausente; multipower distinto permitido. |
| Ninguna actividad externa | No se inventan interferencias. |

| Métrica | Primera intermedia | A | B |
|---|---|---|---|
| Días/tiempo | lu/mi/vi, 60 min | ma/vi, 30 min | ma/ju/sa, 60 min |
| Material | Inventario limitado gimnasio | Mancuernas/bandas | 39 elementos |
| Actividad | Running domingo | Ninguna | Ninguna |
| Series | 30 | 10 | 30 |
| Duración mostrada | 46/47/47 min | 24/24 min | 49/50/49 min |
| RIR | 1–2 | 4 | 1–2 |
| Bajo mínimo descanso | 0 | 10 | 0 |
| Cobertura pequeña | Avisos añadidos en reevaluación | 3 avisos | 4 avisos |
| Coste calculado USD | 0,036885 | 0,033335 | 0,0369025 |

Primera muestra generada en v32 y reevaluada offline con evaluador nuevo, sin reescribir recibo original. B introduce hack/multipower/hip thrust disponibles y no reproduce running inexistente. Cinco ejercicios ×dos series en ambas intermedias es razonable, no prueba suficiente de personalización excelente ni de plantilla defectuosa. Cobertura directa pequeña reducida es señal recurrente para revisar con más evidencia, sin mínimos rígidos ni causalidad inventada.

## Hallazgos, sin cambios de producto

- Fallos estructurales: ninguno. Problemas deportivos importantes demostrados: ninguno con la entrada disponible.
- Mejora recomendable: revisar gemelos y balance deltoides/brazos; considerar redistribuir si el humano lo justifica, no añadir aislamientos automáticamente.
- Incertidumbres: intención de exclusión, ajuste de máquinas, carga inicial, incrementos, tiempo y recuperación reales.
- Evaluador: distinguir mínimo de preferido; diez series bajo preferido sin short_rest no es por sí solo bug.
- Alternativas válidas: más pesos libres, repetir dominante de rodilla o distinto split. No penalizar por existir otra alternativa.
- Sin cambios de prompt, catálogo, cuestionario, V5, guard, SQL/RLS o programación. Sin generación correctora.

## Evidencia autenticada, cierre e integridad

24/24 comprobaciones SDK/JWT NUEVAS: cuatro logins/identidades/roles; generación disponible; cola vacía; consentimiento; intake exacto; operación única owner/intake/key; sin rutina/retry; privado denegado a otro client/trainer/reviewer; propuesta pendiente; proyección reviewer única; intento consumido sin retry. La etiqueta real es otro cliente sintético, no usuario real.

Recuperación por relectura real tras respuesta; no corte de red ni recarga nuevos. No mocks o HTTP anónimo. SDK2.115.0/arnés A reutilizados; solo perfil/hashes/bytes/UUID adaptados. Retry excluido. Tokens solo en memoria; sin persistSession/refresh automático; cuatro signOut(local) correctos.

Ventana abierta 11:33:11 Europe/Madrid; accesos observados cerrados 11:34:03 (<1 min; caducidad máxima60 min). Cero llamadas en vuelo al conciliar. Un conteo/una generación según log guard, recibo y operación. Nunca aprobada/aceptada; cero rutina/revisión/workout/nota.

Limpieza transaccional de tres UUID exactos: consentimiento, anamnesis, operación; igualdad completa con recibos, referencias/huellas y scopes cerrados. Primera confirmación de integración caducó sin ejecutar; lectura confirmó los tres registros. Se renovó MISMA confirmación/SQL y se limpió. Sin segunda generación ni reseteo financiero; consumo conservado en evidencia privada.

Final: 27/27 referencias iguales; 16 funciones críticas (definición/owner/ACL); 224 funciones y roles/membresías/esquemas/triggers iguales; RLS/ACL intactas. Configs vacíos; cero intakes/operaciones Basic; 19 rutinas, 4 revisiones, 22 workouts, 4 notas, 10 consentimientos preexistentes. Auth se compara por campos estables, no timestamps de login.

Preflight conserva excepción exacta del LF final de contract-v5.mjs fijada por hashes. Comparación inicial de catálogo usó nombres de argumentos en vez de OID y distinto orden de membresías; al emplear los mismos campos y orden canónico, igualdad confirmada sin relajar seguridad. Ninguna Edge redesplegada.

Auditoría offline: node tests/coach-flow/basic-quality-b-evidence.cjs, **14/14 comprobaciones nuevas superadas**; requiere originales privados ignorados por Git. Sus controles no se cuentan como JWT ni como pruebas históricas nuevas. Separadamente: 24/24 comprobaciones SDK/JWT reales del ensayo B. No se suman reejecuciones ni casos históricos.

## Estado de entrega

Solo informe/auditoría saneados en PR #2 borrador. Originales A/primera muestra intactos. Main 0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663 y PR #1 81fe65f4b9b5a9b7c3d905c2ea3c432f8ef5d839 intactos. Sin producción, Cloudflare, Auth/RLS, cuotas, Financial P1, secretos o clientes alterados por el ensayo; no nueva auditoría productiva. **Detenido tras B: C/D no ejecutados.**
