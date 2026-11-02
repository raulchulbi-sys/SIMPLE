# Regresiones acotadas del reviewer

Estos cuatro scripts comprueban los consumidores de la proyección cerrada y preparan un ensayo SQL aislado. No descubren credenciales, inician sesiones, ejecutan SQL, despliegan ni llaman a proveedores. Los resultados, borradores SQL y fixtures locales deben quedar en `results/` o `private/`, ignorados por Git y fuera del artefacto público.

## Comandos offline

Desde la raíz del repositorio, con Node disponible:

```text
node tests/reviewer-security/ci-offline.cjs --source-root .
```

Es el comando reutilizable de CI. Ejecuta dos contratos del listado real: exige una capacidad válida del RPC aunque el perfil sea trainer, sin fallback a tablas privadas; y descarta una respuesta pendiente después de logout local o cambio de usuario. El control positivo crea una entrada y abre el scope exacto. También revisa que el generador SQL siga acotado y termine en rollback; no ejecuta ese SQL. No requiere secretos, backend, workflow privilegiado ni credenciales por defecto.

El navegador semántico se ejecuta por separado en un equipo de pruebas de confianza con Chromium/Edge y Playwright ya disponibles:

```text
node tests/reviewer-security/tabs-late-offline.cjs --source-root . --legacy-commit c818e35fcb0cfeddb61e8232aaaffba222ea8f4d --output tests/reviewer-security/results/tabs-late-offline.json
```

Puede indicarse otro módulo Playwright ya instalado mediante `SIMPLE_TEST_PLAYWRIGHT_MODULE`. Los valores por defecto corresponden al runtime Windows del entorno de pruebas. El commit antiguo debe existir localmente: sólo se usa `git show`; no se hace fetch, checkout ni publicación. Si está en otro repositorio local, `--legacy-repo-root` lo identifica explícitamente.

Son cuatro casos Chromium: dos pestañas con las fuentes antiguas/nuevas y backend cerrado simulado; apertura directa denegada sin fallback; respuesta del precheck tras cambiar de usuario; y respuesta de un componente destruido después de logout/login con la misma u otra identidad. En el último caso se verifica que la revisión, el controlador y el DOM nuevos no sean reemplazados por la respuesta retenida. Todas las peticiones del navegador se cumplen o abortan localmente; no hay `route.continue`, JWT, SDK/Auth real ni servidor. No representa una nueva matriz visual o WebKit, concurrencia DB ni autorización real.

El resultado de preparación reportado fue **6/6 casos nuevos offline únicos: 2 unidades y 4 casos de navegador**. Las reejecuciones por traslado o correcciones del arnés no aumentan ese recuento. El primer diagnóstico de dos pestañas correspondía al selector de propuesta y a `maybeSingle` ausente del SDK ficticio; se corrigió el arnés y se repitió sólo ese caso. Las evidencias originales siguen privadas.

## Ensayo SQL preparado

```text
node tests/reviewer-security/prepare-projection-sql.cjs --source-root . --output tests/reviewer-security/results/projection-future-fields.sql
```

El generador extrae los cuerpos exactos del RPC/helper de `20261018090206_reviewer_private_api_projection.sql` y renombra únicamente sus referencias para un esquema exclusivo. Los guards y el helper que entrega datos son dobles explícitos de prueba. Clona metadatos de tres tablas sin filas ni FKs, siembra registros inventados y comprueba las claves y valores públicos antes y después de añadir columnas y JSON privados futuros. El segundo caso exige rechazar un objeto en un campo numérico permitido. No demuestra RLS, JWT, elegibilidad ni consentimiento reales.

El coordinador ejecutó los **dos casos SQL: 2/2 PASS**, usando el borrador corregido SHA256 `a25a684b3abb15d897fa514de63192dda5ef2004bb9c1df6e4ecc3610eea3a29`. Son ensayos SQL con guards/datos MOCK en un esquema aislado, no autorización JWT ni prueba funcional productiva. El primer diagnóstico fue una fixture incompleta, corregida para aportar `objective` y `access_until`; se añadió un preflight de columnas NOT NULL sin default. El intento intermedio sin resultado por `requestState` se conserva como diagnóstico histórico. El coordinador comprobó después la ausencia de los namespaces de prueba. Los reintentos no aumentan el recuento de dos casos; ante cualquier futura respuesta perdida se debe releer el estado efectivo antes de repetir.

Sólo el coordinador puede ejecutar el borrador tras verificar staging, fijar ambos `SET LOCAL` indicados después de `BEGIN` en la misma transacción y conservar el `ROLLBACK` final. No hay ejecutor SQL ni opción live en estos scripts; tampoco un job privilegiado desde PRs o un destino productivo por defecto.

## Evidencia reutilizada y límite funcional

No se repiten las cuatro coberturas anteriores: propietarios poblados, reviewer elegible, REST privado frente a RPC poblado y revocación con el mismo JWT. Las pruebas previas de transporte, adapter, bridge, estructuras, concurrencia, rollback y navegador staging conservan su alcance histórico; no se cuentan como nuevas ejecuciones de estos archivos.

El hotfix mantiene cerrado el acceso privado. La incompatibilidad posterior del listado histórico quedó corregida en producción y la UI real de cola/detalle se comprobó antes de caducar el scope del reviewer. El contraste directo de REST privado con JWT productivo normal no se ejecutó; el scope caducado no se ha ampliado para fabricar un positivo. Los PASS offline de esta carpeta y las negativas anónimas no sustituyen ese control pendiente. El acceso del propietario fue verificado por el coordinador por separado; estos scripts no convierten SQL claims ni dobles de prueba en evidencia JWT.
