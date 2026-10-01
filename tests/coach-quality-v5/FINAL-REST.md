# Ajuste final de descansos V5 — revisión desde 1b96f61

No publicado. A–F se conservan byte a byte y no se han regenerado. G/H son propuestas reales de staging, pendientes de revisión antes de limpiar sus fixtures; no aprobadas ni aceptadas. La evaluación de avisos siguiente usa el candidato final, sin retocar ninguna prescripción del modelo.

## Descansos reales A–H

Cada celda cuenta series; no se han normalizado los descansos históricos.

| Caso | 1 min | 1,25 min | 1,5 min | 2 min | 2,5 min | 3 min | 3,5 min | 4 min | Series | Minutos estimados por sesión |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 4 | — | 8 | 16 | 4 | — | — | — | 32 | 42 / 44 / 48 |
| B | 2 | 12 | 10 | — | — | — | — | — | 24 | 24 / 24 / 24 / 24 |
| C | 8 | — | 12 | 14 | 10 | — | — | — | 44 | 46 / 48 / 41 / 42 |
| D | — | — | 15 | 16 | 9 | — | — | — | 40 | 41 / 41 / 40 / 43 |
| E | — | — | 10 | 7 | 14 | 9 | — | — | 40 | 42 / 44 / 43 / 45 |
| F | — | — | 16 | 14 | 9 | 9 | — | — | 48 | 42 / 45 / 39 / 44 / 34 |
| G | — | — | 4 | 14 | 4 | 26 | — | 9 | 57 | 58 / 54 / 57 / 55 / 57 |
| H | — | — | — | 16 | — | 14 | 2 | 4 | 36 | 32 / 32 / 32 / 32 / 30 / 35 |

## Todas las ubicaciones RIR 0 — E/F/G/H

Aislamiento y máquina estable son dimensiones que se solapan: no sumar columnas. Gemelos se detalla como accesorio. La clasificación de alta demanda incluye banca además de fatigue_cost=high, sin cambiar el catálogo.

| Caso | RIR 0 | Aislamientos | Gemelos | Estables | Alta demanda |
| --- | --- | --- | --- | --- | --- |
| E | 12 | 8 | 2 | 12 | 2 |
| F | 12 | 10 | 2 | 12 | 0 |
| G | 11 | 11 | 0 | 11 | 0 |
| H | 16 | 14 | 2 | 16 | 0 |

### E

| Día | Ejercicio exacto | Serie | Descanso | Tipo | Alta demanda |
| --- | --- | --- | --- | --- | --- |
| Lunes | Elevaciones laterales en máquina | 1 | 1,5 min | isolation | No |
| Lunes | Elevaciones laterales en máquina | 2 | 1,5 min | isolation | No |
| Martes | Sentadilla hack | 2 | 3 min | machine_compound | Sí |
| Martes | Sentadilla hack | 3 | 3 min | machine_compound | Sí |
| Martes | Gemelo sentado | 1 | 1,5 min | calf | No |
| Martes | Gemelo sentado | 2 | 1,5 min | calf | No |
| Jueves | Pájaros en máquina | 1 | 1,5 min | isolation | No |
| Jueves | Pájaros en máquina | 2 | 1,5 min | isolation | No |
| Sábado | Extensión de cuádriceps | 1 | 1,5 min | isolation | No |
| Sábado | Extensión de cuádriceps | 2 | 1,5 min | isolation | No |
| Sábado | Crunch abdominal en máquina | 1 | 1,5 min | isolation | No |
| Sábado | Crunch abdominal en máquina | 2 | 1,5 min | isolation | No |

### F

