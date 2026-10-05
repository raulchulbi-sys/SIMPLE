# Validación — 2026-10-05

Estado: **BLOCKED para promoción: falta concurrencia con solapamiento real**.

## Checks finales distintos

| Suite | Resultado | Alcance |
|---|---:|---|
| distribution/unit.cjs | 38/38 | Contrato puro y transporte interceptado |
| distribution/backend.sql | 26/26 | PostgreSQL staging, fixtures con ROLLBACK |
| premium-weekly/weekly-unit.cjs | 76/76 | Contratos anteriores/nuevo y gateway Edge interceptado |
| premium-upgrade/backend.sql | 36/36 | Compatibilidad y guardas de upgrade en staging |
| premium-upgrade/reviewer-adapter.cjs local | 16/16 | Adaptador/proyección segura local |
| premium-upgrade/ui.cjs | 1062/1062 | Matriz UI Chromium/WebKit, temas, móvil/escritorio |
| distribution/ui.cjs | 72/72 | Antes/después, series completas, roles y avisos |
| **Total sin sumar reejecuciones** | **1326/1326** | No incluye concurrencia real pendiente |

Controles adicionales, fuera del contador: rollback/restauración exacta de seis
funciones; ocho archivos del Edge de staging exactos; JWT obligatorio y HTTP 401
sin credenciales; git diff/check y exclusión de resultados del candidato.

## Distribución y volumen

- A: 3→4 sesiones, 24→24 series, cada serie prescrita explícitamente.
- B: 4→3 sesiones, 24→24 series; todos los ejercicios redistribuidos.
- C: mismo número de sesiones con días redistribuidos.
- D/E: día no disponible, ejercicio excluido y material ausente rechazados.
- F: base anterior y cambio de disponibilidad posterior rechazados sin aplicar.
- G: aceptación repetida devuelve la misma revisión y no duplica volumen/UUID.
- H: fallo después de escrituras revierte sesiones, ejercicios, bindings y marker.
- Adición explícita: 24→26 series con justificación y un UUID nuevo estable.
- Retirada explícita: vuelve a los doce ejercicios originales, elimina solo el
  UUID nuevo y su binding. Workout/revisión anteriores permanecen idénticos.
- Reviewer asignado lee la proyección, pero no revisiones privadas, workouts
  globales ni mensajes. Otro cliente y los roles API no acceden al compilador.
- El recorrido SQL reserve/claim/finish real de staging captura el contrato nuevo
  y persiste una propuesta pending_review con receipt mock. Todo termina con
  ROLLBACK y cero llamadas al proveedor.

## Concurrencia: limitación de evidencia

Las llamadas `execute_sql` enviadas con Promise.all fueron serializadas por el
conector. Los timestamps confirmaron que no se solapaban. Sus resultados de
doble aceptación, guardado de workout y disponibilidad cambiada NO se presentan
como concurrencia real superada.

Falta probar por API real, con sesiones sintéticas autorizadas y renovadas solo
en memoria: doble aceptación, propuestas competidoras, disponibilidad durante
aceptación y workout durante aceptación. Se solicitó autorización específica
para renovar las dos sesiones sintéticas; no se accedió a sus refresh tokens.
No promover mientras esta validación siga pendiente.

## Limpieza e integridad

Las cinco fixtures persistentes de investigación se eliminaron por sus UUID
exactos. No quedaron rutinas/mesociclos/grants/entitlements de esa ejecución.
Los dieciséis recuentos y huellas estables de staging coinciden con su baseline.
Staging no tiene pilotos habilitados por esta fase. No se crearon usuarios.

En producción, las quince huellas estables restantes coinciden con el baseline;
`context_grants` pasó de cuatro a cinco por un consentimiento semanal registrado
durante la sesión. No se atribuye su autoría a un usuario por inferencia.
Las únicas escrituras de producción realizadas por el agente fueron la
asignación del reviewer y los doce bindings expresamente autorizados.
No se promovieron migración, Edge ni frontend de distribución.

Revisión 1 y workout anteriores intactos; Revisión 2 inexistente; check-ins y
recommendations del piloto = 0. RPC de ciclo: `88c3564c3c49cf9c53fccba89a1e71b5`.
Sin cambios Auth/OAuth, sin uso de refresh tokens, sin respuestas por el atleta,
sin aprobaciones/aceptaciones productivas. **OpenAI calls de esta fase = 0**.
