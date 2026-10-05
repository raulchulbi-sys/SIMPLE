# Premium Fase 2 — evidencia final

Fecha: 2026-10-03. Staging únicamente. No publicación.

437/437 checks únicos con evidencia final: 352 Premium (incluidos 10 resultados reales), 85 Basic. No se suman repeticiones, las 3 comprobaciones UI de aceptación ya cubiertas por invariantes, ni los contadores históricos de Fase 1. Los controles finales de integridad/rollback se documentan aparte.

| Suite | Checks | Naturaleza |
|---|---:|---|
| unit | 28 | Local/mocks, sin red |
| login | 5 | JWT/datos sintéticos reales en staging |
| intake | 16 | JWT/datos sintéticos reales en staging |
| context | 34 | JWT/datos sintéticos reales en staging |
| reserve-mock-A | 1 | JWT/datos sintéticos reales en staging |
| mock-checks | 9 | JWT/datos sintéticos reales en staging |
| semantic | 21 | SQL en staging; lifecycle/tracking con rollback |
| review-keep-H | 3 | JWT/datos sintéticos reales en staging |
| ui | 106 | Chromium/WebKit, matriz final de replay; matriz previa con JWT reales |
| ui-edge | 54 | UI/transport simulado, sin backend |
| functional-resume-security | 26 | JWT/datos sintéticos reales en staging |
| lifecycle | 10 | SQL en staging; lifecycle/tracking con rollback |
| invariants | 15 | SQL en staging; lifecycle/tracking con rollback |
| tracking | 14 | SQL en staging; lifecycle/tracking con rollback |
| OpenAI A–H (H ×3) | 10 | 10 despachos reales, HTTP 200, schema + semántica aceptados |
| Basic intake v2 | 50 | Local, sin proveedor |
| Basic V5 | 35 | Local, proveedor simulado |

La suite histórica V4 falló en `balanced candidate, direct frequency` tanto en este worktree como en el base limpio 72fc545. Invoca el contrato vigente V5 con la propuesta scalar V4. No se cambió código/tests para ocultarlo ni se contabiliza como prueba superada.

Incidencias resueltas durante desarrollo: parser del arnés no aceptaba respuestas HTTP 204; una comprobación esperaba error HTTP para un UPDATE bloqueado por RLS que devolvía cero filas (se verificó el dato, no el status). Un generador SQL tenía una comilla ausente y se corrigió sin commit parcial. La UI no permitía reintentar tras error y se corrigió. El criterio por calendario heredado no alineaba futuras semanas con seguimiento: se corrigió en la ruta nueva y se validó 14/14 con output controlado. El fixture F inicialmente aceptado conservaba las semanas 2–3 según calendario; se documentó el hallazgo, no se reescribió ese fixture para ocultarlo. Todos esos datos se eliminaron después de verificar la corrección con una nueva aceptación transaccional.

## Llamadas reales y costes

Modelo `gpt-5.4-2026-03-05`; prompt `premium-analysis-v1`; response `premium-recommendation-v1`. Usage registrado y coste calculado con caché; no una factura. Sin reintentos ni errores reales.

| Caso | Semana | Resultado | Input | Cached | Output | USD | Latencia ms |
|---|---:|---|---:|---:|---:|---:|---:|
| A | 1 | KEEP | 3523 | 0 | 234 | 0.0123175 | 5040 |
| B | 1 | KEEP | 3511 | 0 | 201 | 0.0117925 | 3194 |
| C | 1 | KEEP | 3523 | 0 | 479 | 0.0159925 | 7218 |
| D | 1 | KEEP | 2842 | 0 | 206 | 0.0101950 | 5934 |
| E | 1 | KEEP | 3519 | 0 | 211 | 0.0119625 | 3880 |
| F | 1 | MODIFY | 3489 | 0 | 337 | 0.0137775 | 5270 |
| G | 1 | KEEP | 3523 | 0 | 433 | 0.0153025 | 6772 |
| H | 1 | KEEP | 3511 | 2816 | 206 | 0.0055315 | 3835 |
| H | 2 | KEEP | 3511 | 2816 | 202 | 0.0054715 | 3465 |
| H | 3 | KEEP | 3511 | 2816 | 199 | 0.0054265 | 3113 |