| Día | Ejercicio exacto | Serie | Descanso | Tipo | Alta demanda |
| --- | --- | --- | --- | --- | --- |
| Lunes | Elevaciones laterales en máquina | 1 | 1,5 min | isolation | No |
| Lunes | Elevaciones laterales en máquina | 2 | 1,5 min | isolation | No |
| Martes | Curl femoral sentado | 1 | 1,5 min | isolation | No |
| Martes | Curl femoral sentado | 2 | 1,5 min | isolation | No |
| Martes | Gemelo sentado | 1 | 1,5 min | calf | No |
| Martes | Gemelo sentado | 2 | 1,5 min | calf | No |
| Miércoles | Curl Scott en máquina | 1 | 1,5 min | isolation | No |
| Miércoles | Curl Scott en máquina | 2 | 1,5 min | isolation | No |
| Viernes | Curl femoral sentado | 1 | 1,5 min | isolation | No |
| Viernes | Curl femoral sentado | 2 | 1,5 min | isolation | No |
| Sábado | Extensión de cuádriceps | 1 | 1,5 min | isolation | No |
| Sábado | Extensión de cuádriceps | 2 | 1,5 min | isolation | No |

### G

| Día | Ejercicio exacto | Serie | Descanso | Tipo | Alta demanda |
| --- | --- | --- | --- | --- | --- |
| Lunes | Elevaciones laterales en máquina | 2 | 2 min | isolation | No |
| Martes | Curl femoral sentado | 2 | 2,5 min | isolation | No |
| Martes | Extensión de cuádriceps | 2 | 2 min | isolation | No |
| Miércoles | Aperturas en contractora | 2 | 2 min | isolation | No |
| Miércoles | Extensión de tríceps en máquina | 2 | 2 min | isolation | No |
| Viernes | Curl femoral sentado | 2 | 2,5 min | isolation | No |
| Viernes | Extensión de cuádriceps | 2 | 2 min | isolation | No |
| Viernes | Crunch abdominal en máquina | 2 | 1,5 min | isolation | No |
| Sábado | Curl Scott en máquina | 2 | 2 min | isolation | No |
| Sábado | Pájaros en máquina | 2 | 2 min | isolation | No |
| Sábado | Crunch abdominal en máquina | 2 | 1,5 min | isolation | No |

### H

| Día | Ejercicio exacto | Serie | Descanso | Tipo | Alta demanda |
| --- | --- | --- | --- | --- | --- |
| Lunes | Elevaciones laterales en máquina | 1 | 2 min | isolation | No |
| Lunes | Elevaciones laterales en máquina | 2 | 2 min | isolation | No |
| Martes | Curl Scott en máquina | 1 | 2 min | isolation | No |
| Martes | Curl Scott en máquina | 2 | 2 min | isolation | No |
| Miércoles | Curl femoral sentado | 1 | 2 min | isolation | No |
| Miércoles | Curl femoral sentado | 2 | 2 min | isolation | No |
| Miércoles | Extensión de cuádriceps | 1 | 2 min | isolation | No |
| Miércoles | Extensión de cuádriceps | 2 | 2 min | isolation | No |
| Jueves | Aperturas en contractora | 1 | 2 min | isolation | No |
| Jueves | Aperturas en contractora | 2 | 2 min | isolation | No |
| Viernes | Pullover en máquina | 1 | 2 min | isolation | No |
| Viernes | Pullover en máquina | 2 | 2 min | isolation | No |
| Viernes | Crunch abdominal en máquina | 1 | 2 min | isolation | No |
| Viernes | Crunch abdominal en máquina | 2 | 2 min | isolation | No |
| Sábado | Gemelo de pie en máquina | 1 | 2 min | calf | No |
| Sábado | Gemelo de pie en máquina | 2 | 2 min | calf | No |

## Avisos de calidad

Orientaciones prácticas, no diagnósticos ni umbrales fisiológicos. Una opción válida de 2 min para aislamiento a RIR 0 no se marca como problema por preferir a veces 2,5 min. La revisión por fallo repetido de alto coste requiere más de una exposición y evidencia adicional: solapamiento muscular entre ejercicios, todas las series de un ejercicio al fallo o recuperación inferior a la preferencia contextual. Dos exposiciones solo define repetición; no afirma que dos sean excesivas por sí mismas. El aviso pide justificar, no rechaza la propuesta. Los avisos preexistentes de densidad global (>4 o >50% por sesión) se conservan como cribado V5, no como prohibición.

