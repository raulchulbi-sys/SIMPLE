# SIMPLE Coach — candidato Fase 1A

Solo staging `dmqjexigdnfzobarhnib`. Rama `codex/coach-phase1a`, base local `7cf24fa` con árbol idéntico a main publicado `fc555a82f1473310995909742b927a2e855d61d4`. No merge, publicación, IA real, Stripe ni modificaciones de producción.

## Entrega

Seis tablas: `training_intakes`, `intake_health`, `context_grants`, `coach_operations`, `routine_management`, `routine_revisions`. Esquema privado de funciones `coach_private`, sin séptima tabla. Se reutilizan routines/days/exercises/workouts/notes. Los RPC anteriores, RLS anteriores, roles y Auth no se modifican.

Migraciones exactas, por orden:

1. `supabase/migrations/20260928144706_coach_phase1a_safe.sql`: tablas, constraints, permisos, comandos y guardas de estructura.
2. `supabase/migrations/20260928151713_coach_intake_concurrency.sql`: rechaza tanto un formulario enviado antiguo como una pestaña vacía anterior a la primera versión.
3. `supabase/migrations/20260928152723_coach_fk_indexes.sql`: índices de soporte a FK compuestas.

Rollback: `supabase/rollback-coach-phase1a.sql`. Rechaza tablas Coach con datos. No utiliza CASCADE indiscriminado. Se probó el rechazo con fixtures presentes y después el rollback completo vacío; columnas, constraints, RLS, políticas, triggers y funciones volvieron al estado previo. Finalmente se restauraron las tres migraciones exactas en una transacción. El candidato queda instalado, con cero datos Coach y autorización piloto vacía.

Edge `simple-coach-mock`, versión staging 2, `verify_jwt=true`. Solo admite staging y origen local puerto4191; el usuario se obtiene de Auth, no del body. Reserva con JWT del usuario y accede al contexto/finaliza con dos RPC service-only. No clave de modelo, prompt, proveedor IA ni salida ejecutable. Campos desconocidos se rechazan. Las declaraciones de molestias/limitaciones no vacías detienen este mock para revisión humana; no se pretende validación clínica.

## Comandos y matriz real

Usuario autenticado client: `get_my_coach_access`, `save_my_training_intake`, `set_my_coach_context_permission`, `reserve_basic_generation`, `accept_basic_plan`.

Solo backend: `coach_backend_context`, `coach_backend_finish`.

| Actor | Leer filas del propietario | Escritura directa en seis tablas | Comandos propios | Finalización backend |
|---|---|---|---|---|
| Propietario client | Sí | Denegada | Sí, con piloto/contexto/versión cuando corresponde | Denegada |
| Otro client | Cero filas del propietario | Denegada | Solo sus datos; sin piloto no genera | Denegada |
| Trainer | Cero filas Coach del propietario | Denegada | Rechazados por rol | Denegada |
| Anon | Denegado | Denegada | Denegados | Denegada |
| Service del orquestador | Contexto limitado por RPC a usuario/operación/grants/version actuales | Sin privilegios directos en tablas nuevas | No suplanta al navegador | Sí, validación backend |

Los tests HTTP usan contraseñas aleatorias de diez cuentas sintéticas confirmadas en staging, sin correos. El gateway y el orquestador verifican JWT reales. Los 30 tests transaccionales y dos de respuesta tardía son pruebas SQL complementarias con claims de rol: **no se presentan como nuevas autenticaciones JWT**. El servicio real sí recorrió contexto y finalización desde Edge en las pruebas HTTP/navegador.

## Rutina y prescripción

Una operación vigente por usuario, clave idempotente por usuario, bloqueo transaccional por usuario, cinco intentos/hora y reserva de cinco minutos. Una aceptación genera rutina, días y ejercicios nuevos, revisión1 con snapshot/UUID/hash y gestión Coach, todo atómico. Reintentos y dos aceptaciones concurrentes devuelven el mismo UUID. No se copian notas, resultados, asignaciones o códigos.

Tres triggers nuevos en routines/days/exercises congelan la prescripción Coach por cualquier ruta. Se permite ordenar/archivar la rutina; entrenamientos y notas personales usan las vías existentes. Las rutinas normales siguen editables. Las tablas viejas conservan sus policies y los 17 RPC originales mantienen definición, owner, grants y search_path.

## Frontend y preview

Producto: `assets/coach.js`, `assets/coach.css`, tres líneas de integración en `index.html`. Se activa únicamente al apuntar a staging. Atletas sin asignación reciben el recorrido; un atleta ya asignado sin rutina Coach conserva su inicio. Una rutina aceptada mantiene acceso a anamnesis/permisos y permite revocarlos. Roles, identidad, OAuth, recuperación, entrenamiento e historial mantienen el código anterior.

Preview final: `http://127.0.0.1:4192/review`. Es un recorrido **ficticio local**, con CSP `connect-src 'none'`; no sirve las cuentas ni tokens del test. Al recargar se reinicia. Permite escoger Basic, rellenar, generar, revisar, aceptar y entrenar. No equivale a los tests reales de staging.

Servidor: `COACH_PORT=4192 node tests/coach/preview.cjs`. Reutiliza el bundle SDK local existente para la ruta de staging `/`; `/review` y `/demo` no necesitan SDK remoto. Para el recorrido real se utilizó puerto4191. Puerto4190 se descartó por estar reservado en ciertos motores; ambos motores finalmente ejecutaron tráfico real directo, sin puente ni respuestas simuladas de Coach.

Scripts de prueba y preparación quedan en esta carpeta. `prepare.cjs` crea manifiesto y SQL privados y se niega a reemplazar una fixture existente. Aplicar su seed exclusivamente en staging, ejecutar `security.cjs`, `prepare-rollback.cjs`, `build-sql-tests.cjs` (SQL en transacción), `browser.cjs` y `training-browser.cjs`. El manifiesto exacto de esta ejecución se conserva en `results/manifest.json`, ignorado por Git. Sus credenciales/sesiones están en `private/`, también ignorado. No ejecutar otra vez estos scripts contra las fixtures limpiadas. La limpieza de esta ejecución está documentada con SQL acotado por esos UUID en `private/cleanup.sql`.

Los archivos `demo-*` son exclusivamente herramientas de revisión. La aplicación real no los referencia. Ningún resultado, captura, binario CLI, secreto, JWT o fixture de ejecución entra en el commit.

## Advertencias y Fase 1B

Advisors: sin FK nuevas sin índice. Avisos de SECURITY DEFINER autenticado son intencionales para los cinco comandos públicos validados, con comprobación de actor/ownership y grants explícitos. El aviso preexistente de protección de contraseñas filtradas no se modifica. Los índices recién reinstalados aparecen como no usados.

La infraestructura permite preparar 1B, pero **no valida una prescripción generada por IA real**. Antes de conectarla faltan selección/configuración del proveedor, política de datos/retención del contexto sensible, evaluación de seguridad del contenido, catálogo de ejercicios y reglas de material/limitaciones, límites de coste y pruebas del contrato con respuestas reales. El esquema técnico estricto no sustituye esa validación. Nada de ello se implementa en 1A.

No hay desviación del alcance de seis tablas. Se concreta el piloto en función privada del servidor y el límite de una rutina inicial; no se construyen entitlements comerciales, chat, Premium, check-ins ni versionado avanzado.
