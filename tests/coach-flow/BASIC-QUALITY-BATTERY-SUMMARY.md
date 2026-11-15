# Basic V5 — comparación de las cinco generaciones reales

Cierre documental: 01/11/2026. Primera muestra intermedia y perfiles A/B/C/D. Solo D se ejecutó en esta fase; las otras cuatro evidencias se reutilizan sin nuevas llamadas o pruebas. Fuentes: [primera](BASIC-REAL-RESULTS.md), [A](BASIC-QUALITY-A-RESULTS.md), [B](BASIC-QUALITY-B-RESULTS.md), [C](BASIC-QUALITY-C-RESULTS.md), [D](BASIC-QUALITY-D-RESULTS.md).

## Resultado ejecutivo

Las cinco devolvieron propuestas estructuralmente válidas. Eso demuestra viabilidad del flujo y del contrato en estas muestras, no calidad universal ni eficacia de un entrenador autónomo de pago. Ninguna generación se aprobó o aceptó en estos ensayos de calidad.

A/B/C tienen dictamen documental de adecuación inicial supervisada con matices; la primera dejó revisión de cobertura y recuperación. D queda **HOLD humano** por la distribución femoral del viernes entre fútbol jueves/sábado y la información de carga ausente. No se identifica daño ni interferencia inevitables. No convertir cinco éxitos de JSON en una tasa estimada de éxito comercial.

## Matriz comparable

| Dato | Primera intermedia | A | B | C | D |
|---|---|---|---|---|---|
| Experiencia / esfuerzo | 1–2 años / confident | <6 meses / unknown | 1–2 años / confident | >4 años / habitual | 1–2 años / learning |
| Objetivo | balanced_mass | balanced_mass | balanced_mass | balanced_mass | regain_mass |
| Días / minutos | lu/mi/vi,60 | ma/vi,30 | ma/ju/sa,60 | lu/ma/ju/vi,75 | ma/vi,45 |
| Actividad | Running domingo | Ninguna | Ninguna | Ninguna | Fútbol jueves/sábado |
| Inventario | Gimnasio limitado | Mancuernas/bandas | 39 IDs | 39 IDs | 8 IDs |
| Series semanales | 30 | 10 | 30 | 47 | 14 |
| Series por sesión | 10/10/10 | 5/5 | 10/10/10 | 12/12/12/11 | 7/7 |
| Apariciones / ejercicios distintos | 15/12 | 6/5 | 15/11 | 20/19 | 8/8 |
| Series por ejercicio | 2 | 1–2 | 2 | 2–3 | 1–2 |
| RIR 0/1/2/3/4 | 0/9/21/0/0 | 0/0/0/0/10 | 0/16/14/0/0 | 7/29/11/0/0 | 0/0/0/14/0 |
| Duración estimada | 46:00/46:32/46:48 | 23:40/23:56 | 48:36/49:52/48:36 | 57:08/59:46/57:12/52:16 | 35:30/35:48 |
| Descansos bajo mínimo | 0 | 10 | 0 | 0 | 0 |
| Bajo preferido documentados | No comparado aquí | No comparado aquí | 10 | 6 | 13 |
| Avisos deportivos | 0 original v32; 5 al reevaluar v33 | 13 | 7 | 5 | 1 |
| Estado tras generación | pending_review | pending_review | pending_review | pending_review | pending_review |
| Estado final del ensayo | Limpiado | Limpiado | Limpiado | Limpiado | Limpiado |

No contar dos veces los cinco avisos posteriores de la primera muestra. No mezclar recuentos de evaluadores diferentes como si describieran diferencias del generador. El valor “ninguna actividad” es lo declarado, no toda la carga cotidiana. El objetivo de retorno D no acredita lesión ni desentrenamiento medido.

## Costes y latencias reales

Modelo común gpt-5.4-2026-03-05, tier default, caché 0. Un conteo y una generación por ensayo, sin reintentos. Los tiempos de intento incluyen la ruta de conteo/proveedor sin desglose; son observaciones, no benchmark controlado.

