# Correcciones de progreso, ciclo e interacción

Base de producción: `4fcfb99770a604f4ec013368f5329db97b79169e`.
Rama aislada: `codex/progress-cycle-ux`.
Referencia local de rollback: `codex/rollback-progress-cycle-ux`.

## Producto

- Gráficas: la lectura paginada mantiene todos los registros autorizados y descarta respuestas de otro contexto. Se eliminan los recortes silenciosos de 120 puntos/200 opciones. El periodo inicial es Todo; Mes sigue siendo una ventana móvil de 30 días.
- `progressIdentityContext` concentra las cuatro equivalencias de días confirmadas y reutiliza el mapa existente de seis ejercicios. Solo operan para su cliente/rutina y si existe el destino actual. UUID actuales exactos prevalecen. No se escribe ni reconstruye ningún histórico.
- Los días actuales vacíos también aparecen. El selector de ejercicios muestra únicamente la estructura actual del día seleccionado, sin añadir opciones desde snapshots históricos. Los registros antiguos permanecen en el historial; sus UUID sin correspondencia no se fusionan por nombre. Los alias de días no autorizan equivalencias de ejercicios.
- Tema: HTML/BODY, color-scheme y theme-color se actualizan juntos; pageshow recupera la preferencia y se limita la propagación del overscroll. No se añade una banda fija ni se cambia la paleta. Safari físico sigue pendiente.
- `assets/reorder.js`: modo compacto antes del gesto, umbral de 7 px, placeholder de la altura medida, ghost con la misma geometría, autoscroll tras el umbral, cancelación sin escritura. Listo sale del modo. Subir/Bajar actúan sobre la fila seleccionada. Se reutilizan los RPC de orden existentes y su relectura.
- Descanso: etiqueta arriba y cinco columnas iguales de al menos 44 px a 320/360/390/430 y escritorio. A 320 px se ajusta el padding interior; ante ampliaciones excepcionales queda scroll local, no controles imposibles ni desbordamiento global. Temporizador intacto.
- Ciclo: todas las vistas siguen leyendo el mismo RPC. La fecha y el refresco del frontend usan Europe/Madrid, también desde dispositivos en otras zonas. Una lectura que cruza medianoche se repite; las respuestas viejas conservan los guards existentes. Foco, foreground y notificación entre pestañas releen el resultado.
- Una regla CSS ocultaba la celebración del ciclo en el interior. Ahora se muestra Rutina finalizada. Se reutiliza el baile existente una vez por cliente/rutina/fecha local; no reinicia al renderizar y se omite con movimiento reducido.

El RPC `get_client_routine_cycle_progress(uuid,uuid)` NO se modifica. Su MD5 antes/después de staging es `88c3564c3c49cf9c53fccba89a1e71b5`. No se cambian Auth, OAuth, schema, RLS, políticas, permisos ni otros RPC.

## Reglas del ciclo verificadas

La matriz se fijó antes de implementar en [MATRIX.md](MATRIX.md).
- 1,2,3 → 3/5 incluso tras inactividad. Otro entrenamiento guardado de 1 → 1/5; después 2 → 2/5.
- 1,2,4,5 → 4/5; no se completa el día omitido.
- Se conserva la regla anterior: repetir CUALQUIER día ya contado reinicia el ciclo parcial.
- 1,2,3,4,5 → 5/5 durante la fecha de cierre. Al siguiente día → 0/5 si no existe actividad del siguiente ciclo; si existe, se conserva ese avance.
- Una sesión adicional guardada tras completar el ciclo se acumula para el siguiente, mientras 5/5 sigue visible ese día. La restricción vigente impide dos workouts del mismo usuario/rutina/día/fecha.
- Un workout vacío confirmado cuenta, como ya ocurría. Abrir, escribir, check, borrador o fallo de guardado no cuentan.
- No se borra ningún dato para reiniciar el indicador.

## Validación final local / staging

Se cuentan casos únicos de la ejecución final de cada suite; se excluyen intentos de diagnóstico/repeticiones y operaciones de login/logout/limpieza.

| Suite | Casos correctos |
|---|---:|
| progress-cycle/identity.cjs | 30 |
| progress-cycle/contracts.cjs | 15 |
| progress-cycle/browser.cjs | 36 |
| progress-cycle/interactions.cjs | 12 |
| progress-cycle/authenticated.cjs (matriz, JWT staging) | 119 |
| progress-cycle/authenticated-order.cjs (JWT staging) | 5 |
| identity/protected.cjs | 16 |
| exercise-alias/browser.cjs | 348 |
| compact/browser.cjs | 110 |
| polish/browser.cjs (320/390/1280) | 66 |
| polish/accessibility.cjs | 8 |
| session-edit/contracts.cjs | 40 |
| compact/regressions.cjs, ocho suites existentes | 215 |
| **Total** | **1.020/1.020** |

Ocho regresiones: duración 30; concurrencia 33; navegación/historial 26; borradores 7; modos entrenamiento/estructura 16; editor unificado 34; contrato histórico 19; navegador general 50.

Chromium y WebKit; atleta/entrenador; claro/oscuro; 320/360/390/430/1280 en la matriz de presentación. Interacciones profundas: listas de 16 rutinas y 24 días en ambos sentidos, cancelación táctil/blur, ghost estable, guardado fallido, respuestas antiguas entre clientes, dos pestañas, medianoche/DST, borrador intacto, 601 puntos reales de render y paginación sintética de 1.203 registros.

Los tests de UI usan datos locales y SDK aislado. Los de staging usan JWT reales y datos sintéticos; no equivalen a login real en producción. La consulta productiva de diagnóstico es de solo lectura. WebKit automatizado NO acredita Safari/iPhone físico.

El contrato protegido del ciclo admite únicamente sustituir la llamada por el helper de medianoche y compara el resto byte a byte. Los harnesses históricos cargan las dependencias nuevas reales; no se relajan sus expectativas. Los contratos antiguos de «todo el JS visual idéntico» no corresponden a esta tanda funcional; los invariantes siguen cubiertos por protected, edición, identidad y regresiones.

## Datos y reproducción

`private/` y `results/` están ignorados: contienen configuración sintética, JWT, capturas, huellas y el historial de diagnóstico. No deben incorporarse al commit ni al despliegue.
El test de identidad usa una captura privada de lectura de 15 workouts al iniciar la tarea; no supone que ese número siga siendo el actual. En esa captura, los seis ejercicios del PUSH tienen cuatro observaciones cada uno y no seis curvas combinadas. Quedan 18 UUID históricos de otros días sin equivalencia confirmada: el listado privado los documenta, la UI los conserva separados.

Staging se restaura exactamente al fingerprint inicial (nueve tablas, cinco usuarios Auth, funciones, policies y RLS). No quedan fixtures de esta ejecución. Durante el trabajo producción recibió actividad normal: un workout y seis notas nuevos; los 58 workouts y 184 notas iniciales conservan exactamente su hash y las otras tablas/funciones/permisos no cambian. No se debe restaurar ni eliminar esa actividad.

Arranque de preview: `$env:INTERIOR_PORT='4184'; node tests/interior/preview.cjs`, en Windows/PowerShell.
Los tests de navegador aceptan `SIMPLE_PUBLIC_URL` para verificar assets públicos con SDK local aislado; siempre bloquean escrituras de red. Las pruebas JWT solo permiten el proyecto de staging fijado y requieren las fixtures privadas preparadas y su limpieza.

La publicación requiere comparar el árbol Git del candidato con el remoto antes de mover main; los informes post-deploy y capturas se guardan localmente en results.
