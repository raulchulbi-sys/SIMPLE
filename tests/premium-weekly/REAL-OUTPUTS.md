# Premium Phase 3 — seis outputs reales

Fecha de revisión: 2026-10-04. Fuente local ignorada: `results/weekly-real.json`. Estas **seis llamadas OpenAI nuevas** fueron ejecutadas por la tarea principal sobre staging, con `gpt-5.4-2026-03-05`, prompt y schema `premium-weekly-analysis-v1`, sin reintentos automáticos. Este informe selecciona íntegramente `analysis_trace.output` y `analysis_trace.receipt`; no exporta bundles, bindings, grants, snapshots ni identificadores internos.

Resultado capturado: **6/6 HTTP 200**, error null, schema_valid true y semantic_valid true. Cinco KEEP y un MODIFY; los seis quedaron pending_review al finalizar la respuesta del proveedor. La validación local de los seis outputs contra sus contextos capturados vuelve a pasar semántica y confirma los avisos registrados. La revisión humana, aceptación y limpieza se documentan en el informe principal.

| Caso | Semana | Decisión | Input tokens | Output tokens | Cached | USD | Latencia ms | Calidad |
|---|---:|---|---:|---:|---:|---:|---:|---|
| Longitudinal W4 tras KEEP/KEEP/MODIFY | 4 | KEEP | 8479 | 305 | 0 | 0.0257725 | 5046 | Schema/semántica PASS; sin avisos |
| Descenso repetido y checkin desfavorable | 1 | KEEP | 8279 | 509 | 0 | 0.0283325 | 7063 | Schema/semántica PASS; sin avisos |
| Descenso con checkin favorable | 1 | KEEP | 8277 | 517 | 0 | 0.0284475 | 8167 | Schema/semántica PASS; sin avisos |
| Checkin ausente y una exposición | 1 | KEEP | 5781 | 219 | 0 | 0.0177375 | 2753 | Schema/semántica PASS; checkin_missing |
| Disponibilidad de cinco a cuatro weekdays | 1 | MODIFY | 9377 | 742 | 0 | 0.0345725 | 8064 | Schema/semántica PASS; sin avisos |
| Solicitud de revisar exercise_3 | 1 | KEEP | 8268 | 343 | 0 | 0.0258150 | 6129 | Schema/semántica PASS; sin avisos |

Coste adicional: **0.1606775 USD**, 48.461 input tokens y 2.635 output tokens, con cero tokens cacheados. Recálculo por receipt: input×2.5/1M + output×15/1M, coincidente en los seis casos. Junto a las 14 llamadas históricas de Phase 2 (**0.194317 USD**), el acumulado es **20 llamadas / 0.3549945 USD**. Las 14 anteriores siguen siendo evidencia histórica; el replay de F y las regresiones SQL/mock no añadieron llamadas OpenAI ni coste. El límite adicional autorizado era diez llamadas y 0.35 USD; esta ejecución usó seis y 0.1606775 USD.

## Valoración humana

- **Longitudinal W4 — KEEP:** coherente con cuatro exposiciones comparables crecientes de N+1, hack de dos series y otros ejercicios de tres, tras KEEP/KEEP/MODIFY. Conserva el ajuste reciente y separa el checkin favorable de una prueba causal del rendimiento.
- **Descenso repetido — KEEP:** válido y conservador. Las cuatro exposiciones uniformes van de 12 a 9 repeticiones por serie y permanecen en el rango 8–12; la afirmación de que siguen dentro del objetivo es exacta. El descenso repetido y las señales desfavorables también permitirían una revisión humana más cauta. Estar dentro del rango no descarta por sí solo un ajuste, y el contrato no obliga a bajar volumen automáticamente.
- **Discrepancia — KEEP:** reconoce el descenso con carga, RIR y estructura comparables, a la vez que el checkin favorable; no convierte esa discrepancia en una causa inventada. La ausencia de series fuera del rango es correcta para este fixture.
- **Checkin ausente — KEEP:** cita insufficient_data y deja checkin_signals vacío. Con una exposición por ejercicio no inventa normalidad ni una tendencia. Confidence high expresa seguridad en mantener, no evidencia abundante de evolución; el aviso checkin_missing permanece registrado.
- **Disponibilidad — MODIFY:** cambio real pequeño de schedule, sin regenerar ejercicios. Preserva day_1 a day_5 y mueve day_3 del miércoles al jueves; day_3 y day_4 suman 30+30=60 minutos ese jueves. Usa cuatro weekdays permitidos, cubre las estimaciones 19/22/19/19/19 minutos y conserva series, repeticiones, RIR y descansos. Cinco sesiones lógicas siguen existiendo.
- **Solicitud de ejercicio — KEEP:** legítimo con rendimiento estable y sin motivo verificable de replacement. La señal review=exercise reconoce el contexto. Una mejora menor sería explicar expresamente por qué se conserva exercise_3; pedir revisarlo no obliga a cambiarlo.