Total: **10/12 llamadas**, **0,1077695 / 0,50 USD**. 9 KEEP, 1 MODIFY, 0 REVIEW reales. Coste sin cached tokens en H habría sido mayor; se usa el uso real. Contador final conserva el coste, reserva 0 y enabled=false.

## Inputs sintéticos

Todos: adulto sintético, experiencia 2–4 años, objetivo equilibrado, dos días lunes/jueves, esfuerzo confiado/RIR con confianza media, recuperación mostly, sueño 7–8h, estrés medio, sin actividad externa ni salud. Equipo: mancuernas, banco y bandas; no equipo inventado. Dos ejercicios por día, 3 series de 8–12, RIR 2, 180 s salvo goblet 240 s. Duración 60 min, excepto G 30 min. F excluye db_curl. Inventario no implica preferencia. Se utilizan db_row/floor_press/goblet/db_curl, reordenados en F para ubicar curl en exercise_1. Ningún UUID/nombre personal/nota canary salió al provider.

## A — semana 1

Hechos comprobados: 8→9→10→11 reps a 20 kg, 3 series y RIR 2 en los cuatro ejercicios. La interpretación de progreso comparable es razonable; KEEP evita novedades. No inventa causalidad ni cambia prescripción. Confianza alta defendible para esta decisión, no garantía futura.

Salida estructurada **íntegra**, conservada tal como volvió del modelo; no sustituciones de nombres ni correcciones silenciosas:

```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "reps_increasing_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "reps_increasing_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "reps_increasing_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "reps_increasing_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "Hay progreso verificable sin señales objetivas en este contexto de que el volumen, reps, RIR o descansos deban ajustarse. Mantener evita cambios innecesarios en una semana temprana del mesociclo.",
  "changes": [],
  "confidence": "high",
  "interpretation": "La observación principal es una mejora comparable de repeticiones en los cuatro ejercicios con misma estructura, carga y RIR registrados. Eso sugiere que la prescripción actual está funcionando y no aporta una razón suficiente para cambiarla ahora.",
  "schema_version": "premium-recommendation-v1"
}
```

## B — semana 1

Cuatro exposiciones de 10 reps, 20 kg, 3 series/RIR 2. Estabilidad real; KEEP razonable. La frase «fase válida» está marcada como hipótesis, no atribuye una causa. Sin cambios de catálogo/volumen.

Salida estructurada **íntegra**, conservada tal como volvió del modelo; no sustituciones de nombres ni correcciones silenciosas:

```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "Observación: las tendencias registradas son estables y comparables en los cuatro ejercicios. Hipótesis: esta estabilidad puede encajar con una fase válida del mesociclo sin requerir cambios inmediatos.",
  "changes": [],
  "confidence": "high",
  "interpretation": "Las exposiciones comparables se mantienen estables en todos los ejercicios. No hay evidencia verificable de empeoramiento ni una señal suficiente que exija ajustar volumen, repeticiones, RIR o descansos.",
  "schema_version": "premium-recommendation-v1"
}
```

## C — semana 1

12→11→10→9 reps con carga/RIR/series comparables. Cita el descenso real y reconoce que sigue en 8–12. KEEP es una decisión prudente defendible con los datos disponibles, aunque aquí no se obtuvo MODIFY/REVIEW; no reinterpretar este caso como una modificación exitosa. No diagnostica fatiga.

Salida estructurada **íntegra**, conservada tal como volvió del modelo; no sustituciones de nombres ni correcciones silenciosas:

```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "La tendencia descendente merece seguimiento, pero por sí sola no justifica modificar volumen, RIR o descansos cuando la prescripción aún se está cumpliendo. Mantener permite confirmar si es una variación transitoria o una tendencia estable.",
  "changes": [],
  "confidence": "medium",
  "interpretation": "Se observa una bajada comparable de repeticiones en los cuatro ejercicios, pero la ejecución sigue dentro del rango prescrito y no hay un cambio de contexto suficiente que obligue a ajustar la rutina ahora mismo.",
  "schema_version": "premium-recommendation-v1"
}
```

## D — semana 1

Una exposición por ejercicio; insuficiente para tendencia. KEEP evita inferencias o cambios arbitrarios. Confianza high solo se puede leer como confianza en mantener, no evidencia sólida de rendimiento; aclaración recomendable antes de mostrar este indicador.

Salida estructurada **íntegra**, conservada tal como volvió del modelo; no sustituciones de nombres ni correcciones silenciosas:

