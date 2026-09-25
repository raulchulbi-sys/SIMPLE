# Contrato previo a la corrección

Base: 4fcfb99770a604f4ec013368f5329db97b79169e. Rollback frontend: rama local codex/rollback-progress-cycle-ux.

## Ciclo: expectativas fijadas antes de implementar

| Caso | Secuencia | Esperado |
|---|---|---|
| A | Vacío | 0/5 |
| B | 1,2,3 | 3/5 |
| C | B, días sin actividad | 3/5 |
| D | B, otro entrenamiento guardado de 1 | 1/5 |
| E | D, 2 | 2/5 |
| F | 1,2,4,5 | 4/5 |
| G | F, otro 1 | 1/5 |
| H | 1,2,3,4,5 | 5/5 y Rutina finalizada |
| I | H, recarga en fecha de cierre | 5/5 |
| J | H, siguiente fecha sin actividad | 0/5 |
| K | J, 1 guardado | 1/5 |
| L | Reenvío del mismo UUID de workout | Una sola operación |
| M | Guardado fallido | Sin avance ni celebración |
| N | Abrir/editar/check/borrador de día 1 | Sin reinicio |
| O | Cambio de tema | Mismo ciclo |
| P | Entrenador/cliente, mismo usuario y rutina | Mismo resultado RPC |

Regla existente no sustituida: repetir cualquier día ya contado en un ciclo incompleto inicia otro ciclo con ese día (no solo el primero). Un workout vacío confirmado cuenta como sesión guardada. Los aliases exactos conservan ámbito usuario/rutina y los UUID desconocidos no cuentan por nombre. El RPC usa Europe/Madrid; el refresco frontend usaba la zona del dispositivo, que debe alinearse para el ciclo sin reescribir fechas históricas.

Se probarán además 0/1/4/5/>5 días, duplicados/homónimos/renombres/reordenación, estructura cambiada, cierre y sesiones adicionales, medianoche Madrid y DST, histórico editado/eliminado y respuestas tardías. No se alterará el reloj de producción.

## Gráficas

15 workouts recuperados en la lectura inicial del cliente confirmado. Antes: cuatro UUID huérfanos crean grupos históricos adicionales; el quinto día actual sin datos no aparece. Aperturas antigua tiene un punto y la actual tres. Después esperado: cinco días actuales, cuatro puntos de Aperturas en PUSH, aplicando solo las cuatro equivalencias de días y las seis de ejercicios confirmadas. Mantener visibles ejercicios históricos sin equivalencia, especialmente los otros días. Periodo inicial Todo; filtros vigentes conservados. Notas/históricos sin escrituras.

El contrato anterior exigía gráficos separados incluso para los seis pares confirmados. Esta petición sustituye expresamente esa regla solo para las gráficas de evolución en su ámbito confirmado. UUID sin alias, otros clientes/rutinas y homónimos siguen separados. Última sesión, notas y borradores conservan su contrato.

## Interacción y presentación

Reordenar: compactar antes del gesto, sin placeholder ni autoscroll hasta superar umbral; Listo solo sale del modo; el orden persiste mediante RPC actuales. Cancelación del gesto no escribe. Subir/Bajar solo para fila seleccionada. Normal conserva todas las acciones.

Descanso: etiqueta arriba y cinco columnas iguales a 320/360/390/430 y escritorio; conservar duración y botones estables del temporizador. Tema: fondo de documento/overscroll/chrome coordinado, sin banda fija ni recarga; solo Claro/Oscuro. WebKit automatizado no prueba Safari físico.