## Outputs y receipts íntegros

Los objetos siguientes mantienen todos los campos y valores capturados de output y receipt. El formato de presentación no pretende reproducir bytes del transporte HTTP.

### Longitudinal W4 tras KEEP/KEEP/MODIFY — KEEP

```json
{
  "output": {
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
    "reason": "La revisión actual parece estar funcionando y no hay evidencia suficiente para justificar otro ajuste tras la modificación reciente de la semana previa. Mantener evita introducir cambios innecesarios cuando el rendimiento comparable sigue mejorando.",
    "changes": [],
    "confidence": "high",
    "interpretation": "La observación principal es una tendencia comparable al alza en todos los ejercicios con datos consistentes. La señal declarada del check-in también es favorable, pero se toma como contexto y no como prueba causal del rendimiento.",
    "schema_version": "premium-weekly-analysis-v1",
    "checkin_signals": [
      {
        "field": "sleep",
        "value": "good"
      },
      {
        "field": "stress",
        "value": "low"
      },
      {
        "field": "fatigue",
        "value": "low"
      },
      {
        "field": "recovery",
        "value": "good"
      },
      {
        "field": "session_perception",
        "value": "easier"
      },
      {
        "field": "availability",
        "value": "unchanged"
      },
      {
        "field": "review",
        "value": "none"
      }
    ]
  },
  "receipt": {
    "model": "gpt-5.4-2026-03-05",
    "status": 200,
    "cost_usd": 0.0257725,
    "latency_ms": 5046,
    "input_tokens": 8479,
    "schema_valid": true,
    "output_tokens": 305,
    "prompt_version": "premium-weekly-analysis-v1",
    "semantic_valid": true,
    "cached_input_tokens": 0,
    "response_schema_version": "premium-weekly-analysis-v1"
  }
}
```

### Descenso repetido y checkin desfavorable — KEEP

```json
{
  "output": {
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
    "reason": "Observación: las cuatro tendencias comparables descienden, mientras la adherencia semanal se mantiene. Señal declarada: sueño malo, estrés alto, fatiga muy alta, recuperación mala y sesiones mucho más duras. Hipótesis: esta combinación puede reflejar una semana transitoriamente más difícil, pero por sí sola no justifica modificar volumen, esfuerzo o descansos sin salir del objetivo prescrito.",
    "changes": [],
    "confidence": "medium",
    "interpretation": "Se observa una bajada comparable de repeticiones en los cuatro ejercicios, pero el rendimiento sigue dentro de los rangos prescritos y no hay evidencia suficiente para concluir que la programación deba cambiarse esta semana.",
    "schema_version": "premium-weekly-analysis-v1",
    "checkin_signals": [
      {
        "field": "recovery",
        "value": "bad"
      },
      {
        "field": "sleep",
        "value": "bad"
      },
      {
        "field": "fatigue",
        "value": "very_high"
      },
      {
        "field": "stress",
        "value": "high"
      },
      {
        "field": "session_perception",
        "value": "much_harder"
      },
      {
        "field": "availability",
        "value": "unchanged"
      },
      {
        "field": "review",
        "value": "none"
      }
    ]
  },
  "receipt": {
    "model": "gpt-5.4-2026-03-05",
    "status": 200,
    "cost_usd": 0.0283325,
    "latency_ms": 7063,
    "input_tokens": 8279,
    "schema_valid": true,
    "output_tokens": 509,
    "prompt_version": "premium-weekly-analysis-v1",
    "semantic_valid": true,
    "cached_input_tokens": 0,
    "response_schema_version": "premium-weekly-analysis-v1"
  }
}
```