```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "insufficient_data",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "insufficient_data",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "insufficient_data",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "insufficient_data",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "Observación: todos los ejercicios tienen datos insuficientes de tendencia. Hipótesis: mantener una semana más permitirá acumular exposiciones comparables antes de ajustar volumen, repeticiones, RIR o descansos.",
  "changes": [],
  "confidence": "high",
  "interpretation": "Hay muy poca información comparable para evaluar tendencia en esta rutina. La prescripción actual es razonable para hipertrofia y no hay evidencia suficiente para justificar cambios todavía.",
  "schema_version": "premium-recommendation-v1"
}
```

## E — semana 1

RIR 0→3→1→4 con iguales reps/carga/series. Señala correctamente que no hay comparabilidad suficiente. KEEP es prudente. Confianza high presenta la misma ambigüedad semántica que D; no se usa para aplicar cambios ni se muestra como fuerza de una tendencia.

Salida estructurada **íntegra**, conservada tal como volvió del modelo; no sustituciones de nombres ni correcciones silenciosas:

```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "context_changed_or_incomplete",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "context_changed_or_incomplete",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "context_changed_or_incomplete",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "context_changed_or_incomplete",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "Observación: hay cambios de contexto en RIR entre exposiciones, por lo que no conviene interpretar estabilidad o progreso solo por las repeticiones. Hipótesis: mantener la prescripción actual es la opción más prudente hasta reunir datos comparables.",
  "changes": [],
  "confidence": "high",
  "interpretation": "Los registros recientes no son comparables de forma suficiente para inferir una tendencia de rendimiento fiable en estos ejercicios.",
  "schema_version": "premium-recommendation-v1"
}
```

## F — semana 1

Rendimiento estable, pero el intake excluye explícitamente db_curl. Sustituye exclusivamente db_curl por band_curl, presente en catálogo, compatible con bandas y no excluido. Preserva 3 series, 8–12, RIR 2 y descanso 180 s; los otros tres ejercicios no cambian. Se verificó aceptación real de esta salida en staging, UUID nuevo, revisión 2 y autor model, sin heredar workouts/aliases. No es una equivalencia histórica ni una preferencia inferida por material.

Salida estructurada **íntegra**, conservada tal como volvió del modelo; no sustituciones de nombres ni correcciones silenciosas:

```json
{
  "kind": "MODIFY",
  "facts": [
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "No hay evidencia de rendimiento que obligue a ajustar volumen, repeticiones, RIR o descansos. La modificación propuesta es solo para alinear la rutina con la exclusión vigente de db_curl usando una alternativa permitida y disponible.",
  "changes": [
    {
      "action": "replace_exercise",
      "exercise_ref": "exercise_1",
      "to_catalogue_id": "band_curl",
      "from_catalogue_id": "db_curl"
    }
  ],
  "confidence": "high",
  "interpretation": "El rendimiento comparable registrado se ve estable en los ejercicios con datos. Aun así, hay un cambio de contexto relevante: la rutina incluye un ejercicio actualmente excluido por la persona usuaria.",
  "schema_version": "premium-recommendation-v1"
}
```

## G — semana 1

Descenso 12→11→10→9, 30 min por sesión y solo 2 ejercicios/6 series por día. El modelo consideró viable la estructura y devolvió KEEP. No se obtuvo un MODIFY real de volumen: la prueba de 3→2 series se realizó con respuesta controlada y aceptación atómica. No forzamos otro gasto para fabricar un resultado; cobertura real de este tipo pendiente de revisión.

Salida estructurada **íntegra**, conservada tal como volvió del modelo; no sustituciones de nombres ni correcciones silenciosas:

```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "La observación es un descenso descriptivo del rendimiento comparable, no una prueba de causa específica ni una señal suficiente por sí sola para modificar volumen, RIR o descansos. Mantener permite confirmar si la tendencia persiste antes de tocar la rutina.",
  "changes": [],
  "confidence": "medium",
  "interpretation": "Se observa una bajada comparable de repeticiones en los cuatro ejercicios, pero la prescripción actual sigue siendo viable porque el trabajo aún cae dentro del rango objetivo y no hay un problema de estructura que obligue a intervenir ya.",
  "schema_version": "premium-recommendation-v1"
}
```

## H — semana 1

