# Cierre del ajuste acotado V5 — 01/10/2026

Base `1b96f61f310791c4a7adaf51bfcf9649ac7566a4`, mismo worktree aislado `codex/coach-quality-v5`. Main remoto se conserva en `49661ca83217e9e27ec54aa9992123875439eeb4`. No push, merge ni publicación. No se ha modificado el cuestionario, catálogo, arquitectura de series ni diseño.

## Cambios de producto

- `assets/coach-programming-v5.js`: orientación por ejercicio/serie, estabilidad, rango de reps, RIR y coste de fatiga. Aislamientos 90–150 s, RIR 0 120–150; compuestos moderados 150–180, cerca del fallo preferencia 180; alta demanda 180–240, cerca del fallo preferencia 240. Hasta 300 s permitido cuando preservar rendimiento lo justifique. Estos rangos son orientaciones, no bloqueos fisiológicos universales. `restGuidance` no recibe experiencia. Se preserva el cálculo conservador de duración incluyendo todo el descanso.
- Aviso `demanding_failure`: sustituye el anterior corte aislado de >=3 series por fallo repetido más evidencia contextual (solapamiento muscular, todas las series al fallo o recuperación limitada). No rechaza ni impone una cuota RIR 0. Los avisos generales de densidad de V5 siguen como cribado, no como diagnóstico.
- `contract-v5.mjs`: prompt coherente con esas orientaciones; estabilidad ya existente se incluye explícitamente en el contexto. Reducir volumen redundante antes que comprimir descansos. No nuevos ejercicios. Mantiene `basic-initial-v5`, modelo y schema_version 2.
- Límite de descanso 240→300 en esquema por serie, proyección principal, validador de frontend y función SQL de staging. `planned_sets`, UUID y persistencia mantienen su estructura.
- Límite de salida 3200→5120 tras el único fallo real por salida incompleta y autorización explícita del reintento. No cambia proveedor, modelo, política de retry ni controles de acceso. Una petición por operación; no retry automático.
- `index.html`: solo versión de caché de los dos scripts afectados.

## Resultados y limitaciones de programación

[FINAL-REST.md](FINAL-REST.md) contiene G/H completas, entradas exactas, todas las series, descansos, RIR y las ubicaciones RIR 0 de E/F/G/H. Incluye tabla real A–H y avisos reevaluados. A–F archivadas son byte idénticas: no se regeneraron ni se ajustaron a posteriori.

- G: 57 series, 11 RIR 0, todas en aislamientos estables y última serie. 54–58 min estimados para 75 disponibles. Dos series de crunch en máquina a RIR 0 conservan 90 s: aviso `short_rest`, no ocultado. Dos avisos preexistentes por 8–10 reps en hip thrust; alternativa razonable, requiere contextualizar, no error por sí sola.
- H: 36 series, 16 RIR 0 en aislamientos/gemelos estables; ninguna de alto coste. 30–35 min estimados para 45 disponibles. Pendular RIR 1 a 210 s: revisar preferencia 240. Miércoles y viernes 4/6 series al fallo: aviso de densidad. 18 ejercicios distintos frente a referencia 16: revisar redundancia. No equivale a fallo funcional ni justifica aprobar automáticamente la propuesta.
- E: 12 RIR 0 = 8 aislamientos + 2 gemelos + 2 hack. Las dos hack son las series 2/3 del martes, 180 s: nuevo aviso contextual por repetición de alto coste con recuperación inferior a la preferencia. F: 12 = 10 aislamientos + 2 gemelos, sin alta demanda.
- La reserva conservadora de tokens no garantiza que toda futura salida compleja finalice; 5120 resolvió este caso y no representa una garantía universal. La ruta de fallo permanece cerrada y requiere autorización de retry.

## Pruebas de esta ejecución

292/292 comprobaciones finales ejecutadas, sin sumar las 613 históricas ni ejecuciones repetidas. El intento fallido de G se informa por separado y no cuenta como una prueba superada.

| Suite | Resultado | Alcance |
| --- | --- | --- |
| `rest-refinement.cjs` | 21/21 | Descansos, presentación 1–5 min, referencias contextuales, warnings, compatibilidad, A–F |
| `unit.cjs` | 35/35 | Contrato V5, proveedor simulado sin red, exclusiones, series, límites |
| `legacy-v4.cjs` | 37/37 | Compatibilidad histórica V4 sin cambios |
| `training.cjs` | 92/92 | Chromium/WebKit, 320/360/390/430/1280, claro/oscuro, objetivo real de prueba 5 min, UUID, borrador y estado |
| `real-ui.cjs` | 52/52 | Render completo de ocho salidas reales archivadas; sin nueva llamada |
| SQL staging | 6/6 | 300 permitido, 301/59 rechazados, proyección, numeración y schema1 |
| Rollback dentro de transacción revertida | 1/1 | Hash exacto de función base restaurado temporalmente; candidato conservado |
| `live-rest.cjs` | 18/18 | JWT real G/H/reviewer/anon, persistencia exacta, aislamiento, aceptación denegada, lineage del retry |
| G reintento / H real | 30/30 | 15 por propuesta, una petición upstream por operación, pending_review |

