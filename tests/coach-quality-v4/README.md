# Candidato de programación Basic v4 — no publicado

Base exacta: `de6cc798f57d213767746b126b65c110b9fb4b7b`. Rama aislada: `codex/coach-quality-v4`.
Motor: `basic-initial-v4`; modelo sin cambio: `gpt-5.4-2026-03-05`.

## Resultado real

Ocho llamadas nuevas, una por perfil, sin reintentos ni llamadas v3. Coste confirmado mediante recibos del backend: **0,22768 USD**, por debajo de 0,30 USD. Todas llegaron a `pending_review`; ninguna fue aprobada, aceptada ni convertida en rutina. Tras conservar evidencia sintética sanitizada se limpiaron las operaciones y usuarios de prueba.

| Caso | Entrada | Ejercicios distintos | Series | Minutos por sesión | Avisos |
|---|---|---:|---:|---|---|
| A | <6 meses, hipertrofia equilibrada, L/X/V, 60 min, gimnasio completo, RIR desconocido | 10 | 36 | 47/46/40 | Ninguno |
| B | <6 meses, hipertrofia equilibrada, L/M/J/S, 30 min, mancuernas+bandas, aprendiendo RIR | 7 | 24 | 24/23/24/23 | Ninguno |
| C | <6 meses, vuelta estructurada, M/V, 60 min, gimnasio, RIR desconocido | 10 | 20 | 42/44 | Ninguno |
| D | 6–12 meses, recuperar masa, L/X/V, 45 min, gimnasio, aprendiendo RIR | 10 | 24 | 32/31/33 | Ninguno |
| E | 1–2 años, equilibrada, L/M/J/S, 90 min, gimnasio, RIR con confianza, fútbol M/V | 12 | 42 | 47/33/39/46 | Pierna el mismo martes que fútbol |
| F | 1–2 años, vuelta estructurada, L/M/J/S, 60 min, gimnasio, RIR con confianza | 12 | 35 | 36/31/32/39 | Ninguno |
| G | >4 años, equilibrada, L/M/X/V/S, 60 min, gimnasio, RIR habitual | 18 | 51 | 42/40/41/38/46 | Variedad >16 |
| H | >4 años, recuperar masa, L/M/X/J/V/S, 45 min, gimnasio, RIR habitual | 10 | 40 | 32/34/25/27/25/27 | Ninguno |

E excluye sentadilla con barra, rumano con mancuernas, prensa y jalón. F añade press de pecho en máquina y zancada atrás. Resto sin exclusiones ni actividad externa. Los IDs exactos e inventarios completos figuran en [GENERACIONES.md](GENERACIONES.md), junto a todas las prescripciones sin omisiones.

## Qué cambia

- Metadata versionada de 54 ejercicios, sin cambiar IDs/nombres/requisitos de material existentes. Músculo principal, secundario, patrón, tipo, familia, unilateralidad y estabilidad separados.
- Contrato compacto de salida por IDs. Nombres, explicación inicial y progreso se derivan determinísticamente; no dependen de texto libre del modelo. La propuesta persistida conserva schema 1.
- Archivo v3 conservado íntegro y enrutamiento histórico; Basic v1 sigue el contrato v2 anterior.
- Invalidación: schema, días, catálogo/material/exclusiones, duplicados internos, límites de prescripción, omisión completa de grandes grupos posibles, >90 % del tiempo y >12 ejercicios en principiantes.
- Avisos: volumen bajo/alto o desigual, frecuencia, femorales escasos, variedad, variantes equivalentes, 80–90 % del tiempo y conflictos de actividad externa. No se aprueba ni regenera automáticamente.
- Reviewer ve directas/secundarias/frecuencia/avisos. Sus permisos, RPC de decisión y handlers se conservan. Unidades/pruebas comprueban que el bloque de acciones es idéntico al de la base.
- «Por lado» en la propuesta del atleta y del reviewer según metadata, con ambos lados incluidos en tiempo. No cambia cifras de reps guardadas.
- Único ajuste del cuestionario: texto solicitado sobre exclusiones concretas. Premium continúa desactivado; sin salud ni preguntas nuevas.
- Cache keys de los assets modificados actualizadas. Sin cambios de diseño general, Auth, OAuth, recuperación, historial, ciclo, gráficos ni notas.

