# Coach Basic: piloto supervisado v2, sin salud

Base pública: `87670246affb3464ab9185882dd9566a5f0683e9` (árbol local equivalente `df9ac7d`). Rama aislada: `codex/coach-pilot-v2`.

## Cambio

A v2 explícito permite entrenamiento sin B. B permanece inactivo. No se recogen ni proyectan datos de salud; el backend también rechaza payloads antiguos o falsificados. La anamnesis usa opciones cerradas, sin texto general. Se conserva modelo `gpt-5.4-2026-03-05`, prompt `basic-initial-v2` y output schema.

Borrado de borrador propio con versión, revocación de contexto dependiente, revisión humana y aceptación atómica permanecen separados. La rutina aceptada no se elimina al revocar. La recuperación de una reserva caducada requiere reviewer y motivo; no envía nada automáticamente. El proveedor solo recibe un despacho por operación. Feedback conserva el criterio backend aprobado: existe al menos un workout propio asociado a la rutina; no acredita actividad física ni impone un nuevo criterio sobre las series registradas.

No cambia Auth/OAuth/SMTP, identidad/aliases, rutinas ordinarias, workouts ni políticas centrales. `index.html` solo versiona los tres assets Coach. No se añade ninguna tabla. Producción debe mantener whitelist vacía. Reviewer existente: `900e6cdc-0694-4263-bedc-b4852af07b83`, vencimiento `2026-10-28T23:59:59Z`; no se renueva.

## Validación previa a publicación: 1.609 comprobaciones distintas

| Bloque | Resultado |
|---|---:|
| Contrato/proveedor y handler Edge con transportes sintéticos | 142/142 |
| UI Coach, comparación de catálogos y delta reserva caducada | 258/258 |
| SQL v2 en transacción revertida | 70/70 |
| SQL reserva caducada/respuesta tardía | 29/29 |
| Rollback y reaplicación de la versión final | 17/17 |
| JWT reales staging: negativos / concurrencia / revisión-aceptación-feedback | 47 + 12 + 52 = 111/111 |
| Lecturas REST reviewer/propietario independientes | 5/5 |
| Cuatro generaciones reales, persistencia y calidad | 60/60 |
| Regresiones generales de SIMPLE | 917/917 |

Regresión general: onboarding276, recuperación72+28, SDKGoogle96, botónGoogle32, contratosedición40, progresociclo15, duración30+8, borradores7, concurrencia33, navegación26, modos16, flash10, funcionesgenerales105, drag/ciclo/gráficas12, pulido110 y contratoactualtema1.

Las dos suites antiguas de snapshots presentan **nueve fallos también en la base publicada sin modificar**. Comparan con commits anteriores a cambios aprobados o usan un mock DOM incompleto. No se alteraron sus expectativas ni se cuentan como superadas; la equivalencia de archivos y las pruebas funcionales actuales constan en `REGRESSION-COVERAGE.md`. No existe una regresión nueva identificada.

Chromium y WebKit automatizados, 320/360/390/430 y escritorio, claro/oscuro, foco, contraste, táctil y viewport reducido como aproximación al teclado. No es una prueba de iPhone físico. Las pruebas generales de Auth interceptan HTTP: no se repitió consentimiento Google real, no se enviaron emails y no se comprobó recepción de recuperación.

## Calidad real y presupuesto

Todas las llamadas fueron sintéticas en SIMPLE Security Test, ninguna en producción. Cuatro llamadas de diez autorizadas; coste calculado a partir del usage persistido: **0,102935 USD**, de un límite de0,50USD. No hubo retries automáticos ni outputs editados.

| Caso | Duraciones estimadas por fórmula conservadora (min) | Coste USD |
|---|---|---:|
| Principiante2,30min,gimnasio,ejercicioevitado | 23,22 | 0,0209475 |
| Principiante3,casa,mancuernas/bandas,preferencia | 36,36,37 | 0,016325 |
| Intermedio4,90min,gimnasio | 55,58,57,54 | 0,029705 |
| Avanzado5,60min,gimnasio | 47,47,45,48,47 | 0,0359575 |

Schema, días, material, evitados/preferidos, series/reps/RIR/descanso, volumen/frecuencia y duración pasan el contrato vigente. Son propuestas iniciales para revisión humana; esto no sustituye una valoración profesional ni prueba adaptación clínica. Tener 90min disponibles no obliga a llenar los90min.

## Integridad, limpieza y recuperación

Diez identidades sintéticas y su estructura de pruebas fueron eliminadas mediante lista exacta de UUID y comprobación de prefijo. Las nueve huellas centrales y Auth users/identities de staging volvieron exactamente al estado anterior. Las siete tablas Coach quedaron vacías. Los mapas sintéticos piloto/reviewer y recibos de migración exclusivamente de prueba se retiraron; se conservan las migraciones reales del candidato.

SQL de reversión: `supabase/rollback-coach-pilot-v2.sql`. Requiere piloto cerrado y sin generación en curso; restaura funciones/ACL anteriores, preserva recibos v2 y datos y no usa CASCADE. Coordinarlo con assets/Edge anteriores. No debe restaurarse aisladamente el frontend antiguo para reabrir salud.

`PRIVACIDAD-Y-CONSERVACION.md` distingue borrador, intake enviado, operación, propuestas, rutina y feedback, además de los requisitos pendientes para lanzamiento comercial. No se afirma cumplimiento RGPD ni anonimización perfecta. `store:false` no equivale a ZDR.

Evidencias, huellas, JWT temporales, screenshots y ledger están únicamente en directorios `private/` y `results/` ignorados. No se publican. `public.cjs` verifica tras el deploy SHA256 de los cuatro archivos servidos y smoke anónimo móvil/escritorio; no crea cuentas ni modifica datos. El estado final del despliegue queda en el informe local de resultados.