Mismo historial estable en semanas de seguimiento 1, 2 y 3. Tres KEEP reales sin introducir novedades. Las tres aceptaciones conservaron la revisión 1 y completaron tres semanas, seguimiento 4. Es prueba de continuidad/idempotencia de seguimiento, no de tres semanas nuevas de entrenamiento ni de eficacia longitudinal.

Salida estructurada **íntegra**, conservada tal como volvió del modelo; no sustituciones de nombres ni correcciones silenciosas:

```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "Observación: todas las tendencias registradas son estables y comparables. Hipótesis: mantener la prescripción actual favorece seguir acumulando trabajo productivo sin introducir cambios innecesarios en esta fase.",
  "changes": [],
  "confidence": "high",
  "interpretation": "Las exposiciones comparables muestran estabilidad en todos los ejercicios, sin señales verificables que exijan ajustar volumen, repeticiones, RIR o descansos.",
  "schema_version": "premium-recommendation-v1"
}
```

## H — semana 2

Mismo historial estable en semanas de seguimiento 1, 2 y 3. Tres KEEP reales sin introducir novedades. Las tres aceptaciones conservaron la revisión 1 y completaron tres semanas, seguimiento 4. Es prueba de continuidad/idempotencia de seguimiento, no de tres semanas nuevas de entrenamiento ni de eficacia longitudinal.

Salida estructurada **íntegra**, conservada tal como volvió del modelo; no sustituciones de nombres ni correcciones silenciosas:

```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "Observación: las tendencias registradas son estables y comparables. Hipótesis: mantener la prescripción actual favorece seguir acumulando trabajo productivo mientras no aparezca una señal verificable de estancamiento relevante o deterioro.",
  "changes": [],
  "confidence": "high",
  "interpretation": "Las exposiciones comparables disponibles muestran un rendimiento estable en todos los ejercicios, sin una señal clara que justifique ajustar volumen, repeticiones, RIR o descansos en esta revisión.",
  "schema_version": "premium-recommendation-v1"
}
```

## H — semana 3

Mismo historial estable en semanas de seguimiento 1, 2 y 3. Tres KEEP reales sin introducir novedades. Las tres aceptaciones conservaron la revisión 1 y completaron tres semanas, seguimiento 4. Es prueba de continuidad/idempotencia de seguimiento, no de tres semanas nuevas de entrenamiento ni de eficacia longitudinal.

Salida estructurada **íntegra**, conservada tal como volvió del modelo; no sustituciones de nombres ni correcciones silenciosas:

```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "Observación: las tendencias registradas son estables y comparables. Hipótesis: mantener la prescripción actual favorece continuidad mientras no aparezca una señal clara de mejora sostenida o descenso comparable que justifique cambios.",
  "changes": [],
  "confidence": "high",
  "interpretation": "Las exposiciones comparables disponibles se mantienen estables en todos los ejercicios. No hay una señal verificable que exija ajustar volumen, repeticiones, RIR o descansos en esta revisión.",
  "schema_version": "premium-recommendation-v1"
}
```

## Hechos frente a interpretación

A: hecho verificable = 8, 9, 10, 11 reps a misma carga/series/RIR. Interpretación = la prescripción parece funcionar. C/G: el descenso está registrado; su causa no está demostrada y no se presenta como fatiga por sueño. E: RIR variable hace menos comparable la serie temporal; no se convierte el menor RIR en progreso. En todas las salidas, facts/ref/claim coinciden con métricas del contexto y SQL reconstruye los números desde exposures. La calidad de la explicación aún requiere juicio humano.

## Aceptación, permisos y concurrencia

F real: reviewer asignado → ready → aceptación del atleta en UI; dos clicks enviaron una solicitud; revisión 2 author=model, UUID nuevo de band_curl, antigua conservada y 8 workouts F intactos. H: tres KEEP reales aceptados, sin revisión nueva, seguimiento 4. Volumen G (mock): 3→2 sobre el mismo UUID, otros ejercicios intactos, nueva revisión atómica, semana previa preservada y futuras vinculadas a la nueva. REVIEW controlado: rechazo de aceptación directa/autoaprobación y trainer normal; resolución scoped a KEEP conserva output REVIEW original y no crea revisión vacía.

