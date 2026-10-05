# Premium semanal: vista previa interna

Esta vista conserva los tokens de SIMPLE, Arial, Claro/Oscuro y una sola zona de desplazamiento en la página. No se carga desde `index.html` ni activa Premium comercial.

El recorrido del atleta tiene siete preguntas estructuradas y una confirmación: recuperación, descanso, fatiga, estrés, percepción de las sesiones, disponibilidad y aspecto a revisar. No repite datos conocidos de los entrenamientos ni incluye preguntas de salud o campos libres. La disponibilidad utiliza días y minutos; el ejercicio se elige por su UUID actual. El aviso `premium-checkin-v1` pide una casilla explícita para usar las respuestas junto con el historial.

El borrador local se separa por atleta, mesociclo, semana y revisión. Atrás conserva las respuestas. El servidor recibe semana, revisión y `row_version` esperado; una pestaña antigua no puede sobrescribir otro contexto. Los envíos son inmutables. El bloqueo de operaciones y el contador de petición protegen frente a doble clic, cambios de vista y respuestas tardías.

El análisis presenta **Qué observamos**, **Tu check-in**, **Qué recomendamos** y, cuando corresponde, **Antes → Después** con series S1/S2/S3 completas. Un check-in ausente se indica explícitamente. Una revisión pendiente no permite aceptar; REVIEW requiere resolución humana separada y no presenta cambios aplicables. Una redistribución conserva los días lógicos y muestra su día de la semana y minutos.

## Vista offline para revisión

Desde el worktree candidato:

```powershell
node tests/premium-weekly/preview.cjs
```

Abrir `http://127.0.0.1:4241/review`. Los casos y las acciones son simulados localmente. No hay llamadas a OpenAI, Supabase o Auth. El servidor solo sirve la página y tres assets permitidos; los archivos privados y de resultados no se sirven. La vista anterior del puerto 4240 queda independiente.

```powershell
node tests/premium-weekly/ui.cjs
```

La ejecución nueva validada produjo **1047/1047** comprobaciones: Chromium y WebKit, 320/360/390/430/1280 y ambos temas. El informe exacto está en `results/ui.json`; no se suman las ejecuciones diagnósticas intermedias ni resultados históricos. Esta suite es offline y no demuestra JWT/RLS ni producción.

Capturas seleccionadas y revisadas visualmente, todas locales e ignoradas:

| Archivo en `results/` | Contenido |
| --- | --- |
| `question-320-light.png` | Primera pregunta, controles y borrador en 320 claro. |
| `checkin-analysis-390-light.png` | Hechos, siete respuestas y KEEP revisado, en 390 claro. |
| `adjustment-390-dark.png` | MODIFY pendiente de revisión con series antes/después, en 390 oscuro. |
| `schedule-1280-light.png` | Cinco días lógicos distribuidos entre cuatro días disponibles, en 1280 claro. |

## Harness JWT de staging separado

`jwt-preview.cjs` usa únicamente el proyecto de staging `dmqjexigdnfzobarhnib` y el fixture longitudinal controlado. Requiere el manifest y sesiones privados preparados por el harness principal. No crea usuarios ni hace login automático. El selector solo ofrece ese fixture.

```powershell
node tests/premium-weekly/jwt-preview.cjs
```

El puerto **4242** arranca por defecto en lectura. Las credenciales y JWT permanecen en el servidor y nunca se devuelven al navegador. Cada lectura y RPC usa el JWT del actor seleccionado. El reviewer utiliza solo el contexto que su asignación y RLS permiten; no obtiene acceso directo a workouts ni usa el JWT del atleta como sustituto. La recomendación se filtra por la semana actual para que una aceptación anterior no impida el próximo check-in.

El botón de análisis siempre rechaza `analysis_requires_explicit_runner`: el runner principal prepara los análisis por separado. Reiniciar datos está deshabilitado en staging. No existe una ruta a producción.

Los dos comandos siguientes solo deben ejecutarse tras la señal explícita de coordinación del harness principal, sobre sus precondiciones exactas de semana 2. Cada comando abre y cierra su propio servidor temporal 4242:

```powershell
node tests/premium-weekly/ui-staging.cjs checkin
node tests/premium-weekly/ui-staging.cjs review
```

`checkin` requiere semana 2 sin check-in, permiso ya concedido y revisión vigente. Completa las siete respuestas normales, envía, compara la fila real por JWT y comprueba su persistencia e inmutabilidad. `review` requiere un KEEP de semana 2 ya persistido por el runner; valida con el reviewer asignado, acepta como atleta y comprueba semana 3 con la misma revisión. Ambos mantienen solo los metadatos correspondientes del fixture en su manifest privado, sin sobrescribir otros casos.

La ejecución autenticada autorizada ya pasó **12/12 check-in** y **12/12 review**: 24 comprobaciones nuevas, en Chromium, 390 claro, con JWT reales y datos sintéticos de staging. No extiende la cobertura autenticada a todos los anchos/motores/temas de la matriz offline. Los resultados exactos están separados en `results/ui-staging-checkin.json` y `results/ui-staging-review.json`, ambos `completed:true`.

El primer recorrido pasó sus nueve comprobaciones funcionales del check-in, pero falló al recuperar un body antiguo de Playwright después de recargar. Se corrigió exclusivamente la captura de respuestas del loopback, antes de entregar el body al navegador; las RPC de Supabase siguieron siendo reales. Las tres comprobaciones pendientes se completaron con `verify-checkin` en lectura, sin reenviar el check-in. El informe consolidado cuenta esas doce comprobaciones una vez; el diagnóstico original queda ignorado en `results/ui-staging-checkin-diagnostic.json`.

Las capturas reales locales `results/jwt-checkin-390-light.png` y `results/jwt-next-week-390-light.png` se revisaron visualmente. La segunda confirma el avance a semana 3 con la misma revisión y un check-in nuevo disponible. El servidor temporal 4242 quedó cerrado después del recorrido; 4241 conserva la vista offline.

Estos scripts no llaman a OpenAI, no crean usuarios Auth ni acceden a producción. No reutilizar las fases de escritura fuera del fixture reservado; el runner principal conserva la responsabilidad del análisis, seguimiento longitudinal y limpieza del conjunto de fixtures.