| Caso | short_rest | rest_performance_review | demanding_failure | Otros | Fallos duros |
| --- | --- | --- | --- | --- | --- |
| A | 22 | 0 | 0 | low_accessory_reps, low_accessory_reps | Ninguno |
| B | 24 | 0 | 0 | — | Ninguno |
| C | 34 | 0 | 0 | — | Ninguno |
| D | 23 | 0 | 0 | low_accessory_reps, low_accessory_reps, excess_variety | Ninguno |
| E | 14 | 21 | 1 | low_accessory_reps, low_accessory_reps, low_accessory_reps, low_accessory_reps, low_accessory_reps | Ninguno |
| F | 26 | 15 | 0 | low_accessory_reps, low_accessory_reps, low_accessory_reps | Ninguno |
| G | 2 | 0 | 0 | low_accessory_reps, low_accessory_reps | Ninguno |
| H | 0 | 2 | 0 | session_failure_density, session_failure_density, excess_variety | Ninguno |

### Avisos E

- rest_performance_review: Lunes · Press de pecho en máquina · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Lunes · Press de pecho en máquina · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Lunes · Press de pecho en máquina · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Lunes · Jalón al pecho · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Lunes · Jalón al pecho · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Lunes · Jalón al pecho · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- short_rest: Lunes · Remo con pecho apoyado · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Lunes · Remo con pecho apoyado · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Lunes · Elevaciones laterales en máquina · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Lunes · Elevaciones laterales en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- rest_performance_review: Martes · Sentadilla hack · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Martes · Sentadilla hack · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Martes · Sentadilla hack · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- low_accessory_reps: Martes · Curl femoral sentado · serie 1. Rango bajo para accesorio/abdomen; revisar contexto.
- low_accessory_reps: Martes · Curl femoral sentado · serie 2. Rango bajo para accesorio/abdomen; revisar contexto.
- low_accessory_reps: Martes · Curl femoral sentado · serie 3. Rango bajo para accesorio/abdomen; revisar contexto.
- low_accessory_reps: Martes · Hip thrust en máquina · serie 1. Rango bajo para accesorio/abdomen; revisar contexto.
- low_accessory_reps: Martes · Hip thrust en máquina · serie 2. Rango bajo para accesorio/abdomen; revisar contexto.
- short_rest: Martes · Gemelo sentado · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Martes · Gemelo sentado · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- demanding_failure: Martes. Fallo repetido de alto coste con solapamiento muscular, todas las series al fallo o recuperación limitada: justificar o reducir exposición.
- rest_performance_review: Jueves · Press inclinado en máquina · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Jueves · Press inclinado en máquina · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Jueves · Press inclinado en máquina · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Jueves · Low row · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Jueves · Low row · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Jueves · Low row · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- short_rest: Jueves · Press de hombro en máquina · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Jueves · Press de hombro en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Jueves · Pájaros en máquina · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Jueves · Pájaros en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- rest_performance_review: Sábado · Sentadilla pendular · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Sábado · Sentadilla pendular · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Sábado · Sentadilla pendular · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Sábado · Peso muerto rumano con barra · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Sábado · Peso muerto rumano con barra · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Sábado · Peso muerto rumano con barra · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- short_rest: Sábado · Extensión de cuádriceps · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Sábado · Extensión de cuádriceps · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Sábado · Crunch abdominal en máquina · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Sábado · Crunch abdominal en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.

### Avisos F

