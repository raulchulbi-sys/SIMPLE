# Reconciliación local de Basic para PR #7 — 04/11/2026

**APTO PARA REVISIÓN. No publicado ni reinstalado.**

La rama `codex/basic-security-reconciled` parte del HEAD remoto comprobado de
PR #7: `3cd39320d4473fdc5ce6b25f95c1953e90cec954`. PR #7 sigue abierta y draft.
Se aplicaron los seis archivos exactos del parche aprobado
`fffbc16d9588225c0e350324d7fc28af9e25209b`, sin utilizar la composición de PR
como sustituto. Se añaden únicamente este informe y dos tests de huellas.
El worktree original y sus evidencias privadas permanecen intactos.

## Igualdad de fuentes

Los seis blobs coinciden entre `fffbc16`, esta candidata y `9f1ec22`:

- `docs/commercial/REVIEWER-ENUMERATION-FIX.md`.
- `scripts/commercial-postgres.cjs`.
- `supabase/coach-reviewer-scope.sql`.
- `supabase/rollback-coach-reviewer-uniform-denial.sql`.
- `tests/commercial/postgres.test.mjs`.
- `tests/commercial/reviewer-enumeration-cases.mjs`.

| RPC | MD5 prosrc, LF |
|---|---|
| `review_coach_proposal` | `d94b96ae65e69997a37ae83b521ec16b` |
| `authorize_coach_retry` | `cdf6200bb140563a96ddc472cc0ac9b7` |

Estas son las huellas instaladas aportadas en el encargo, contrastadas con las
fuentes locales. **No son una nueva lectura de staging.** El test
`tests/commercial/basic-source-lock.test.mjs` falla si cualquiera de los dos
cuerpos cambia, incluidos espacios interiores del prosrc.

No se crea una migración ni un instalador de sustitución. El fichero A existente
se corrige como fuente para instalaciones futuras nuevas; **no ejecutar A/B de
nuevo sobre staging**. Si las definiciones efectivas ya coinciden, la instalación
de Basic se omite. El rollback estrecho aprobado se conserva byte por byte y
cierra los writers: nunca recupera el reviewer global ni el cuerpo vulnerable.

## Pruebas realizadas en esta ejecución

- `node scripts/commercial-postgres.cjs`: **24/24 facturación + 89/89 Basic**.
  Incluyen SQL real, denegaciones uniformes, autorización por acción/operación,
  revocación y caducidad durante bloqueos, idempotencia, proyección segura,
  RLS/ACL y los rollbacks estrecho y general cerrado.
- `node --test tests/commercial/basic-source-lock.test.mjs`: **2/2 nuevos**.
- CI de la composición `9f1ec22` con el delta Premium nuevo en una copia
  independiente: **339/339 casos offline, 48 análisis sintácticos**. Incluye
  **11 contratos compuestos** frontend/Edge con dependencias externas simuladas;
  ya están incluidos en los 339, no se suman aparte.

Clúster PostgreSQL 17 local nuevo, limitado a loopback, con marcadores de
identidad y cierre en `finally`. No se reutilizó una base conectada. Claims SQL
y dobles no equivalen a JWT ni Stripe reales. Los recibos locales están ignorados
en `tests/commercial/results/`; no se incluyen evidencias privadas históricas.

## Compatibilidad y conflictos conocidos

Heads remotos consultados, sin cambios:

| PR | Head | Estado |
|---|---|---|
| #5 retorno HTTPS | `fc245c9c91113b1b9db9a28847bcbdfc715c5224` | abierta, no draft |
| #6 Mi suscripción | `313344dbc607f2219922f7eb8a9102bc8cde3d53` | draft |
| #7 backend | `3cd39320d4473fdc5ce6b25f95c1953e90cec954` | draft |
| #8 tema | `1d1e443147d27a3e55a71aba9c212e30627a7b03` | draft |

Base remota declarada por esas PR: `b2f77c6f86318a4bf11d2b6754b2e3bbd7263ac6`.
La composición local `9f1ec2218555218176d9174480deb98f3361a6fe` conserva el
contenido Basic exacto, aunque `fffbc16` no sea su ancestro Git.

Comparación de todos los archivos cambiados en cada PR con la composición:
#5 y #6 solo difieren en `scripts/ci-offline.cjs`; #7 además difiere en los
tres archivos modificados por el parche Basic (SQL, runner PostgreSQL y tests).
Los archivos añadidos por el parche también coinciden. Los blobs de tema son
`e0b96bc29b458f0820392aa705ffaed63d5a96d0` y
`1cffea4ad5b63b8bae1ab2dc0170b7249ca6c3f3`, coincidentes con la evidencia de #8.

Debe conservarse la **unión** de suites CI; no resolver usando toda la versión
de una sola rama. No cambian los contratos `status`, `portal`, `access`, el
Customer ligado al propietario ni los derechos resueltos en servidor. El
retorno por navegador no concede acceso. UI requiere `billingTest === true` y
el backend de staging exacto; generación y reviewer siguen cerrados por defecto.

El ensamblador #5 fija un inventario histórico de 36 archivos y añade el retorno
mínimo. La pantalla ampliada #6 necesita su configuración y assets propios.
El manifiesto #1 no incluye aún esos assets: se necesita un artefacto final
reconciliado antes del corte, sin relajar hashes ni sobrescribir el retorno.
La simulación no integra #1/#2 ni prueba una web conectada.

## Actualización futura de GitHub (NO ejecutada)

1. Obtener autorización de publicación de **este commit local Basic**, manteniendo
   #7 draft. Volver a leer el HEAD remoto; debe seguir en `3cd3932`. Si cambió,
   detener la promoción, comparar y repetir solo controles afectados.
2. Revisar diff/lista de archivos, confirmar huellas y ausencia de privados.
   Desde esta rama, el avance es fast-forward. Una vez autorizado:
   `git push origin HEAD:codex/commercial-backend-review`.
   Sin force, merge, cambios de reglas ni instalación SQL.
3. Revisar el delta Premium corregido por separado. Su rama original contiene
   `fffbc16` como ancestro; para evitar duplicarlo sobre #7 reconciliada, preparar
   una rama futura desde la reconciliación y aplicar **solo** `6bb4596` y su
   commit corrector posterior. Revisión independiente antes de instalar.

Orden lógico posterior: #5 y #8 independientes → #7 reconciliada → #6 con unión
CI. Integrar #2 solo antes de habilitar generación y contrastar su bundle con el
desplegado; #1 se reconcilia con el árbol elegido antes de cualquier corte.
No reaplicar componentes instalados que ya coinciden; fuentes históricas de
Premium no se pueden utilizar para reemplazar el writer corregido.

## Pendientes

Revocación Basic con **el mismo JWT** sigue pendiente de ensayo autorizado; los
tests PostgreSQL no la sustituyen. Premium requiere revisión de su nuevo delta,
preimagen real y autorización de instalación independiente. Hosting final,
configuración LIVE, impuestos, oferta/cuotas y decisiones legales/comerciales
siguen fuera de esta reconciliación. No se activa ninguno de ellos aquí.