### Descenso con checkin favorable — KEEP

```json
{
  "output": {
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
    "reason": "Se mantiene la rutina porque hay comparabilidad suficiente para observar descenso, pero no hay motivo sólido para modificar aún: no hay series fuera del objetivo, no hay cambios recientes que revertir y el check-in no confirma por sí mismo una necesidad de bajar o subir volumen/esfuerzo.",
    "changes": [],
    "confidence": "medium",
    "interpretation": "Observación: en los cuatro ejercicios comparables hay descenso de repeticiones con misma estructura, carga y RIR, pero las series actuales siguen dentro del rango prescrito. Señal declarada: sueño, recuperación y fatiga son favorables y la percepción de sesión fue más fácil. Hipótesis: hay una discrepancia entre el rendimiento comparable y la percepción subjetiva, pero esta semana no obliga por sí sola a ajustar la rutina.",
    "schema_version": "premium-weekly-analysis-v1",
    "checkin_signals": [
      {
        "field": "recovery",
        "value": "good"
      },
      {
        "field": "sleep",
        "value": "good"
      },
      {
        "field": "fatigue",
        "value": "low"
      },
      {
        "field": "stress",
        "value": "low"
      },
      {
        "field": "session_perception",
        "value": "easier"
      },
      {
        "field": "availability",
        "value": "unchanged"
      },
      {
        "field": "review",
        "value": "none"
      }
    ]
  },
  "receipt": {
    "model": "gpt-5.4-2026-03-05",
    "status": 200,
    "cost_usd": 0.0284475,
    "latency_ms": 8167,
    "input_tokens": 8277,
    "schema_valid": true,
    "output_tokens": 517,
    "prompt_version": "premium-weekly-analysis-v1",
    "semantic_valid": true,
    "cached_input_tokens": 0,
    "response_schema_version": "premium-weekly-analysis-v1"
  }
}
```

### Checkin ausente y una exposición — KEEP

```json
{
  "output": {
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
    "reason": "Con una sola exposición por ejercicio no hay evidencia suficiente para justificar cambios en volumen, repeticiones, RIR o descansos. Mantener la revisión actual es la opción más prudente.",
    "changes": [],
    "confidence": "high",
    "interpretation": "Hay adherencia esta semana, pero cada ejercicio solo tiene una exposición comparable registrada. La observación principal es que aún no hay base suficiente para evaluar tendencia de rendimiento.",
    "schema_version": "premium-weekly-analysis-v1",
    "checkin_signals": []
  },
  "receipt": {
    "model": "gpt-5.4-2026-03-05",
    "status": 200,
    "cost_usd": 0.0177375,
    "latency_ms": 2753,
    "input_tokens": 5781,
    "schema_valid": true,
    "output_tokens": 219,
    "prompt_version": "premium-weekly-analysis-v1",
    "semantic_valid": true,
    "cached_input_tokens": 0,
    "response_schema_version": "premium-weekly-analysis-v1"
  }
}
```

### Disponibilidad de cinco a cuatro weekdays — MODIFY