- rest_performance_review: Lunes · Press inclinado en máquina · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Lunes · Press inclinado en máquina · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Lunes · Press inclinado en máquina · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Lunes · Jalón al pecho · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Lunes · Jalón al pecho · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- rest_performance_review: Lunes · Jalón al pecho · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 3 min.
- short_rest: Lunes · Remo con pecho apoyado · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Lunes · Remo con pecho apoyado · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Lunes · Elevaciones laterales en máquina · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Lunes · Elevaciones laterales en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- rest_performance_review: Martes · Sentadilla hack · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Martes · Sentadilla hack · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Martes · Sentadilla hack · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Martes · Peso muerto rumano con barra · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Martes · Peso muerto rumano con barra · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Martes · Peso muerto rumano con barra · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- short_rest: Martes · Curl femoral sentado · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Martes · Curl femoral sentado · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Martes · Gemelo sentado · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Martes · Gemelo sentado · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Miércoles · Press inclinado en máquina · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Miércoles · Press inclinado en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Miércoles · Press inclinado en máquina · serie 3. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Miércoles · Remo con pecho apoyado · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Miércoles · Remo con pecho apoyado · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Miércoles · Remo con pecho apoyado · serie 3. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Miércoles · Press de hombro en máquina · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Miércoles · Press de hombro en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Miércoles · Curl Scott en máquina · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Miércoles · Curl Scott en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- rest_performance_review: Viernes · Sentadilla pendular · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Viernes · Sentadilla pendular · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Viernes · Sentadilla pendular · serie 3. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- low_accessory_reps: Viernes · Hip thrust en máquina · serie 1. Rango bajo para accesorio/abdomen; revisar contexto.
- low_accessory_reps: Viernes · Hip thrust en máquina · serie 2. Rango bajo para accesorio/abdomen; revisar contexto.
- low_accessory_reps: Viernes · Hip thrust en máquina · serie 3. Rango bajo para accesorio/abdomen; revisar contexto.
- short_rest: Viernes · Curl femoral sentado · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Viernes · Curl femoral sentado · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Sábado · Press inclinado en máquina · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Sábado · Press inclinado en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Sábado · Jalón al pecho · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Sábado · Jalón al pecho · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2,5 min.
- short_rest: Sábado · Extensión de cuádriceps · serie 1. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Sábado · Extensión de cuádriceps · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.

### Avisos G

- low_accessory_reps: Viernes · Hip thrust en máquina · serie 1. Rango bajo para accesorio/abdomen; revisar contexto.
- low_accessory_reps: Viernes · Hip thrust en máquina · serie 2. Rango bajo para accesorio/abdomen; revisar contexto.
- short_rest: Viernes · Crunch abdominal en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.
- short_rest: Sábado · Crunch abdominal en máquina · serie 2. Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación. Referencia: 2 min.

### Avisos H

- session_failure_density: Miércoles. Alta concentración de series RIR 0 en la sesión.
- session_failure_density: Viernes. Alta concentración de series RIR 0 en la sesión.
- rest_performance_review: Sábado · Sentadilla pendular · serie 1. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- rest_performance_review: Sábado · Sentadilla pendular · serie 2. Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie. Referencia: 4 min.
- excess_variety: . Variedad superior a la referencia del nivel.

## G/H completas — entradas y propuestas originales

### G — >4 años · 5 días · 75 min · gimnasio completo

Experiencia: Más de 4 años. Objetivo: Ganar masa muscular y desarrollar el físico de forma equilibrada. Días: 5. Disponibilidad: Lunes, Martes, Miércoles, Viernes, Sábado. Duración: 75 min/día. RIR: estimación habitual. Exclusiones: ninguna. Actividad externa: ninguna.

Material disponible (no preferencia): Press horizontal máquina; Press inclinado máquina; Press convergente; Peck deck / contractora; Jalón; Remo horizontal; Remo convergente; Remo pecho apoyado; High row; Low row; Pullover máquina; Dominadas; Hack squat; Pendular; Prensa 45º; Prensa horizontal; Extensión de cuádriceps; Curl femoral sentado; Curl femoral tumbado; Aductor; Abductor; Hip thrust; Gemelo sentado; Gemelo de pie; Press hombro máquina; Laterales máquina; Rear delt / pájaros; Scott máquina; Curl máquina; Extensión tríceps máquina; Multipower; Banco; Barra; Rack con soportes de seguridad; Mancuernas; Poleas regulables; Bandas; Máquina abdominal; Rueda abdominal.

