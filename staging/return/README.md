# Retorno HTTPS de staging reproducible

Estas fuentes reproducen el retorno aprobado del deployment de staging
`b668e3c8-b872-43cb-bf69-812675626329`. No son una nueva publicación.
El HTML conserva SHA-256
`c64775a86c7fd7f22fe7b2046fe29d1c05ab00e4a1c16bb3711d124e892046e0`.
El manifiesto contiene solo rutas públicas, tamaños y hashes.

## Ensamblado local

Se necesita el artefacto público anterior de 36 archivos, correspondiente a
`d0b8ae52-bcd6-41a8-b565-5c35f7dce3ec`. No se descarga ni se reconstruye
desde otra rama por suposición. El origen se lee sin modificarlo.

```text
node scripts/staging-return.cjs verify-rollback RUTA_BASE_36
node scripts/staging-return.cjs assemble RUTA_BASE_36 NUEVO_DIRECTORIO
node scripts/staging-return.cjs verify NUEVO_DIRECTORIO
node scripts/ci-offline.cjs
```

El destino debe ser nuevo. El ensamblador valida el inventario exacto antes de
escribir, conserva 35 archivos byte a byte, amplía únicamente `_headers` y añade
cuatro recursos. Rechaza rutas ajenas, enlaces simbólicos, archivos extra,
ausentes, modificados y destinos existentes. El resultado contiene 40 archivos.
No usa red, SDK, credenciales, Wrangler ni comandos de despliegue.

`headers-base.txt` y `headers-append.txt` conservan los bytes efectivos del
artefacto aprobado. Los bloques del retorno eliminan la política de referrer
heredada antes de fijar `no-referrer`, y fijan CSP y `no-store`. Se debe revisar
el resultado efectivo en Cloudflare en un futuro despliegue autorizado.

## Integración futura con PR #1

No se añaden recursos a la raíz pública de SIMPLE ni se cambia su configuración.
PR #1 debe incorporar explícitamente este paso en su build **de staging** y
verificar el manifiesto antes de publicar. Publicar un árbol nuevo sin ensamblar
el retorno sigue pudiendo eliminarlo: esta rama no cambia los autodeploys.
Si cambian los 36 archivos base, se detiene el build; actualizar el manifiesto
requiere revisar el nuevo inventario y conservar el retorno, nunca omitir la
validación para hacer pasar un despliegue.

## Reversión

Guardar el artefacto anterior y comprobarlo con `verify-rollback`. La publicación
de ese artefacto o la selección del deployment anterior requiere una autorización
de despliegue independiente. Revertir este commit no borra suscripciones ni datos.

## Evidencia de este sprint

12 casos offline nuevos; dos ensamblados independientes del artefacto histórico
coinciden con los 40 hashes aprobados. La base conserva sus 36 hashes. La CI
mantiene las 88 comprobaciones anteriores y añade los 12 casos; 42 análisis de
sintaxis. No es una prueba nueva de Cloudflare, Stripe, JWT ni Supabase.

[Recibo saneado del ensamblado positivo](assembly-evidence.json): procedencia de
los dos artefactos históricos, hash del ensamblador y manifiesto, inventarios
medidos de ambos resultados y comparación exacta con los 40 archivos aprobados.
Se verificaron los resultados ya creados, sin reconstruirlos ni publicarlos.
Los 12 casos de CI no ejecutan por sí solos ese ensamblado completo: necesitan
la base histórica para reproducirlo. El recibo es evidencia local, no una
atestación firmada del proveedor. No contiene rutas personales ni credenciales.
