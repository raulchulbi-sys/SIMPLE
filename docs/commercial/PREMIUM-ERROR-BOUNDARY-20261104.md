# Premium: cierre de errores tras caducidad o revocación — 04/11/2026

**APTO PARA REVISIÓN. Corrección local; no instalación ni publicación.**
Rama `codex/premium-review-error-guard`, basada en
`6bb4596270034e74d5c30abd949410243de4e346`. Conserva el Basic aprobado
`fffbc16d9588225c0e350324d7fc28af9e25209b` como ancestro, sin editarlo.

## Defecto confirmado y solución

Se recuperó el prototipo de la revisión independiente y se reprodujo de nuevo
el fallo **antes** de cambiar el producto. Con el validador deportivo real,
ralentizado solo en el clúster de pruebas, `6bb4596` devolvía
`P0001 premium_initial_exercise_not_permitted` cuando caducaba el reviewer o el
entitlement del propietario durante una validación fallida. Un UUID inexistente
devolvía `42501 premium_initial_reviewer_required`. Ambas regresiones fallaron
con esos resultados; los datos quedaron intactos.

Una excepción abandona la ejecución normal de su bloque: la fase final de
autorización solo se alcanzaba cuando el validador terminaba correctamente.
El alcance demostrado exige autorización válida al iniciar la llamada; no es
una lectura global de operaciones privadas ni una escritura no autorizada.

El cambio de producto añade 23 líneas exclusivamente al cuerpo de
`public.premium_initial_review(uuid,boolean,text)`:

1. Captura **solo** las excepciones P0001 de una lista explícita de 14 errores
   de negocio conocidos: doce del validador y sus dependencias, argumentos
   inválidos y estado no pendiente. Conserva mensaje, DETAIL y HINT.
2. Deja que la ejecución alcance la **misma consulta completa** de autorización
   de fase 3. No duplica el guard ni crea un helper, permiso o ruta alternativa.
3. Si el acceso ya no existe, devuelve la denegación 42501 uniforme. Si sigue
   vigente, devuelve el error original P0001 con sus detalles. La llamada falla
   en ambos casos; nunca convierte un error en éxito.
4. Las excepciones desconocidas, incluidos P0001 no catalogados, y otros
   SQLSTATE no se ocultan. Se probaron P0001 inesperado y XX000, con acceso
   vigente y revocado. Los errores conocidos de autorización en la aserción
   conservan su conversión previa a 42501.

Los locks del propietario, la operación y sus dependencias se adquieren **antes**
del subbloque con EXCEPTION; no se pierden al capturar el error del validador.
Se conservan orden de bloqueo, propietario fijado, relecturas y reloj PostgreSQL.
Una revocación que debe esperar un lock se serializa después de la decisión;
la caducidad del reloj sigue comprobándose incluso mientras las filas están
bloqueadas. No se promete revocación retroactiva ni latencia constante.

Las decisiones humanas, replay de aprobación ready, proyección segura, contrato,
generación, catálogo, prescripciones, cuotas, suscripciones, entrenamiento,
RLS/ACL y funciones auxiliares no cambian. Ningún fallback restaura el writer
vulnerable. El prototipo independiente duplicaba el guard en el handler; esta
versión reutiliza el guard existente y cubre también errores de argumentos/estado.

