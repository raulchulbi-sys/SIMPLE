# Premium Fase 2 — revisión de llamadas y replay de F

04/10/2026, base canónica `00c3f64a365cbe927a8f79200aafd4600f63e0f6`.
Staging exclusivamente (`dmqjexigdnfzobarhnib`), sin publicación. **PREMIUM PHASE 2: CLOSED.** El replay de F está completado y su limpieza/integridad verificadas. El guard de prescripciones malformadas pasó inicialmente28/28; la versión final endurecida pasó36/36 al añadir rechazo de field null/ausente. Se aplicó en staging preservando permisos de las dos definiciones afectadas, con cero fixtures. Este cierre permite iniciar Fase3; su resultado final se documenta por separado en README.md.

## Las catorce llamadas existentes

Se leyeron los diez resultados originales de `coach-premium-phase2/tests/premium-phase2/results/real.json` y los cuatro de `premium-series/tests/premium-series/results/real.json`. Se volvió a ejecutar su validación local de schema y semántica contra sus contextos guardados. No hubo llamadas nuevas, reintentos ni acceso a OpenAI.

| Caso | Llamadas | Decisión real | Datos y evaluación |
|---|---:|---|---|
| A | 1 | KEEP | Reps comparables crecientes; mantener es coherente. |
| B | 1 | KEEP | Rendimiento estable comparable. |
| C | 1 | KEEP | 12→11→10→9, todavía dentro de 8–12. Prudente; no es MODIFY. |
| D | 1 | KEEP | Una exposición, `insufficient_data`. Confianza high expresa la decisión de mantener, no una tendencia fuerte. |
| E | 1 | KEEP | RIR 0→3→1→4, `context_changed_or_incomplete`; no atribuye una tendencia fiable. |
| F | 1 | MODIFY | Sustitución db_curl→band_curl por exclusión explícita, con rendimiento estable. |
| G | 1 | KEEP | Descenso igual a C y 30 minutos. Dos ejercicios/seis series por sesión; no obtuvo MODIFY de volumen. |
| H, semanas 1/2/3 | 3 | KEEP | El mismo historial estable, aceptaciones de seguimiento; no tres semanas nuevas de entrenamiento. |
| K | 1 | REVIEW | Hack con objetivos distintos y descanso 60 segundos; propone revisar la incoherencia, sin inventar caída. |
| I | 1 | KEEP | Descenso por serie, última exposición de hack bajo rango; decisión válida pero discutible, detallada abajo. |
| L | 1 | KEEP | Una exposición; reconoce ausencia de tendencia. |
| N | 1 | KEEP | Top set/back-off estable, sin uniformar objetivos. |

Total real: **12 KEEP, 1 MODIFY, 1 REVIEW, 0 inválidas**. Modelo conservado `gpt-5.4-2026-03-05`. Diez outputs v1 y cuatro v2. Todos HTTP 200 y `analysis_trace.error=null`; su estado posterior accepted/superseded/pending_review no cambia la clasificación del output original. Coste guardado total **0,194317 USD**, calculado con los recibos existentes. El replay tiene coste nuevo cero.

Los quince checks de la auditoría local verifican cantidad de registros y schema/semántica de los catorce outputs. No equivalen a ejecutar otra vez el proveedor ni toda la suite histórica de Fase 2. Las regresiones por serie previas eran deterministas: ninguna de las cuatro llamadas nuevas eligió MODIFY.

## Output real F exacto

El contexto sintético original presenta adulto con experiencia 2–4 años, esfuerzo confiado, confianza media, recuperación mostly, sueño 7–8 horas, estrés medio, lunes/jueves de 60 minutos, mancuernas/banco/bandas y exclusión concreta `db_curl`. `exercise_1` era db_curl, 3×8–12 @RIR2 y 180 segundos. Cuatro exposiciones de 3×10 a 20 kg/RIR2 en los cuatro ejercicios: cada fact cita `stable_comparable`. `band_curl` pertenece al catálogo de sustitutos permitidos, requiere las bandas disponibles y no está excluido.

Esta salida se conserva íntegra, sin traducir acciones, modificar reason ni añadir cambios:

```json
{
  "kind": "MODIFY",
  "facts": [
    { "claim": "stable_comparable", "exercise_ref": "exercise_1" },
    { "claim": "stable_comparable", "exercise_ref": "exercise_2" },
    { "claim": "stable_comparable", "exercise_ref": "exercise_3" },
    { "claim": "stable_comparable", "exercise_ref": "exercise_4" }
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

SHA256 de la serialización JSON original utilizada: `83846d3df59cbb5e87b84469cf8a6bbf5d80fe17bbd288b9744c88f024d23e79`.

F ya tuvo una aceptación real en staging en la fase original, con revisión 2 y author=model. Esa evidencia sigue en el RESULTS original, capturas MODIFY-accepted y checks de invariantes. La ejecución de hoy crea fixtures nuevas y vuelve a verificar su aceptación sobre el backend canónico; su transporte es mock/replay y la revisión nueva tiene **author_kind=mock**. El recibo guarda el source_model/prompt/schema originales, el hash y `new_openai_calls=0`. No se falsea author=model ni se atribuye al modelo otra elección.

## Replay autenticado completado

Antes de mutar: cero mesociclos, recomendaciones, grants Premium, gestión Premium y rutinas sintéticas Premium; presupuesto cerrado, dispatched=14, charged=0,194317, reserved=0. Se guardaron baseline privado de diez tablas, 89 funciones con definición/owner/ACL/config y huella estable de cinco usuarios Auth. Las credenciales controladas existentes se usaron únicamente dentro del arnés; no se imprimieron ni copiaron a código/documentación.

Se creó una rutina propia con dos días, cuatro ejercicios, ocho workouts y UUID nuevos. Intake, permiso, contexto, reserva, revisión y aceptación utilizaron JWT reales de las dos cuentas controladas preexistentes. `premium_analysis_claim(...,'mock')` y `premium_analysis_finish` recibieron el output F original. El output v1 pasó también la validación canónica actual con su proyección legacy uniforme numérica. SQL produjo `pending_review` con un patch válido; el reviewer asignado lo convirtió en ready y el atleta aceptó.

Resultado comprobado en base de datos y por lecturas autenticadas:

- Dos aceptaciones concurrentes retornaron la misma revisión N+1; solo existe una revisión nueva. Una aceptación posterior también devolvió ese mismo UUID.
- N original permaneció byte por byte idéntica y sus hashes siguieron válidos. Sus datos legacy se proyectan explícitamente en N+1; no se los representa como arquitectura individualizada histórica.
- Únicamente db_curl se sustituyó por un UUID nuevo de band_curl, conservando día, orden, tres series, 8–12, RIR2 y 180 segundos. Los otros tres ejercicios vivos permanecieron byte por byte idénticos.
- Los ocho workouts permanecieron byte por byte idénticos. Cuatro conservan el UUID viejo; ninguno contiene el nuevo. La función de identidad no equipara ambos UUID y el contexto nuevo de band_curl tiene cero exposiciones heredadas.
- Semana 1 conserva N; todas las semanas de seguimiento posteriores apuntan a N+1. El seguimiento avanzó una sola vez a semana 2.
- La propuesta competidora sobre N quedó superseded y su aceptación fue rechazada. El atleta tampoco pudo aprobar su propia propuesta ni aceptar antes de revisión.

Checks de transporte/JWT: login 2/2, intake 2/2, contexto/reserva 4/4, revisión 6/6, competidor ready 1/1, aceptación 20/20 y logout local 2/2: **37/37**. Además: 15/15 de auditoría local; seis valores SQL de invariantes y seis grupos de integridad. Son recuentos de aserciones, no escenarios funcionales únicos, y no se suman a 437/437 o 555/555 históricos.

Durante la reserva se habilitó temporalmente el presupuesto con techo de llamadas igual al consumo y techo USD igual al coste consumido: `max_calls=14`, `max_usd=0,194317`. Así un claim OpenAI queda bloqueado y solo se usa el modo mock. Al terminar se restauró exactamente el presupuesto original cerrado: enabled=false, max_calls=16, max_usd=0,3577695, dispatched=14, charged=0,194317, reserved=0.

La limpieza se limitó al manifiesto propio, por UUID/propietario y nombre exacto de rutina. Resultado final: **cero fixtures propias**, mesociclos/recomendaciones/grants Premium cero. Diez tablas, 89 funciones, identidad/cantidad Auth y presupuesto coinciden exactamente con sus baselines. Las dos sesiones locales creadas para el test se revocaron; el archivo JWT propio se eliminó. Se conservaron las cinco cuentas existentes. No se escribió en producción ni se cambió ningún secret, policy, trigger, función, Auth/OAuth o configuración comercial.

## Descenso heterogéneo I y KEEP

`exercise_1` hack tiene objetivos S1 6–8 @RIR1/240s, S2 8–10 @RIR0/240s y S3 10–12 @RIR0/240s. Cuatro exposiciones semanales verificadas por revisión exacta:

| Antigüedad | S1, 90 kg | S2, 82,5 kg | S3, 82,5 kg | Cumple rango |
|---|---:|---:|---:|---|
| 3 semanas | 8 @1 | 10 @0 | 12 @0 | Las tres |
| 2 semanas | 7 @1 | 9 @0 | 11 @0 | Las tres |
| 1 semana | 6 @1 | 8 @0 | 10 @0 | Las tres, en el mínimo |
| Última | 5 @1 | 7 @0 | 9 @0 | Ninguna de las tres |

Carga por ordinal, cantidad de series, RIR registrado y objetivos históricos permanecen constantes. Total hack 30→27→24→21 reps; descenso de 30% en esas cuatro exposiciones. Los otros tres ejercicios tienen 12→11→10→9 reps en sus tres series, siempre dentro de 8–12: total 36→33→30→27, descenso de 25%. El claim servidor es `reps_decreasing_comparable` en los cuatro; el output lo cita correctamente y distingue fatiga/recuperación como hipótesis no demostrada.

KEEP es **válido** por contrato: el prompt permite mantener y observar un descenso y no obliga a reducir volumen. Es **razonable como decisión prudente** con una sola exposición bajo rango y sin causa demostrada. Es también **discutible**: el descenso ya es monotónico durante tres intervalos y afecta a los cuatro ejercicios; las tres series hack fallan sus mínimos en la última exposición. La explicación «en hack hubo una sesión por debajo» es cierta, pero omite en su texto la extensión de las tres series. «Descenso limitado en tiempo» resume cuatro exposiciones semanales; no demuestra que la tendencia sea transitoria. REVIEW habría sido defendible y no hace falta convertir KEEP en inválido para señalar esa limitación.

El prompt es conservador explícitamente: KEEP es decisión de primera clase, no forzar novedad semanal, no regla automática de dos sesiones peores, y descenso comparable puede justificar MODIFY/REVIEW pero no obliga a bajar volumen. La extensión añade no forzar MODIFY para satisfacer un caso de prueba. Esto puede explicar parte de la preferencia observada por KEEP, pero las catorce llamadas sintéticas, con repetición H y ningún ensayo comparativo de prompt, no permiten atribuir causalmente el resultado al prompt ni medir su sesgo en uso real. No se propone cambiar esa filosofía sin una evaluación separada.

## Reproducción y evidencia privada

`phase2-close.cjs audit` es local y no usa red. La secuencia staging es: preparar baseline privado → `prepare` → ejecutar `private/phase2-setup.sql` en el único proyecto permitido → `login` → `intake` → ejecutar `phase2-bind-workouts.sql` → `reserve` → ejecutar `phase2-finish.sql` → `review` → ejecutar `phase2-stale.sql` → `stale-ready` → `accept` → `cleanup-sql` → ejecutar limpieza → `logout` → repetir comparación de baseline. Los SQL generados requieren revisión y ejecución privilegiada explícita; el script no los ejecuta automáticamente. No reutilizar UUID/manifest antiguos ni ejecutar `live.cjs real`. Un run nuevo debe usar manifiesto y baseline nuevos en una carpeta privada aislada, nunca sobrescribir esta evidencia.

Evidencias ignoradas en `tests/premium-weekly/results/phase2-*.json`: audit, real-audit con outputs/recibos, login, intake, reserve, review, stale-ready, accept, logout, invariants e integrity. Baselines/manifiesto/contextos/SQL/lecturas antes/después están en `private/phase2-*`. No publicar `private/` ni `results/`. El presente documento y el script contienen solo instrucciones y datos sintéticos seguros.

Gate adicional completado: hardening para impedir que una prescripción individualizada malformada en un ejercicio no editado se reconstruya desde su resumen escalar. `phase2-guard.cjs` pasó36/36 finales con SQL transaccional; incluye ocho casos de field null/ausente que se rechazan antes de mutación. Guard aplicado en staging sobre dos definiciones, sin cambiar owner/ACL/search_path ni dejar fixtures. El replay usa prescripciones legacy uniformes válidas y no encontró corrupción. La tarea principal conserva los detalles de guard/rollback; no se repitieron llamadas OpenAI.