## Comparación v3/v4

[COMPARATIVA.md](COMPARATIVA.md) utiliza entradas exactamente iguales en A/B/E/G y un recuento homogéneo de ambas versiones.

| Perfil | Ejercicios v3 → v4 | Series v3 → v4 | Femorales: series/frecuencia v3 → v4 |
|---|---:|---:|---|
| A | 17 → 10 | 39 → 36 | 4/2 → 6/3 |
| B | 11 → 7 | 24 → 24 | 2/1 → 4/2 |
| E | 21 → 12 | 54 → 42 | 6/2 → 7/2 |
| G | 25 → 18 | 61 → 51 | 8/2 → 8/2 |

Mejora observable en variedad y cobertura de femorales B; no prueba superioridad fisiológica ni garantiza todos los outputs futuros. En A/E/G se reduce algo del trabajo directo de músculos pequeños: está documentado, no convertido ficticiamente en series directas mediante presses.

## Evidencia y límites de la evaluación

[EVIDENCIA.md](EVIDENCIA.md) documenta fuentes primarias, rangos y límites de inferencia. Reps/descanso/RIR no se presentan como cifras óptimas universales. Volúmenes, variedad y tiempo son heurísticas del piloto.

**Crítica para revisión:**

- A es una propuesta general con grandes grupos cubiertos tres días y 10 movimientos. Puede simplificarse aún más: conserva dos presses, dos variantes de rodilla y dos de core. No supone especialización ni un incumplimiento del techo.
- B mejora el déficit observado de femorales, pero concentra más programación principal en glúteos (12 series frente a 4 en cada otro gran grupo). El ratio exacto 3:1 no dispara el aviso >3:1; los datos siguen visibles. El puente repetido es discutible, no un fallo objetivo. No se retocó el umbral para aprobar esta salida.
- C cubre los grandes grupos dos veces; sus 10 ejercicios en solo dos sesiones permiten todavía más repetición. Son 20 series totales y dos por ejercicio, no una especialización.
- D es conservadora para retorno: 24 series, 10 ejercicios, sesiones 31–33 min aunque dispone de 45. No rellena tiempo.
- E mueve la sesión de pierna más voluminosa del jueves previo al fútbol al sábado. Persiste pierna el martes (6 series), visible con aviso. Se desconoce intensidad/horario del deporte: requiere decisión humana, no se afirma ausencia de interferencia.
- F cumple las seis exclusiones exactas. El rumano con barra sigue permitido aunque se excluya la variante con mancuernas. Omite brazos y gemelos directos; los brazos participan secundariamente, los gemelos no tienen trabajo específico.
- G baja de 25 a 18 movimientos, pero no alcanza el objetivo preferente <=16: aviso conservado. Podría reutilizar un solo curl femoral, un solo core o menos variantes de pecho. No se hace una novena llamada para ocultar este resultado.
- H usa 10 movimientos y repite ejercicios, 40 series repartidas en seis días; sesiones 25–34 min. RIR 3 por objetivo de recuperar masa. No se fuerza volumen por tener seis días ni experiencia elevada.
- La etiqueta de deltoides es agregada: la participación en press/remo no demuestra cobertura idéntica de sus porciones. El recuento no modela ROM, técnica, carga real o fatiga individual.

**Aclaración por lado durante entrenamiento:** cerrada también en la presentación de una rutina v4 aceptada. Se lee su gestión, operación y revisión vigentes; se valida propietario/rutina/estado/versión, y la metadata del snapshot se enlaza al UUID del ejercicio. Un homónimo con otro UUID no hereda la etiqueta. Solo añade texto y nombre accesible en una sesión activa: no cambia target, reps guardadas, borradores, historial ni sesiones bloqueadas. Ante fallo de lectura no inventa una etiqueta y muestra un aviso para reabrir. No modifica el RPC de aceptación. Este recorrido se validó con snapshots locales simulados en ambos navegadores, NO aceptando una de las ocho propuestas reales.
## Validación ejecutada