Basic · rutina inicial

Respeta el RIR de cada serie. RIR 0 significa no poder completar otra repetición con técnica estable; no fuerces repeticiones. Progresa cada serie o bloque por separado: cuando alcances su techo de reps con el RIR indicado y técnica estable, aumenta ligeramente su carga. Ajusta la carga entre bloques si cambian los objetivos. No se automatizan pesos ni cambios de rutina.

#### Lunes

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| Press de pecho en máquina | top_backoff | 1 | 6–8 | 1 | 3 min |
| Press de pecho en máquina | top_backoff | 2 | 8–10 | 1 | 3 min |
| Press de pecho en máquina | top_backoff | 3 | 8–10 | 1 | 3 min |
| Jalón al pecho | top_backoff | 1 | 6–8 | 1 | 3 min |
| Jalón al pecho | top_backoff | 2 | 8–10 | 1 | 3 min |
| Jalón al pecho | top_backoff | 3 | 8–10 | 1 | 3 min |
| Remo con pecho apoyado | straight | 1 | 8–12 | 1 | 3 min |
| Remo con pecho apoyado | straight | 2 | 8–12 | 1 | 3 min |
| Press de hombro en máquina | straight | 1 | 8–10 | 1 | 3 min |
| Press de hombro en máquina | straight | 2 | 8–10 | 1 | 3 min |
| Elevaciones laterales en máquina | varied | 1 | 12–15 | 1 | 2 min |
| Elevaciones laterales en máquina | varied | 2 | 12–15 | 0 | 2 min |

#### Martes

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| Sentadilla hack | top_backoff | 1 | 6–8 | 1 | 4 min |
| Sentadilla hack | top_backoff | 2 | 8–10 | 1 | 4 min |
| Sentadilla hack | top_backoff | 3 | 8–10 | 1 | 4 min |
| Peso muerto rumano con barra | straight | 1 | 6–8 | 1 | 4 min |
| Peso muerto rumano con barra | straight | 2 | 6–8 | 1 | 4 min |
| Peso muerto rumano con barra | straight | 3 | 6–8 | 1 | 4 min |
| Curl femoral sentado | varied | 1 | 10–12 | 1 | 2,5 min |
| Curl femoral sentado | varied | 2 | 10–12 | 0 | 2,5 min |
| Extensión de cuádriceps | varied | 1 | 12–15 | 1 | 2 min |
| Extensión de cuádriceps | varied | 2 | 12–15 | 0 | 2 min |

#### Miércoles

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| Press de pecho en máquina | straight | 1 | 8–10 | 1 | 3 min |
| Press de pecho en máquina | straight | 2 | 8–10 | 1 | 3 min |
| Press de pecho en máquina | straight | 3 | 8–10 | 1 | 3 min |
| Remo con pecho apoyado | top_backoff | 1 | 8–10 | 1 | 3 min |
| Remo con pecho apoyado | top_backoff | 2 | 10–12 | 1 | 3 min |
| Remo con pecho apoyado | top_backoff | 3 | 10–12 | 1 | 3 min |
| Press de hombro en máquina | straight | 1 | 8–10 | 1 | 3 min |
| Press de hombro en máquina | straight | 2 | 8–10 | 1 | 3 min |
| Aperturas en contractora | varied | 1 | 12–15 | 1 | 2 min |
| Aperturas en contractora | varied | 2 | 12–15 | 0 | 2 min |
| Extensión de tríceps en máquina | varied | 1 | 10–15 | 1 | 2 min |
| Extensión de tríceps en máquina | varied | 2 | 10–15 | 0 | 2 min |