| Caso | Entrada | Salida | Coste tokens calculado USD | Intento ms | Ida/vuelta SDK ms |
|---|---:|---:|---:|---:|---:|
| Primera | 2454 | 2050 | 0,036885 | 27587 | 28308 |
| A | 2150 | 1864 | 0,033335 | 32818 | 34083 |
| B | 3667 | 1849 | 0,0369025 | 21723 | 22525 |
| C | 3702 | 2739 | 0,05034 | 28586 | 29393 |
| D | 2381 | 1581 | 0,0296675 | 25597 | 26280 |
| Total | **14354** | **10083** | **0,18713** | — | — |

[Tarifa oficial consultada 01/11/2026](https://developers.openai.com/api/docs/models/gpt-5.4): 2,50 USD/M entrada,15 USD/M salida estándar. Costes calculados a partir de usage; no facturas certificadas. Posibles cargos separados del conteo, impuestos y condiciones de cuenta no acreditados. Los cinco conteos no se presuponen gratuitos. Totales incluyen llamadas históricas, NO cinco llamadas nuevas en esta fase.

El mayor output de C coincide con más series/días, pero no permite inferir una ley de coste. A tardó más que C pese a ser menor: no atribuir latencia únicamente a tamaño o razonamiento.

## Cobertura directa y secundaria

Formato directas/secundarias. Conteo de etiquetas de catálogo, no equivalencia fisiológica. Las filas no suman series totales.

| Grupo | Primera | A | B | C | D |
|---|---:|---:|---:|---:|---:|
| Pectoral | 6/0 | 3/0 | 6/0 | 8/0 | 4/0 |
| Espalda | 6/0 | 2/0 | 6/0 | 8/0 | 4/0 |
| Cuádriceps | 6/0 | 2/0 | 6/0 | 8/0 | 2/0 |
| Femorales | 6/0 | 2/0 | 4/0 | 7/0 | 3/0 |
| Glúteos | 6/0 | 4/0 | 8/0 | 9/0 | 4/0 |
| Deltoides | 2/10 | 0/5 | 2/10 | 4/11 | 0/6 |
| Bíceps | 0/6 | 0/2 | 0/6 | 2/8 | 0/4 |
| Tríceps | 0/6 | 0/3 | 0/6 | 2/8 | 0/4 |
| Gemelos | 2/0 | 0/0 | 0/0 | 4/0 | 0/0 |
| Core | 2/4 | 1/4 | 4/0 | 4/3 | 1/2 |

Frecuencia: ambas intermedias de tres días reparten grandes grupos en 2–3 exposiciones; C los repite dos veces mediante upper/lower. A y D concentran algunos grandes grupos en un día. No es fallo universal de una rutina de dos días. Cobertura directa reducida de pequeños grupos es una observación repetida; no demuestra dosis insuficiente individual ni necesidad automática de aislamiento.

## Tendencias: observación frente a hipótesis

| Tema | Comprobado | No demostrado / alternativa válida |
|---|---|---|
| Experiencia y esfuerzo | A todo RIR 4; D todo RIR 3; intermedias RIR 1–2; C añade siete RIR 0 selectivos | No aislar causalidad del nivel: cambian días, tiempo, material y esfuerzo. No exigir fallo a avanzados. |
| Volumen | 10/14 series en A/D; 30 en ambas intermedias; 47 en C | No dosis óptima ni respuesta longitudinal conocida. Conservador no equivale a ineficaz. |
| Descansos | A diez bajo mínimo; B/C/D ninguno. B/C/D mantienen algunas bajo preferido | No fallo sistemático de mínimos. El número de avisos no refleja todas las referencias preferidas. |
| Pequeños grupos | C sí incluye brazos/gemelos directos; otros presentan coberturas menores o ausentes | No omisión universal ni equivalencia entre indirecto y directo. |
| Deporte | Primera muestra: recuperación tras running requirió reevaluación. D avisa después del jueves, omite antes del sábado por umbral | No inferir intensidad del deporte ni asumir que hubo optimización deliberada del modelo. |
| Distribución | C alterna superior/inferior en días consecutivos; D concentra femoral viernes entre fútbol | El primer split es defendible; el segundo requiere contexto humano, no prueba de daño. |
| Esquemas | Ambas intermedias usan 2 series; C combina 2/3 y straight/varied/top_backoff; A/D1–2 straight | No plantilla universal de dos series. Variedad alta no demuestra personalización mejor. |
| Progresión | Instrucción fija V5 por serie/bloque; orientativa para unknown/learning | No es narrativa individual del modelo ni adaptación automática a fatiga o rendimiento. |
| Tiempo | Todas pasan margen estructural estimado | No cronometraje real. Descansos finales y transiciones son heurísticos; no completar tiempo por obligación. |
| Elección | Material y exclusiones respetados en cinco; predominan aparatos cuando están disponibles | Disponibilidad no es preferencia; más pesos libres o repetición puede ser igualmente válido. |

## Limitaciones del evaluador demostradas

1. **Deporte bidireccional: ** D solo genera warning después del fútbol. La víspera depende de >4 series inferiores y ser la sesión más cargada; D tiene 3 y queda fuera. Conviene separar exposición temporal de valoración de demanda, sin implicar riesgo por proximidad.
2. **Mínimo frente a preferido: ** rest_performance_review depende de RIR≤1. D tiene 13 bajo preferido a RIR 3 sin aviso; C solo avisa en 2 de6. Debe entenderse como triage selectivo, no certificación de rendimiento.
3. **Cobertura pequeña por objetivo: ** small_direct_coverage solo para balanced_mass. D presenta ceros visibles en tabla pero ningún aviso. Decidir si basta la tabla o requiere contexto de revisión para regain_mass, sin mínimos universales.
4. **Métrica de volumen: ** series por etiquetas, sin kg/RIR real/tolerancia. Regiones deltoideas no desglosadas. No presentar sumas secundarias como volumen directo equivalente.

Estas observaciones no autorizaron cambiar código, V5, prompt, catálogo ni SQL.

## Prioridades para la siguiente revisión, propuestas únicamente

| Prioridad | Propuesta concreta | Evidencia / validación posterior |
|---|---|---|
| 1 | Revisar D con carga y horarios de fútbol, recuperación y familiaridad con RDL; decidir aceptar sin cambios o redistribuir | HOLD documental hasta resolver contexto. No otra generación automática ni datos de salud inventados. |
| 1 | Acordar avisos de proximidad antes/después independientes del umbral bruto, manteniendo demanda y dosis como contexto | Regresión offline con D conservado, sin repetir proveedor; si se autoriza modificar evaluador. |
| 2 | Mostrar claramente mínimo/preferido y su carácter orientativo al reviewer; revisar discrepancias en A y D | Usar outputs originales, falsos positivos a RIR alto y sensibilidad temporal. No imponer siempre el preferido. |
| 2 | Acordar cobertura por objetivo/tiempo y separar regiones donde exista evidencia catalogada | No añadir aislamientos o series para silenciar warnings; no ampliar catálogo sin necesidad. |
| 3 | Antes de pilotos con personas, segmentar autorización reviewer por propietario/operación y medir ejecución real | Requiere encargo/seguridad propios. El reviewer global del ensayo aislado no sirve como evidencia de aislamiento multiusuario concurrente. |
| 3 | Diseñar seguimiento supervisado de cargas, reps, RIR comprendido, duración y tolerancia | Cinco muestras sin entrenamientos no prueban progresión efectiva ni eficacia comercial. Sin activar usuarios todavía. |

No proponer cambiar el modelo por estos resultados ni generar muestras adicionales sin autorización. La decisión siguiente es una revisión conjunta del diagnóstico, antes de tocar generador o iniciar piloto con usuarios.

## Estado técnico de cierre

D:24/24 comprobaciones autenticadas y 14/14 de auditoría offline, separadas. Las anteriores no se vuelven a sumar. Tres filas sintéticas eliminadas, scopes/sesiones cerrados,27/27 referencias y seguridad restauradas; v33 intacta. Evidencia privada conserva gasto real, IDs de proveedor y originales; nada de ello se publica.

PR #2 permanece borrador; PR #1/main/producción/Cloudflare intactos. Solo documentación y auditoría. Sin aceptación, rutinas o entrenamientos nuevos. Batería cerrada; **ninguna llamada adicional autorizada**.