| Suite | Resultado |
|---|---:|
| `unit.cjs` motor v4/proveedor simulado | 37/37 |
| `legacy-v3.cjs` contrato v3 histórico | 22/22 |
| `../coach-ai/unit.mjs` compatibilidad v1/v2/proveedor | 62/62 |
| `../coach-intake-v2/unit.cjs` cuestionarios | 50/50 |
| `ui.cjs` Chromium/WebKit, 320/360/390/430/1280, claro/oscuro | 150/150 |
| `ui-delta.cjs` interacción/validaciones/reviewer | 30/30 |
| `quality-ui.cjs` etiquetas, evaluación, overflow e histórico | 30/30 |
| Ocho ejecuciones `real-quality.cjs A…H`, una llamada cada una | 120/120 comprobaciones; 8/8 propuestas |
| `live.cjs verify` JWT reales propietario/otro/trainer/reviewer/anon | 44/44 |
| `training-labels.cjs` procedencia v4 y UUID, sesión activa y compatibilidad | 52/52 |
| Regresión `test-training-modes` | 16/16 |
| Regresión `test-session-drafts` | 7/7 |
| Regresión `26-test-duration` | 30/30 |
| **Total sin sumar reejecuciones** | **650/650** |

Incidencias del entorno: un intento previo a A falló en login por red del sandbox, antes de reservar o llamar a OpenAI; se ejecutó con acceso de red autorizado. Primera carga de la suite delta agotó un timeout de 8 s sin ejecutar comprobaciones; `domcontentloaded` y 30 s resolvieron el arranque. No se relajaron expectativas funcionales. Las capturas no añaden pruebas al contador.

Las cinco primeras generaciones usaron Edge v24 y las tres últimas v25. Prompt, metadata, schema, decodificador y reglas son idénticos: v25 únicamente conectó el recibo de una propuesta rechazada al diagnóstico restringido a usuarios sintéticos autenticados de staging. No cambió ninguna de las ocho salidas válidas. Su rama negativa está cubierta en unit tests, sin otra llamada real.

## Staging, producción y rollback

- Staging: Edge `simple-coach-mock` v25, JWT requerido; único cambio SQL persistente: `coach_backend_claim(uuid,uuid,text)` marca nuevas generaciones Basic v2 como v4. Definición comparada: solo cambia esa cadena respecto al baseline. Owner, ACL y search_path idénticos. Ninguna tabla, RLS, política ni permiso añadido.
- [rollback.sql](rollback.sql) restaura la definición anterior de claim. Para rollback completo del motor se redespliegan los archivos Edge de `de6cc79`; no reescribir propuestas históricas ni borrar datos de participantes. La restauración no se ejecutó sobre las ocho salidas pendientes; se limpiaron exclusivamente fixtures con guardas UUID/email/nombre.
- Limpieza comprobada por SQL: whitelist 0, reviewers temporales 0, usuarios/perfiles `coach-q4` 0, operaciones 0, intakes 0, salud 0. Nueve tablas principales recuperan huellas/recuentos anteriores; catálogo de tablas, restricciones, índices, políticas, triggers y Auth recupera baseline. Solo cambia la función claim esperada y Edge.
- Producción `yvguatdqncadkwewlepe`: nueve huellas de datos, 47 funciones, permisos/configuración, políticas y Edge sin cambios. Whitelist y piloto patatasimple permanecen intactos. `main` remoto sigue `49661ca83217e9e27ec54aa9992123875439eeb4`.
- Worktree original `codex/coach-intake-v2` limpio y aún en `de6cc79`. Los cambios previos de la raíz no se tocaron.

## Revisar sin llamadas ni datos

`node tests/coach-quality-v4/preview.cjs` abre `http://127.0.0.1:4199/review`: ocho salidas reales sintéticas archivadas, selector y claro/oscuro. CSP bloquea red de la aplicación; no ofrece aprobar/aceptar. Requiere los recibos locales ignorados de esta ejecución. El código/documentación se versiona; `private/`, recibos crudos, tokens y screenshots quedan excluidos.

Capturas locales de propuestas reales: `results/real-B-light.png`, `real-B-dark.png`, `real-E-light.png`, `real-E-dark.png`. El verificador adicional `quality-ui.cjs` cubre etiqueta por lado también en remo unilateral y compatibilidad v3.

Los scripts no deben ejecutarse indiscriminadamente: `real-quality.cjs` hace una llamada real y tiene libro de coste/lock duradero, ya agotado a ocho llamadas; nunca resetear ese libro para reintentar. `live.cjs` solo prepara fixtures o verifica, no contiene comandos de aprobación/aceptación.