#### Viernes

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| Prensa horizontal | top_backoff | 1 | 8–10 | 1 | 4 min |
| Prensa horizontal | top_backoff | 2 | 10–12 | 1 | 4 min |
| Prensa horizontal | top_backoff | 3 | 10–12 | 1 | 4 min |
| Hip thrust en máquina | straight | 1 | 8–10 | 1 | 3 min |
| Hip thrust en máquina | straight | 2 | 8–10 | 1 | 3 min |
| Curl femoral sentado | varied | 1 | 10–12 | 1 | 2,5 min |
| Curl femoral sentado | varied | 2 | 10–12 | 0 | 2,5 min |
| Extensión de cuádriceps | varied | 1 | 12–15 | 1 | 2 min |
| Extensión de cuádriceps | varied | 2 | 12–15 | 0 | 2 min |
| Crunch abdominal en máquina | varied | 1 | 12–15 | 1 | 1,5 min |
| Crunch abdominal en máquina | varied | 2 | 12–15 | 0 | 1,5 min |

#### Sábado

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| Press de pecho en máquina | straight | 1 | 8–10 | 1 | 3 min |
| Press de pecho en máquina | straight | 2 | 8–10 | 1 | 3 min |
| Jalón al pecho | straight | 1 | 8–12 | 1 | 3 min |
| Jalón al pecho | straight | 2 | 8–12 | 1 | 3 min |
| Remo con pecho apoyado | straight | 1 | 8–12 | 1 | 3 min |
| Remo con pecho apoyado | straight | 2 | 8–12 | 1 | 3 min |
| Curl Scott en máquina | varied | 1 | 10–15 | 1 | 2 min |
| Curl Scott en máquina | varied | 2 | 10–15 | 0 | 2 min |
| Pájaros en máquina | varied | 1 | 12–15 | 1 | 2 min |
| Pájaros en máquina | varied | 2 | 12–15 | 0 | 2 min |
| Crunch abdominal en máquina | varied | 1 | 12–15 | 1 | 1,5 min |
| Crunch abdominal en máquina | varied | 2 | 12–15 | 0 | 1,5 min |

Series: 57. RIR 0: 11. RIR 1: 46. Minutos estimados: Lunes 58; Martes 54; Miércoles 57; Viernes 55; Sábado 57. No son tiempos medidos.

### H — >4 años · 6 días · 45 min · recuperar masa

Experiencia: Más de 4 años. Objetivo: Ganar masa muscular después de una etapa de poco entrenamiento. Días: 6. Disponibilidad: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado. Duración: 45 min/día. RIR: estimación habitual. Exclusiones: ninguna. Actividad externa: ninguna.

Material disponible (no preferencia): Press horizontal máquina; Press inclinado máquina; Press convergente; Peck deck / contractora; Jalón; Remo horizontal; Remo convergente; Remo pecho apoyado; High row; Low row; Pullover máquina; Dominadas; Hack squat; Pendular; Prensa 45º; Prensa horizontal; Extensión de cuádriceps; Curl femoral sentado; Curl femoral tumbado; Aductor; Abductor; Hip thrust; Gemelo sentado; Gemelo de pie; Press hombro máquina; Laterales máquina; Rear delt / pájaros; Scott máquina; Curl máquina; Extensión tríceps máquina; Multipower; Banco; Barra; Rack con soportes de seguridad; Mancuernas; Poleas regulables; Bandas; Máquina abdominal; Rueda abdominal.

Basic · rutina inicial

Respeta el RIR de cada serie. RIR 0 significa no poder completar otra repetición con técnica estable; no fuerces repeticiones. Progresa cada serie o bloque por separado: cuando alcances su techo de reps con el RIR indicado y técnica estable, aumenta ligeramente su carga. Ajusta la carga entre bloques si cambian los objetivos. No se automatizan pesos ni cambios de rutina.

#### Lunes

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| Press de pecho en máquina | straight | 1 | 6–8 | 1 | 3 min |
| Press de pecho en máquina | straight | 2 | 6–8 | 1 | 3 min |
| Press inclinado en máquina | straight | 1 | 8–10 | 1 | 3 min |
| Press inclinado en máquina | straight | 2 | 8–10 | 1 | 3 min |
| Elevaciones laterales en máquina | straight | 1 | 12–15 | 0 | 2 min |
| Elevaciones laterales en máquina | straight | 2 | 12–15 | 0 | 2 min |

