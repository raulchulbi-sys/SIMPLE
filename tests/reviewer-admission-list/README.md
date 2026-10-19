# Estado de promoción — 19 de octubre de 2026

Corrección mínima validada y aplicada al backend con autorización expresa. No cambia consumidores frontend ni amplía permisos. La validación poblada de staging cubre los doce grupos del encargo, ocho recorridos de navegador y tres cruces con bloqueo observado. Las reejecuciones y la evidencia histórica se mantienen separadas. Rollback transaccional de contención comprobado.

La comprobación productiva de cola y detalle ya funciona; el contraste REST con JWT productivo normal sigue pendiente de login manual en el harness autorizado. No confundir los ensayos SQL de abajo con esa comprobación real. Las evidencias detalladas, datos sintéticos y resultados operativos se conservan fuera de los archivos publicados.

## Registro histórico del candidato inicial

El apartado siguiente describe el estado anterior a la autorización y a la promoción; sus indicaciones de no publicación son históricas. No constituyen el estado operativo actual.

# Candidato separado: admisión histórica en el listado de reviewer

NO PUBLICADO. No autoriza SQL productivo, push, merge ni cambios de registros o admisión. El hotfix de privacidad publicado permanece protegido.

El diagnóstico productivo de lectura del coordinador encontró cuatro recomendaciones en un scope elegible: una MODIFY accepted devuelve su proyección válida; una MODIFY rejected emite premium_chat_stale_checkin, ya omitido; dos KEEP antiguas, superseded y accepted, emiten SQLSTATE42501 premium_admission_stale_or_revoked. Ese error no incluido aborta el detalle completo. Accepted por sí solo no explica el fallo. La evidencia productiva es la informada por el coordinador, no una prueba JWT realizada por este autor.

La cadena de fuente es premium_reviewer_state → premium_recommendation_view → premium_weekly_assert → premium_assert_admission. El assert compara el admission_guard guardado con la admisión vigente incluso con require_current=false. El candidato añade únicamente premium_admission_stale_or_revoked al catch por recomendación de SQLSTATE42501. No cambia guards, asignación, elegibilidad, ACL, policies ni filas. Las recomendaciones inaccesibles se omiten; no hay fallback REST.

candidate.sql y rollback.sql son fuentes de revisión. Exigen gate explícito y MD5 candidato fijado desde el recibo aislado. El candidato exige API anterior fb4f1a322b8666a883184cfd04f1f017 y helper fc89c86e5a6fb56069bfbf777d9dd3e1; verifica owners, grants, search_path y las cuatro policies antes y después. No ejecutarlos con la autorización actual: los bugs nuevos se mantienen separados sin publicar.

El rollback vuelve sólo a la API anterior protegida. Conserva las cuatro policies y permisos; no recrea las dos policies vulnerables ni modifica recomendaciones/admission_guard. Su MD5 esperado es el candidato del recibo aislado, nunca un hash recién obtenido de la función a revertir.

tests/isolated.sql declara dos casos nuevos con cuatro filas sintéticas pobladas. El primero reproduce la denegación anterior y contrasta exactamente la proyección válida del candidato sin marcadores privados. El segundo conserva la denegación del scope y propaga otro error42501 no incluido. Sólo clona metadatos en un esquema verificado ausente, con guards de prueba explícitos, sin APIs de negocio ni DML compartido; termina con ROLLBACK. El ejecutor verifica staging dmqjexigdnfzobarhnib y fija ambos gates después de BEGIN en la misma transacción. No es prueba JWT, de admisión real ni funcional productiva.

El recibo normaliza exclusivamente namespace/actor de los clones y exige que la definición anterior normalizada reproduzca el MD5 conocido antes de emitir el MD5 candidato. Hasta ejecución del coordinador, los casos están preparados, no PASS. No se repiten suites históricas ni se cuentan inspecciones de fuente como casos.

Gates del ensayo, después de BEGIN: simple.reviewer_admission_list_project='dmqjexigdnfzobarhnib' y simple.reviewer_admission_list_reviewed='historical-admission-list-isolated-v1'.
Gates de una futura instalación revisada: simple.reviewer_admission_list_reviewed='historical-admission-list-v1' y simple.reviewer_admission_list_target_md5='<MD5 candidato del recibo>'.
Gates de su rollback contenido: simple.reviewer_admission_list_reviewed='historical-admission-list-rollback-v1' y el mismo target_md5 independiente.

## Resultado del coordinador

Dos casos SQL aislados ejecutados en SIMPLE Security Test:2/2PASS,conCHECKsrealesyROLLBACKfinal. Ninguna modificación de funciones públicas,datoscompartidos,Auth o presupuestos. No es prueba JWT/consentimiento real. APIoriginalnormalizadaMD5fb4f1a322b8666a883184cfd04f1f017; candidata6442b03ced86d22c57dbf434898c6a9a; helperfc89c86e5a6fb56069bfbf777d9dd3e1.
El coordinador conserva el fallo UIproductivo en el informe privado. Esta corrección permanece SINAPLICAR/SINPUBLICAR; requiere autorización posterior. No alterar guards/registros históricos para simular éxito.
