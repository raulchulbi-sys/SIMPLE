# Candidato Premium Phase 4–5: revisión de staging

Base `1b8cf72`, rama aislada `codex/premium-upgrade`. Conserva la genealogía `72fc545 → 660dcb1 → dde5dd8 → 00c3f64 → 7af766f → 1b8cf72`. Producción/main de referencia: `b15968c73ab1b075c70f5456e6531733696c3bf5`, ancestro del candidato. No se publica ni se autoriza Premium en producción en esta sesión.

## Cambio de producto

`premium_provision` rechazaba una rutina Basic porque `routine_management` ya acreditaba un gestor y una operación aceptada. Esa protección evitaba dos gestores estructurales, no era un error de identificación. Se conserva la protección y se añade una transición explícita: `upgrade_basic_routine_to_premium` verifica propietario/client, entitlement y consentimiento, operación Basic aceptada, revisión fiel y ausencia de operación Basic pendiente. Bloquea y cambia únicamente la gestión activa. Reutiliza la misma rutina y revisión inicial; crea una única admisión/mesociclo y sus semanas, de manera atómica. Conserva la operación Basic original como procedencia.

No clona, genera ni reconstruye programación; no cambia UUID, workouts, notas, asignaciones ni snapshots históricos. Si el estado live difiere funcionalmente de la revisión aceptada, rechaza el upgrade. Las revisiones Basic v2/v3/v4 se leen con sus rangos canónicos; V5 conserva cada serie individual. La retirada de acceso bloquea operaciones futuras y deja utilizable la programación entregada.

La única migración nueva, `20261004220122_coach_premium_upgrade.sql`, centraliza entitlement/admission privados, RPC de acceso/adopción/proyección, guards de permisos y de consumo. `profiles.role` no representa el plan. El frontend no puede habilitarlo por email, URL, metadata o localStorage. Dos lectores históricos usan Europe/Madrid para incluir correctamente los entrenamientos en la fecha local. El trigger estructural conserva sus comprobaciones y ahora serializa contra la adopción de una rutina todavía no gestionada mediante el lock de su padre.

Detalles: [backend-context.md](backend-context.md), [ADAPTERS.md](ADAPTERS.md).

## Phase 4

Se auditaron ocho dispatches reales archivados: siete respuestas válidas y una descartada cuya salida literal no existe. Una novena petición histórica fue bloqueada antes del proveedor. Las siete respuestas, facts, contexto, acción y controles están en [telemetry-archive.md](telemetry-archive.md); no se regeneraron ni se atribuyó una causa retrospectiva al descarte.

La telemetría futura conserva únicamente modelo/versiones/timestamp/status/categoría/path cerrado/índice numérico y receipt de coste/tokens. Nunca conserva raw output rechazado, excepción sensible, secretos o reasoning. Solo un output estructurado ya validado y seguro puede tener fingerprint. [telemetry.md](telemetry.md).

Chat reutiliza el pipeline de recomendaciones vigente: candidato → validators → pending_review → reviewer asignado → ready → aceptación explícita → una sola N+1. El siguiente contexto usa N+1 y distingue base heredada de Basic, historial anterior y decisiones Premium. KEEP no fabrica una revisión vacía; REVIEW requiere resolución humana. No se amplían los permisos del reviewer.

## E2E e integridad

La fixture nueva reutilizó cuentas controladas de staging sin crear usuarios Auth. Tenía una operación Basic V5 aceptada con propuesta mock, tres días, doce UUID de ejercicio, nueve workouts y dos notas. El recorrido persistió upgrade, anamnesis, permisos separados, check-ins, KEEP, REVIEW resuelto a KEEP, candidato Chat, aprobación/aceptación mock y workout N+1. Once ejercicios no afectados conservaron sus filas completas; la operación, revisión original, días, nueve workouts y notas permanecieron idénticos. El contexto posterior incluyó el nuevo workout con fecha/kg/reps/RIR exactos y cero distinto de missing. [PIPELINE.md](PIPELINE.md).