Dos solicitudes del mismo key reservan un ID; dos aceptaciones del mismo ID producen una revisión; dos recomendaciones distintas tienen un ganador. Un fallo a mitad de aplicación no deja revisión/ejercicio parcial. La recomendación real A queda superseded tras aceptar otra basada en la misma revisión. Respuestas tras revocar consentimiento o cambiar seguimiento quedan superseded. Cuotas/coste/cierre bloquean dispatch. Los tests SQL que alteran estado de prueba se deshacen completamente.

Reviewer asignado no obtiene workouts globales ni edición directa; otro client, trainer normal y anon no obtienen contexto/reserva/resolución/aceptación ajena. Nadie desde frontend puede bind/claim/finish ni otorgarse acceso. RLS existente y permisos Basic no se amplían.

## Integridad final y rollback

| Tabla | Staging count | Staging hash inicial=final | Producción count | Producción hash inicial=final |
|---|---:|---|---:|---|
| profiles | 5 | 452f6d5913c8cc0e7809b461462b3228 | 6 | 4683059cd3334a04b71e174f12a3a1c5 |
| routines | 15 | 0909488af798ae38f4a89583e40df866 | 5 | 8a57f77f511d010224660735565b30bb |
| routine_days | 17 | 11430094c2e8ac3b41f57ed03caf29f3 | 15 | 6d963aab542ed448c66e61db77a2567b |
| routine_exercises | 23 | c85f599ee5cfc9c659caa2a5551e1618 | 84 | 88cbfc49ac7f186b1a1f912e5acc0e5c |
| workouts | 22 | 4b19ebdff80ec48f81b552f6f94b96c7 | 68 | d4cbc657d85098ee4792873d6766d04a |
| routine_assignments | 12 | aa796cdff4da26c5bbd6084a0ecf354a | 3 | eae6c958bde90fdbf711c4b87699aa46 |
| routine_user_notes | 4 | 48112584c7a4991c4fb345da43de5b8b | 246 | 1e906639055fc54d3b5098733b2f1aaa |
| routine_share_codes | 17 | af5139cfd7b0d7fe90de38dea96aac85 | 19 | 496bbb34818c4330f9be61d7dff57aaa |
| routine_share_code_uses | 15 | e91f5d00c82301c5f7c836caed053cce | 10 | 0ce25b9ac29bd644469f26119d77ed8c |

Producción: 52 definiciones de función, hashes, owners, grants y search_path iguales al inicio; ciclo `88c3564c3c49cf9c53fccba89a1e71b5`. No DDL/DML/deploy ni cambios Auth/OAuth/SMTP/usuarios en producción. Patatasimple conserva UUID, role=client, 1 rutina y 1 workout; sus datos están incluidos en las huellas intactas. Main remoto sigue b15968c.

Rollback: se eliminaron únicamente los fixtures manifestados, se ejecutó rollback de Fase 2 y se compararon exactamente las 72 funciones de Fase 1. Se detectó una diferencia de hash por CRLF y se normalizó el generador a LF; el segundo control confirmó igualdad exacta. Después se reaplicó el SQL final, 82 funciones: 70 antiguas idénticas, 2 APIs Premium actualizadas y 10 funciones nuevas. Los 12 cuerpos nuevos/reemplazados coinciden con el SQL candidato; Edge v1 verify_jwt=true y cinco archivos coinciden con el candidato. Premium mesocycles/weeks/recommendations/revisions/grants/access=0; contador privado cerrado. No usuarios Auth nuevos; cinco usuarios sintéticos de pruebas preexistentes conservados.

## Preview y capturas

http://127.0.0.1:4233/review — replay offline de outputs reales, acciones locales simuladas claramente identificadas. Matriz 320/360/390/430/1280, claro/oscuro, Chromium/WebKit. Capturas locales en results/: MODIFY-390-light/dark, MODIFY-1280-light/dark, MODIFY-ready-390, MODIFY-accepted-390, multiple-390-light/dark. No se publican capturas/manifiestos/JWT/resultados crudos.

## Decisión para revisión

Candidato de Fase 2 preparado y staging limpio; **no autorizado ni listo para producción sin revisión**. Cobertura pendiente: obtener REVIEW real y un MODIFY real de volumen; no afirmamos que los mocks sean OpenAI. El contrato solo representa prescripción uniforme heredada; cambios individualizados/top set/back-off requieren REVIEW y otra adaptación explícita. La confianza en D/E no es evidencia fuerte. No hay prueba longitudinal de eficacia ni acceso comercial Premium. No continuar Fase 3 automáticamente.
