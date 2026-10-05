# Continuidad Basic → Premium: persistencia y permisos

Prueba nueva sobre una única rutina sintética de staging, creada mediante intake/reserva Basic y propuesta de modelo **mock**, revisada y aceptada con JWT reales. Reutiliza cuatro cuentas de prueba controladas; no crea usuarios ni cambia Auth, roles o producción. Las credenciales, UUID exactos y capturas completas permanecen exclusivamente en `private/`, ignorado por Git.

## Flujo persistido

La base contiene tres días, doce ejercicios con UUID y nueve workouts históricos, dos notas modernas, una operación Basic aceptada y una revisión original con series individuales. El upgrade conserva la rutina, días, ejercicios, operación, revisión, notas y workouts. El plan se autoriza desde backend y cambia en `routine_management`; no se codifica como un rol de perfil.

1. **KEEP:** reserva semanal en semana 1; finalización explícitamente mock usando el contexto real capturado. El propietario no puede aceptar antes de revisión. Reviewer asignado aprueba, doble aceptación conserva N y avanza una sola vez a semana 2.
2. **REVIEW independiente:** nuevo check-in en semana 2 con petición de revisar un ejercicio. La aprobación directa falla con `premium_manual_resolution_required`; propietario y trainer normal no pueden resolver. Reviewer resuelve explícitamente a KEEP, conservando el output original REVIEW y la resolución humana. Doble aceptación conserva N y avanza una sola vez a semana 3.
3. **Chat:** candidato mock para retirar solo la tercera serie de sentadilla goblet del lunes, con `from` exacto. Queda persistido en `pending_review`; no modifica la rutina. Reviewer asignado aprueba, propietario acepta desde dos solicitudes concurrentes y se crea una sola revisión N+1 sin avanzar semana 3.
4. **Workout N+1:** el JWT propietario utiliza el mismo POST `workouts` del producto. Antes comprueba la protección de duplicados por usuario/rutina/día/fecha. Guarda cuatro ejercicios del lunes, goblet con dos series y la nueva revisión. La relectura coincide exactamente con el payload persistido; otro cliente y un trainer normal no ven ese workout.
5. **Continuidad posterior:** los nueve workouts anteriores, operación Basic, revisión N, notas y días permanecen byte a byte idénticos. El contexto posterior capturado directamente por el backend contiene N+1, semana 3, origen `inherited_basic`, historial `shared_existing_training`, decisión Premium aceptada y cuatro exposiciones del goblet, incluida la nueva sesión de dos series con fecha/kg/reps/RIR exactos. No reutiliza el transcript de N como hechos vigentes.

El contenido funcional de los once ejercicios no afectados conserva identidad, día, orden, nombre, notas y series/reps/RIR/descanso; sus filas live completas permanecen byte a byte idénticas. La revisión nueva enriquece metadata, por lo que no se compara indiscriminadamente su JSON completo con el antiguo; la revisión original sí se exige idéntica.

## Resultados únicos

| Ejecución | Resultado |
|---|---:|
| `pipeline.cjs weekly-finish-keep` | 2/2 |
| `pipeline.cjs weekly-accept-keep` | 16/16 |
| `pipeline.cjs review-reserve` | 2/2 |
| `pipeline.cjs weekly-finish-review` | 2/2 |
| `pipeline.cjs weekly-accept-review` | 20/20 |
| `pipeline.cjs chat-finish` | 2/2 |
| `pipeline.cjs chat-accept` | 26/26 |
| `pipeline.cjs workout` | 11/11 |
| `pipeline.cjs history` | 9/9 |
| `pipeline.cjs history-context` | 5/5 |
| **Pipeline** | **95/95** |
| `security.cjs unassigned-reviewer` | 1/1 |
| `security.cjs assigned-reviewer` | 2/2 |
| `security.cjs negative` | 63/63 |
| **Permisos** | **66/66** |

Total de estos dos harnesses: **161/161 comprobaciones únicas**, de las cuales 150 usan JWT reales y 11 validan contratos/contextos privados capturados del backend. No se suman reejecuciones del mismo caso. La preparación de la fixture, el upgrade y el adapter tienen resultados independientes en `live.cjs`; las regresiones locales, SQL y llamadas reales a IA se informan separadamente.

La matriz negativa cubre propietario, otro cliente, trainer normal, reviewer y anon: ninguno puede otorgar entitlements, provisionar, reclamar llamadas de servicio o escribir las tablas privadas. Otro usuario no puede adoptar esta rutina ni cargar su Chat completo; los roles y el estado del propietario permanecen idénticos. Un reviewer autorizado pero no asignado no lee el mesociclo; tras asignación explícita lee solo el contexto permitido y no accede a receipt/context_bundle de Chat.

## Límites de la prueba

Las respuestas del modelo y receipts de estos flujos son mock: **cero llamadas OpenAI y coste cero** en estos harnesses. La persistencia, permisos, revisión y aceptación se ejecutaron contra staging con JWT reales. No se presenta el POST de persistencia como una interacción manual completa de la UI: esa prueba del producto se registra por separado. Las fechas de la fixture se prepararon explícitamente como históricas para respetar el bloqueo normal de guardar dos veces el mismo día; no se deshabilitó ningún guard.

La limpieza final, la llamada semanal real y el intento Chat bloqueado antes del proveedor corresponden al coordinador. Estos scripts no hacen limpieza automática, publicaciones ni llamadas a proveedores, y no modifican la cuenta real patatasimple. El resultado completo y los bloqueos pendientes constan en FINAL.md.