G inicial: HTTP upstream 200, `provider_incomplete`, 3708 tokens de entrada / 3200 de salida; no propuesta completa. Se informó y pidió permiso. Reintento único autorizado con 5120: correcto. H pasó a 3200. Coste de esta ejecución 0,1383865 USD (incluye fallo), acumulado 0,3620915 / 0,45 USD. Nueve llamadas totales contando seis anteriores y el retry autorizado. No más llamadas.

## Auth y producción — alcance exacto de la evidencia

Producción solo se consultó. Las nueve tablas principales y sus recuentos/huellas coinciden entre inicio y final de esta ejecución. Coinciden las 47 funciones (definición, owner, ACL, configuración y SECURITY DEFINER), Edge Functions y RPC de ciclo. Frente al baseline de esquema también coinciden 16 tablas/ACL/RLS, 64 índices, 35 policies, 4 triggers y 117 constraints. No configuración Auth/OAuth ni secretos leídos/modificados. Patatasimple conserva perfil client; no interacción autenticada con su cuenta ni cambios en sus datos de aplicación.

La huella completa actual de `auth.users` pasó de `0a1a5ec02b26ed88e62eee64df9eb7a4` a `3720e61774a4f9ba8273452e795fd483`. Al excluir **solo** `updated_at` y `last_sign_in_at`, permanece exactamente `49f3c39cef733bb41b2b3903bfe3a882` en ambos extremos. Son los únicos campos que pueden explicar el cambio observado en esta ventana; identidad y el resto de campos permanecen iguales en esa comparación agregada. La última actualización avanzó de 15:22:54 a 15:36:25 UTC; el máximo de último login se mantuvo. Seis usuarios; cero eventos disponibles en `auth.audit_log_entries` desde 29/09.

**Limitación histórica:** el salto de huella de la fase anterior (29/09) tenía únicamente baseline agregado. No existe captura anterior por campo ni eventos disponibles que permitan demostrar retrospectivamente que aquel salto fue exclusivamente de timestamps. El comportamiento observado ahora es compatible, pero no prueba su causa histórica. No se declara identidad total de Auth ni se modifica un usuario para intentar restaurar una huella. Las consultas no retornaron contraseñas, tokens ni secretos.

Entre el 29/09 y el inicio de esta ejecución hubo actividad ajena a esta tarea: producción ya tenía 67 workouts y 240 notas, frente a 64/221 del informe previo. Estos recuentos permanecieron intactos durante este trabajo. No se presentan esos datos históricos como si fueran el baseline actual.

## Staging y limpieza

Solo `coach_private.validate_proposal(jsonb)` cambia respecto al inicio, exactamente 240→300 para descanso de schema2. Owner/grants/search_path/SECURITY DEFINER preservados. Edge `simple-coach-mock` final v29, `verify_jwt=true`, hash `52583f6334d5c9cbd49db617f20d8b0154e8ee68db1a7be7946266929ce49cac`. No modificación de otras funciones tras restaurar configs sintéticas.

Se crearon únicamente G, H y un reviewer sintéticos identificados por manifiesto. El retry se autorizó por RPC oficial con JWT del reviewer, sin aprobar la rutina y conservando la operación fallida. Tras verificar se eliminaron exclusivamente estas fixtures. Whitelist 0, reviewers temporales 0, usuarios/perfiles q5 0, operaciones 0, intakes 0. Las nueve tablas de staging y el agregado Auth vuelven exactamente al baseline inicial; los cinco usuarios preexistentes se conservan.

`rollback-rest.sql` vuelve al validador de 1b96f61 y se niega si quedan propuestas con >240 s. Para revertir Edge/frontend, usar el árbol 1b96f61 completo y su despliegue coordinado; no bajar solo un límite si existen prescripciones nuevas incompatibles. Ningún rollback se aplicó permanentemente.

## Candidato y revisión

Preparado para revisión final, no publicado ni aprobado para promoción por esta ejecución. Los avisos de G/H requieren valoración humana; la atribución histórica de Auth sigue sin certeza. No más cambios automáticos ni nuevas llamadas. Preview offline: http://127.0.0.1:4200/review . Los resultados, capturas, recibos privados, JWT, manifiestos y SQL de fixtures siguen fuera de Git.
