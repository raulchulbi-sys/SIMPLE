# Resultados — 28/09/2026

**1.098 comprobaciones automáticas finales superadas**, sin sumar reintentos como casos nuevos. 321 del bloque Coach y 777 de regresión/aislamiento de código. Las comprobaciones de limpieza y huellas se informan aparte.

| Suite | Resultado |
|---|---:|
| Seguridad HTTP con JWT reales de staging | 151/151 |
| Flujo Basic real en Chromium/WebKit | 12/12 |
| Entrenamiento, notas, borradores, historial, gráficas, permisos y concurrencia de intake en staging | 62/62 |
| UI/preview local, ambos motores, claro/oscuro, 320/360/390/430/1280 | 52/52 |
| Códigos, asignaciones, ciclo y bloqueo RPC con JWT reales | 7/7 |
| Guardas explícitas y payload de intake con JWT real | 5/5 |
| SQL transaccional: contrato, fallo atómico, retry | 30/30 |
| SQL: respuesta backend tardía tras cambio de intake o revocación | 2/2 |
| Duración | 30/30 |
| Concurrencia existente | 33/33 |
| Navegación e historial | 26/26 |
| Borradores | 7/7 |
| Modos entrenamiento | 16/16 |
| Editor unificado | 34/34 |
| Contrato histórico | 19/19 |
| Regresiones navegador anteriores | 50/50 |
| Onboarding | 276/276 |
| Feedback de recuperación | 72/72 |
| SDK de recuperación | 28/28 |
| SDK OAuth Google | 96/96 |
| Botón Google/login/registro | 32/32 |
| Contrato edición de sesión | 40/40 |
| Contrato de ciclo e historial paginado | 15/15 |
| Aislamiento del código anterior y compilación | 3/3 |

Los tests de Auth/OAuth utilizan SDK real con HTTP interceptado. No hubo otro Google real, correo de recuperación, cambio de contraseña ni modificación de Auth. No se reutilizó la suite que requiere históricos reales privados: se comprobó el código de identidad sin cambios, el contrato histórico sintético y la integración real con workouts sintéticos. Las capturas son navegadores automatizados, no dispositivos físicos.

## Incidencias resueltas durante pruebas

- Puerto4190 reservado en WebKit/Node: la preview de staging usa4191. El flujo final de ambos navegadores fue directo y real.
- Adaptador de regresiones anterior no incorporaba `oauth.js` con query de caché; se corrigió exclusivamente el adaptador, sin tocar OAuth.
- Carpetas de resultados ausentes y esperas del harness sobre variables/pasos que no existen en la app actual se corrigieron. No se alteraron expectativas de persistencia ni permisos.
- Se detectó que un formulario enviado viejo podía crear otra versión si no había draft. La segunda migración exige la última revisión y rechaza también una pestaña inicialmente vacía.
- Se verificó la revocación de permisos después de aceptar; se mantiene accesible en la UI.

## Limpieza, rollback e integridad

Diez usuarios sintéticos del manifiesto: sesiones revocadas y usuarios eliminados. Eliminados sus perfiles, cuatro rutinas Coach, rutina normal de prueba, días, ejercicios, cuatro workouts de prueba, notas, código, uso y asignación sintéticos. No se eliminó `patatasimple1234` ni otros usuarios/fixtures anteriores.

Cero filas en las seis tablas Coach. Lista privada del piloto vacía. Cero usuarios con el prefijo de esta tarea. Las nueve tablas preexistentes de staging conservan exactamente sus recuentos y MD5 iniciales, incluidos fixtures previos.

Rollback se negó a actuar con datos Coach presentes. Tras limpieza se ejecutó completo y los seis grupos de metadatos —columnas, constraints, RLS, policies, triggers y funciones— coincidieron con el baseline. Se reinstaló el candidato vacío. La Edge mock continúa instalada con JWT obligatorio; una reversión permanente también retiraría exclusivamente esa Edge.

Producción: las nueve tablas conservan recuentos y MD5 iniciales; sus 17 funciones y metadatos coinciden con la base compartida revisada. RPC de ciclo `88c3564c3c49cf9c53fccba89a1e71b5`. Main remoto sigue `fc555a82f1473310995909742b927a2e855d61d4`. No hubo escrituras en producción ni cambios de configuración Auth/SMTP/OAuth.

Evidencias de ejecución y capturas: `tests/coach/results/`, ignorado. `final-integrity.json` conserva la comparación completa; `totals.json`, el desglose. No confundir esta evidencia local con contenido publicable.
