# Integración controlada de identidad y onboarding — 24/09/2026

Candidato local en `codex/integration-onboarding-identity`, construido desde
`b774d2508816967669591e14a9bd8dba36f978ba`. No publicado. Los dos candidatos
originales permanecen sin cambios en sus worktrees. Como sus cambios aún no
estaban confirmados en commits, se combinan sus archivos mediante una fusión
de tres vías; no se fusiona ni se actualiza `main`.

## Revisión previa y resolución

El único archivo común es `index.html`: la simulación `git merge-file -p`
terminó con código 0 y cero conflictos de texto. Onboarding cambia markup y
bootstrap de Auth; identidad cambia lecturas históricas, notas y UUID. Los
otros 30 archivos no tienen una versión enfrentada. La revisión individual
está en `results/file-by-file.md`; las huellas originales están en
`results/source-manifest.json` y `results/original-candidates-after.json`.

El bloque interior de 253.639 caracteres, desde `reload()` hasta el final de
`redeemShareCode()`, conserva exactamente la lógica del candidato de identidad.
Su única diferencia final es el listener de desplazamiento en
`showProgressPoint()` descrito abajo. El CSS aprobado y Atlas se copian sin modificaciones. Los SQL de
aliases de días y rollback se incorporan sin ejecutarlos; solo se retira una línea vacía final de esos tres SQL para superar git diff --check.

Conflicto funcional detectado: el nuevo logout esperaba la respuesta de red
antes de invalidar el contexto de entrenamiento. Una respuesta anterior podía
llegar durante esa espera. `assets/auth.js` incrementa ahora
`__workoutContextVersion` antes de `signOut`, conservando el borrador. Se
comprueba el cierre lento y el doble cierre en los ocho escenarios de navegador.

La segunda ejecución consolidada detectó además un tooltip fuera de pantalla
en WebKit a 360 px. La reproducción aislada demostró que el scroll posterior
al foco dejaba la posición del tooltip obsoleta, incluso después de 300 ms.
El nuevo test determinista reprodujo el defecto en los ocho escenarios móviles
de Chromium/WebKit. `showProgressPoint()` reposiciona el mismo punto seleccionado
cuando llega ese scroll, sin cambiar valores, UUID, filtros o consultas. No es
un rediseño. Se repiten solo la suite afectada, identidad/gráficas y protección
estática; las demás suites finales siguen siendo válidas y no se repiten.

Las adaptaciones de tests no alteran las expectativas de identidad:

- `legacy-browser.cjs` carga el CSS/JS externos reales dentro del HTML servido
  por los harnesses antiguos, espera el bootstrap y navega al login antes de
  que esos harnesses preparen una sesión. Los tests de onboarding sirven los
  archivos separados, como el producto.
- El hook de regresiones carga las funciones reales de logout/reset en las
  pruebas VM y proporciona únicamente dobles de interfaz. Las 33 expectativas
  de concurrencia se mantienen.
- `function-source.cjs` delimita funciones usando el parser de JavaScript,
  evitando incluir todo el bootstrap posterior en `redeemShareCode`.
- La expectativa de callback síncrono lee ahora `assets/auth.js`, su ubicación
  real. El contrato histórico conserva las cinco expectativas recuperadas.
- El preview admite un puerto independiente; todas sus conexiones Auth están
  bloqueadas. Los resultados/capturas del harness antiguo se escriben en su
  directorio ignorado.

## Ejecución local

Requiere los harnesses archivados y Playwright del runtime indicados en cada
script. No es una suite autónoma de CI. No ejecutar los scripts `prepare` o
`live` ni los SQL para reproducir estas regresiones locales.

```powershell
node tests/identity/protected.cjs
node -r ./tests/integration/legacy-browser.cjs tests/exercise-alias/browser.cjs
node -r ./tests/integration/legacy-browser.cjs tests/identity/browser.cjs
node -r ./tests/integration/legacy-browser.cjs tests/session-edit/contracts.cjs
node tests/session-edit/regressions.cjs
node -r ./tests/session-edit/regression-hook.cjs tests/integration/chart-scroll.cjs
$env:AUTH_WIDTHS='320,390,430,1280'
node tests/onboarding/browser.cjs
$env:AUTH_WIDTHS='320,1280'
node tests/onboarding/recovery-sdk.cjs
# En otra terminal, con la copia oficial verificada del SDK en private/:
$env:AUTH_PREVIEW_PORT='4181'
node tests/onboarding/preview.cjs
# En la terminal de pruebas:
$env:AUTH_PREVIEW_PORT='4181'
node tests/onboarding/visual-check.cjs
```

Los resultados finales de esta integración se detallan en
`results/FINAL.md` y `results/summary.json`. Los intentos anteriores fallidos
se conservan separadamente, sin sumarlos como éxitos.

## Backend y correo

Esta fase solo realiza lecturas de Supabase. No cambia cuentas, workouts,
notas, RLS, funciones, SMTP, URLs ni OAuth. Google/Apple/Facebook siguen ocultos.
Las huellas anteriores y posteriores incluyen nueve tablas, funciones públicas
con ACL, políticas y flags RLS. No se generan fixtures remotas.

El SMTP de producción sigue siendo Resend. Staging tiene desactivado el SMTP
personalizado y usa el servicio predeterminado. Probar staging no acredita la
entrega de Resend en producción. Según la documentación oficial, el servicio
predeterminado solo envía a direcciones del equipo del proyecto:
https://supabase.com/docs/guides/auth/auth-smtp

Staging admite `http://localhost:3000/?reset=1` sin modificar su Site URL
`http://localhost:3000`. Se verifica con un token deliberadamente inválido:
HTTP 303 conserva el destino. Esa comprobación no envía un email ni prueba un
enlace válido. La cuenta temporal, su único correo de recuperación y su limpieza
quedan pendientes de autorización concreta. El usuario debe introducir y enviar
personalmente la nueva contraseña. No se deben compartir tokens o contraseñas
en el chat ni incluirlos en Git.

## Publicación posterior, aún no autorizada

1. Completar el ensayo de correo autorizado con el candidato y precisar qué
   servicio SMTP se ha validado. Resolver las URLs de Términos/Privacidad,
   que actualmente son `null`.
2. Obtener autorización expresa para publicar el commit integrado y promover
   el RPC de aliases de días. Revalidar versiones y huellas en ese momento.
3. Promover solo `tests/cycle-alias/candidate.sql`, con su guarda de versión y
   conservación de permisos; publicar el commit completo con HTML y assets.
   No volver a aplicar los RPC de edición ya publicados.
4. Comprobar en producción las huellas, login de ambos roles, UUID/notas,
   Última sesión, gráficas, borradores y ciclo según los datos vigentes.
5. Si falla: revertir la publicación del frontend y usar el rollback de
   producción del RPC de días con su guarda. No reescribir históricos.

No incluir `results/`, `private/`, SDK cacheado, capturas, credenciales ni los
archivos locales de continuidad en el commit.