Referencia: [control de excepciones PostgreSQL 17](https://www.postgresql.org/docs/17/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING).

## Pruebas nuevas y regresiones realmente ejecutadas

Node 24.19.0, PostgreSQL **17.11**, clústeres desechables loopback creados por los
runners existentes, verificación de directorio/base/rol/marcador antes de SQL.
Todos los clústeres propios quedaron detenidos. Sin servidores remotos, JWT,
credenciales, pagos ni llamadas OpenAI.

| Batería | Resultado | Interpretación |
|---|---:|---|
| Reproducción sobre 6bb4596 | 2 fallos esperados + 2 controles PASS | prueba del defecto; no sumar como casos finales nuevos |
| Premium PostgreSQL completa | 90/90 | 68 regresiones anteriores + 22 casos nuevos |
| Premium focalizada posterior | 5/5 | 4 repetidos/reforzados + 1 caso nuevo de estado ready |
| **Premium consolidado** | **91/91** | **23 casos nuevos**, sin duplicar reejecuciones |
| Basic PostgreSQL, rama reconciliada | 89/89 | permisos, carreras, aislamiento y rollback |
| Facturación PostgreSQL | 24/24 | pago sintético local, idempotencia, RLS y rollback |
| CI composición #5/#6/#7/#8 | 339/339 | incluye 11 contratos UI/Edge con dobles |
| Contratos Premium frontend/proveedor | 23/23 | offline, cero tráfico proveedor |
| Huellas Basic instaladas | 2/2 | nuevos controles de fuente contra el checkpoint |

**568 casos distintos ejecutados y superados al cierre, 25 nuevos.** No se suman
los 48 análisis sintácticos de CI ni las comprobaciones de sintaxis adicionales.
No se contabilizan como nuevas ejecuciones las 615 del informe nocturno anterior.
No se repitió la batería de navegador con dobles ni se hizo navegador conectado.

Los 23 nuevos Premium comprenden:

- Caducidad real del reviewer y del entitlement durante un validador real que
  falla; se exige haber alcanzado la espera del validador, no denegar al entrar.
- Revocación confirmada en otra sesión PostgreSQL durante validación real válida
  e inválida, observando la barrera con `pg_stat_activity`.
- Estado ready/rechazo después de revocar durante la aserción: denegación uniforme,
  sin revelar `review_not_pending`.
- Doce errores de negocio, con SQLSTATE/mensaje/DETAIL/HINT conservados mientras
  la autorización continúa vigente (inyección explícita en la frontera).
- Operaciones ajenas, inexistentes y NULL nunca invocan el validador.
- Cuatro casos de fallos inesperados no silenciados.
- Lista de errores contrastada con los tres validadores reales versionados;
  el test falla ante errores nuevos no contemplados.

El esquema es mínimo sintético, los helpers/validadores se extraen del código
real, y las identidades se modelan mediante claims SQL. **No es validación
PostgREST/JWT real ni certificación del estado actual de Supabase.** Las pruebas
de revocación del reviewer usan la tabla de configuración del arnés, no alteran
la función remota de configuración.

## Huellas y rollback

| Artefacto | SHA-256 de archivo LF | MD5 prosrc |
|---|---|---|
| Delta corregido | `1dd35ba1a36dfcf1d11f6d0a07ec53540c20326ca1818cf89010a26890ad2458` | `c16541b25d191997fce42c2024784c7d` |
| Rollback cerrado sin cambios | `4d2b33ed2b6770dfc1eb76dd17581ab004f6779334219a1a022e433819604428` | `f3613abf80687b1c2647bd3d09f74b4d` |

El reemplazo local solo cambia la definición del RPC, preservando OID,
propietario, ACL, atributos, otras funciones, RLS/policies y filas. El rollback
cierra ese writer y su reaplicación recupera exactamente el catálogo candidato.
Los entrenamientos y las rutinas existentes no dependen de ese writer.

Evidencia de esta ejecución, ignorada por Git:
`tests/premium-review-security/results/before-error-fix.tap`, `postgres.tap`,
`filtered.tap` y `consolidated.json`; contratos en
`tests/premium-direct-production/results/unit.json`. La evidencia Basic y CI
vive en las copias nuevas respectivas, no en los worktrees privados de Work.

## Integración, revisión y autorización posterior

Basic se reconcilia independientemente desde el HEAD remoto #7 con los seis
archivos aprobados exactos; no se incorpora esta corrección Premium a #7 por
inercia. La copia combinada `9f1ec22` conserva Basic, retorno HTTPS, UI y tema;
el delta Premium no cambia sus archivos de producto. CI mantiene la unión de
suites. Contratos de estado, Portal y access permanecen compatibles.

Para publicar posteriormente se necesita autorización de los commits concretos,
relectura del HEAD remoto y revisión del diff. Primero avanzar #7 con Basic sin
force. Para Premium, partir después de #7 reconciliada y aplicar solo `6bb4596`
y el commit corrector de esta rama; **no volver a aplicar fffbc16** ni subir una
composición completa. Mantener la revisión de seguridad separada y los drafts.

La autorización de instalación Premium debe limitarse al delta identificado
arriba en SIMPLE Security Test, con ambos gates y admisión cerrados. Antes:

1. Capturar función/dependencias efectivas, proyecto, OID, propietario, ACL,
   atributos, RLS, 27 referencias y facturación; comparar con el checkpoint y
   con la preimagen expresamente aprobada. La preimagen original de repositorio
   es `3e954ba0b8bc7f8f97525b58780b4cc8`, **no se afirma que sea la remota actual**.
2. Detenerse ante cualquier diferencia. No reinstalar migración inicial ni A/B.
   Instalar únicamente el RPC si todavía no coincide. Comprobar postimagen,
   metadatos e integridad; estado incierto exige lectura, nunca repetición ciega.
3. Si se autorizan aparte sesiones sintéticas en memoria, comprobar denegaciones
   JWT con reviewer cerrado y cerrarlas al terminar, sin fixtures ni activaciones.
4. Ante regresión demostrada, solo rollback cerrado seguro y conciliación.
   Prueba positiva, ampliación temporal y revocación Basic mismo-JWT requieren
   su propio scope. No están autorizadas por este trabajo local.

## Riesgos pendientes

- P1 operativo: el servidor no recibe esta corrección hasta una instalación
  autorizada; #7 remota sigue con Basic antiguo hasta publicar la reconciliación.
- P1 validación: revocación Basic con el mismo JWT aún pendiente; no la sustituye
  una revocación SQL ni un JWT caducado. Debe usarse un coordinador de fases fiable.
- P1 integración: artefacto final #1/#5/#6 y bundle Coach #2 necesitan reconciliación
  explícita antes de hosting/generación. No desplegar por números históricos.
- P2 límite: no cubre cada intercalación de SQL administrativo arbitrario ni
  todos los errores futuros de dependencias. Cambiar un validador requiere revisar
  la lista de dominio y sus tests; errores de infraestructura siguen visibles.
- Lanzamiento: TEST no habilita LIVE; oferta, fiscalidad, contratos y límites
  comerciales siguen pendientes y fuera del alcance.

No push, PR remota, merge, despliegue, sesión Auth ni escritura conectada.
Las dos ramas nuevas contienen únicamente trabajo local autorizado.