#### Martes

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| Jalón al pecho | straight | 1 | 8–10 | 1 | 3 min |
| Jalón al pecho | straight | 2 | 8–10 | 1 | 3 min |
| Remo con pecho apoyado | straight | 1 | 8–10 | 1 | 3 min |
| Remo con pecho apoyado | straight | 2 | 8–10 | 1 | 3 min |
| Curl Scott en máquina | straight | 1 | 10–12 | 0 | 2 min |
| Curl Scott en máquina | straight | 2 | 10–12 | 0 | 2 min |

#### Miércoles

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| Sentadilla hack | straight | 1 | 6–8 | 1 | 4 min |
| Sentadilla hack | straight | 2 | 6–8 | 1 | 4 min |
| Curl femoral sentado | straight | 1 | 10–12 | 0 | 2 min |
| Curl femoral sentado | straight | 2 | 10–12 | 0 | 2 min |
| Extensión de cuádriceps | straight | 1 | 12–15 | 0 | 2 min |
| Extensión de cuádriceps | straight | 2 | 12–15 | 0 | 2 min |

#### Jueves

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| Press convergente | straight | 1 | 8–10 | 1 | 3 min |
| Press convergente | straight | 2 | 8–10 | 1 | 3 min |
| Aperturas en contractora | straight | 1 | 12–15 | 0 | 2 min |
| Aperturas en contractora | straight | 2 | 12–15 | 0 | 2 min |
| Press de hombro en máquina | straight | 1 | 8–10 | 1 | 3 min |
| Press de hombro en máquina | straight | 2 | 8–10 | 1 | 3 min |

#### Viernes

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| High row | straight | 1 | 8–10 | 1 | 3 min |
| High row | straight | 2 | 8–10 | 1 | 3 min |
| Pullover en máquina | straight | 1 | 10–12 | 0 | 2 min |
| Pullover en máquina | straight | 2 | 10–12 | 0 | 2 min |
| Crunch abdominal en máquina | straight | 1 | 12–15 | 0 | 2 min |
| Crunch abdominal en máquina | straight | 2 | 12–15 | 0 | 2 min |

#### Sábado

| Ejercicio exacto | Esquema | Serie | Reps | RIR | Descanso |
| --- | --- | --- | --- | --- | --- |
| Peso muerto rumano con barra | straight | 1 | 6–8 | 2 | 4 min |
| Peso muerto rumano con barra | straight | 2 | 6–8 | 2 | 4 min |
| Sentadilla pendular | straight | 1 | 8–10 | 1 | 3,5 min |
| Sentadilla pendular | straight | 2 | 8–10 | 1 | 3,5 min |
| Gemelo de pie en máquina | straight | 1 | 10–15 | 0 | 2 min |
| Gemelo de pie en máquina | straight | 2 | 10–15 | 0 | 2 min |

Series: 36. RIR 0: 16. RIR 1: 18. Minutos estimados: Lunes 32; Martes 32; Miércoles 32; Jueves 32; Viernes 30; Sábado 35. No son tiempos medidos.

## Coste y llamadas

| Caso/intento | Resultado | Tokens entrada/salida | USD |
| --- | --- | --- | --- |
| G / 1 | failed | 3708 / 3200 | 0.05727 |
| H / 1 | pending_review | 3715 / 1716 | 0.0350275 |
| G / 2 | pending_review | 3708 / 2877 | 0.046089 |

Adicional real: 0.1383865 USD. Total fase: 0.3620915 USD / 0,45 USD autorizados. Nueve llamadas en toda la fase: seis A–F anteriores, G fallida, H y un único reintento G autorizado explícitamente. No hubo bucles. El techo de salida V5 se amplió de 3200 a 5120 tras el fallo; la reserva previa para ese reintento fue 0,1253075 USD (acumulado con reserva 0,44131).