La persistencia/seguridad/revisión/aceptación de ese recorrido usó JWT reales contra staging; los outputs declarados mock no son evidencia de llamadas reales a IA. La prueba de entrenamiento en el índice actual es offline y se informa separadamente. Las dos carreras estructurales finales acreditan solapamiento por ventanas de lock del servidor y tiempos del HTTP JWT; los intentos sin solapamiento se excluyen. La tabla B12 en backend-context.md distingue esas carreras de contratos de locking y de pruebas secuenciales/concurrentes de idempotencia. No afirma que se ejecutaran cinco interleavings externos distintos.

## OpenAI

Una nueva llamada efectiva: análisis semanal con base Basic heredada, N+1 y check-in real. HTTP 200, KEEP pendiente, esquema/semántica válidos, sin cambios ni warnings; no fue aprobada ni aceptada. Modelo `gpt-5.4-2026-03-05`, 12.602 tokens de entrada, 527 de salida, coste **0,039410 USD**. [REAL-INHERITED.md](REAL-INHERITED.md).

El intento adicional de Chat quedó bloqueado antes del proveedor por `premium_chat_budget_exhausted`: la reserva conservadora no cabía en el saldo de su canal histórico. No se reintentó ni se amplió el límite de ese canal. No se presenta como una nueva respuesta real válida. Acumulado Premium: **29 llamadas / 0,589222 USD**; incremento de esta sesión: **1 llamada / 0,039410 USD**, dentro del máximo adicional autorizado. Los contadores nunca se resetean.

## Host y preview

El SDK/sesión actuales alimentan el adapter real, con gate servidor OFF por defecto. Entradas independientes de Basic para propietario y reviewer asignado; intake, programación, semana/check-in, análisis/propuesta y Chat comparten una navegación. Entrenar vuelve al destino existente por routine_id. La lectura de prescripciones N+1 valida la revisión y sus UUID; un workout nuevo recibe el marcador de esa revisión sin reescribir históricos.

Preview local [4251/review](http://127.0.0.1:4251/review), claramente sintética, sin secretos ni llamadas externas. Chromium/WebKit, Claro/Oscuro, 320/360/390/430 y escritorio. El teclado se simula por viewport reducido; no se declara una prueba física de iPhone. El home no inventa un agregado de adherencia ausente del contrato. [UX.md](UX.md).

## Patatasimple y producción

Solo lectura: `284d6bb6-e798-44a9-b72c-f31d3e27deef`, role client. Rutina `036b43f2-f109-4a43-9129-32f7aba4a55a`; operación aceptada Basic v2 `a602f6b8-eb4d-45c8-81d6-20f7a1f78e98`; revisión 1 `8d059658-cb6e-4ddf-b5c9-f769c78ec4d3`. Tres días, doce ejercicios, un workout, cuatro notas. La prescripción legacy original permanece, incluidos sus descansos de 60/75/90 s; no se convierte artificialmente a V5. Whitelist Basic vigente hasta 13/10, generation_limit 2. Sin entitlement/admisión Premium en producción.

Se comparan nueve inventarios centrales con hashes/cantidades, campos estables Auth e identidades; 52 definiciones/owner/ACL/search_path y tres inventarios de RLS/policies/triggers. La referencia productiva permanece idéntica, incluido RPC de ciclo `88c3564c3c49cf9c53fccba89a1e71b5`. No se exige identidad de timestamps mutables de Auth ni se escriben usuarios para igualar hashes.

## Promoción posterior

Orden, bundle de Edge preparado para el proyecto productivo, flags OFF, canary de un único UUID y comprobaciones en [DEPLOY.md](DEPLOY.md). No trasladar fixtures, whitelists, JWT, ledgers o keys de staging. No se ejecutó ninguna parte en producción.

El rollback completo exige ausencia de datos vivos incompatibles antes de tocar definiciones. El ensayo atómico vuelve a Basic y reaplica el candidato, restaurando todos los contadores dentro de la misma transacción y comparando funciones/ACL/owner y 16 inventarios. Una retirada después de uso real no autoriza borrar rutinas: cerrar nuevos permisos/dispatches conserva lo entregado. Los resultados finales del ensayo, limpieza y revisión independiente se registran en FINAL.md.

Resultados: [FINAL.md](FINAL.md). Las evidencias crudas, credenciales de prueba y capturas quedan en `private/` / `results/`, ignorados por Git; los scripts reproducibles y documentos sanitizados sí forman parte del candidato.