```json
{
  "output": {
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
      },
      {
        "claim": "stable_comparable",
        "exercise_ref": "exercise_5"
      }
    ],
    "reason": "Observación: las tendencias comparables disponibles son estables y no aportan una razón suficiente para modificar la prescripción de ejercicios. Señal declarada: la disponibilidad cambia de 5 días de 30 minutos a 4 días de 60 minutos. Hipótesis operativa: una redistribución semanal pequeña permite acomodar la rutina sin tocar series, repeticiones, RIR ni descansos.",
    "changes": [
      {
        "to": [
          {
            "day_ref": "day_1",
            "minutes": 30,
            "weekday": "mon"
          },
          {
            "day_ref": "day_2",
            "minutes": 30,
            "weekday": "tue"
          },
          {
            "day_ref": "day_3",
            "minutes": 30,
            "weekday": "thu"
          },
          {
            "day_ref": "day_4",
            "minutes": 30,
            "weekday": "thu"
          },
          {
            "day_ref": "day_5",
            "minutes": 30,
            "weekday": "fri"
          }
        ],
        "from": [
          {
            "day_ref": "day_1",
            "minutes": 30,
            "weekday": "mon"
          },
          {
            "day_ref": "day_2",
            "minutes": 30,
            "weekday": "tue"
          },
          {
            "day_ref": "day_3",
            "minutes": 30,
            "weekday": "wed"
          },
          {
            "day_ref": "day_4",
            "minutes": 30,
            "weekday": "thu"
          },
          {
            "day_ref": "day_5",
            "minutes": 30,
            "weekday": "fri"
          }
        ],
        "action": "change_week_schedule"
      }
    ],
    "confidence": "high",
    "interpretation": "El rendimiento comparable se mantiene estable en los ejercicios observados. La señal principal de esta semana es un cambio declarado de disponibilidad, no una necesidad clara de ajustar volumen o esfuerzo.",
    "schema_version": "premium-weekly-analysis-v1",
    "checkin_signals": [
      {
        "field": "sleep",
        "value": "normal"
      },
      {
        "field": "stress",
        "value": "moderate"
      },
      {
        "field": "fatigue",
        "value": "normal"
      },
      {
        "field": "recovery",
        "value": "normal"
      },
      {
        "field": "session_perception",
        "value": "similar"
      },
      {
        "field": "availability",
        "value": "changed"
      },
      {
        "field": "review",
        "value": "none"
      }
    ]
  },
  "receipt": {
    "model": "gpt-5.4-2026-03-05",
    "status": 200,
    "cost_usd": 0.0345725,
    "latency_ms": 8064,
    "input_tokens": 9377,
    "schema_valid": true,
    "output_tokens": 742,
    "prompt_version": "premium-weekly-analysis-v1",
    "semantic_valid": true,
    "cached_input_tokens": 0,
    "response_schema_version": "premium-weekly-analysis-v1"
  }
}
```

### Solicitud de revisar exercise_3 — KEEP

```json
{
  "output": {
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
    "reason": "No hay una señal verificable suficiente para modificar la rutina esta semana. La estabilidad con datos comparables y sin cambios de disponibilidad permite conservar la prescripción actual.",
    "changes": [],
    "confidence": "high",
    "interpretation": "El rendimiento comparable se mantiene estable en todos los ejercicios observables. El check-in también describe una semana similar, con recuperación, fatiga, sueño y estrés en rangos normales/moderados.",
    "schema_version": "premium-weekly-analysis-v1",
    "checkin_signals": [
      {
        "field": "recovery",
        "value": "normal"
      },
      {
        "field": "sleep",
        "value": "normal"
      },
      {
        "field": "fatigue",
        "value": "normal"
      },
      {
        "field": "stress",
        "value": "moderate"
      },
      {
        "field": "session_perception",
        "value": "similar"
      },
      {
        "field": "availability",
        "value": "unchanged"
      },
      {
        "field": "review",
        "value": "exercise"
      }
    ]
  },
  "receipt": {
    "model": "gpt-5.4-2026-03-05",
    "status": 200,
    "cost_usd": 0.025815,
    "latency_ms": 6129,
    "input_tokens": 8268,
    "schema_valid": true,
    "output_tokens": 343,
    "prompt_version": "premium-weekly-analysis-v1",
    "semantic_valid": true,
    "cached_input_tokens": 0,
    "response_schema_version": "premium-weekly-analysis-v1"
  }
}
```
