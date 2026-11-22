# Privacidad y preparación comercial — 16/10/2026

Estado: revisión técnica/documental; NO es una declaración de cumplimiento jurídico. Sin servicios nuevos, analítica, publicidad, pagos ni llamadas IA. Cloudflare Access se descarta para esta misión. El hosting estático público se protege mediante Auth, JWT, permisos y RLS del backend; no mediante la ocultación del JavaScript.

## Flujo observado y proveedores

| Proveedor | Qué recibe en esta arquitectura | Límites de la evidencia |
|---|---|---|
| Cloudflare Pages | Archivos públicos, solicitudes HTTPS, IP, agente, rutas y posibles queries; metadatos Git/build/deploy | No proxy de API ni Pages Functions. Los datos privados viajan directamente a Supabase. Esto no impide que un código de callback presente en query alcance logs del hosting. Retención/configuración efectiva de logs no inspeccionada. |
| Supabase | Auth/identidades, JWT, perfiles, rutinas, asignaciones, workouts, notas y datos Coach/Premium; peticiones REST/RPC/Edge | Ambos proyectos están en eu-west-3 según metadatos actuales; esto no prueba localización europea de todo procesamiento o soporte. No se inspeccionaron secrets ni configuración SMTP. |
| OpenAI | Sólo los contextos y mensajes que envían las Edge Functions autorizadas existentes | Clave sólo servidor; cero llamadas en esta misión. La documentación API indica ausencia de entrenamiento por defecto salvo opt-in y logs de abuso de hasta 30 días por defecto, con excepciones. store:false no equivale a Zero Data Retention. No se verificó el régimen contractual/retención de esta cuenta. |
| GitHub | Repositorio, integración de build; actualmente además solicitudes a GitHub Pages | El repo y el output web son superficies distintas. Tests/documentación públicos del repo no se empaquetan en dist. Los informes privados y credenciales se excluyen de ambos. |
| Stripe futuro | Ningún dato de pagos de SIMPLE actualmente | No integración, alta, cobro o tracking nuevos. El checkout descartado de Cloudflare no es una integración de Stripe en SIMPLE. |
| jsDelivr y Tenor existentes | IP, solicitud y referrer limitado por política al cargar SDK/imagen ya existentes | SDK Supabase fijado a 2.115.0 e imagen de celebración externa preexistentes. No se añadieron proveedores ni se cambió producto para esta misión. |

Fuentes primarias consultadas: [Cloudflare Privacy](https://www.cloudflare.com/privacypolicy/), [Supabase Privacy](https://supabase.com/privacy), [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data), [GitHub Privacy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). No inferir contratos de encargado aceptados, transferencias resueltas o retención contratada sólo de estas políticas públicas.

## Cookies, sesiones, logs y exposición

- Supabase SDK conserva la sesión en almacenamiento del origen y renueva tokens. Un origen Cloudflare nuevo requiere login; nunca se trasladan tokens desde GitHub. No se guardan storageState, HAR, tokens ni capturas de sesiones en esta misión.
- El cliente limpia código/hash de callback tras procesarlo; recovery conserva sólo ?reset=1 cuando procede. Un fragmento no se envía en la petición HTTP, pero una query puede llegar al hosting antes de esa limpieza. No afirmar que todas las URLs de callback están libres de datos sensibles en todos los logs.
- Referrer-Policy es strict-origin-when-cross-origin. La CSP del frontend es report-only y no constituye una barrera de bloqueo; no hay un recolector report-to nuevo. La del placeholder sí bloquea scripts/conexiones.
- Persisten drafts/datos locales y gestión de sesión de la aplicación existente. En dispositivos compartidos esto requiere política de uso y conservación; no se rediseña ni se borra información del usuario para la migración.
- Hay console.error preexistentes que pueden incluir detalles de una respuesta. No se añadió telemetría remota ni se acredita sanitización universal de todos los errores. Antes de compartir diagnósticos, redactar queries, correos, tokens, conversaciones y datos deportivos.
- Chat y texto libre pueden recibir información de salud no solicitada. No pedirla, minimizar proyecciones, definir conservación y proceso de atención/incidentes. No se envió texto a IA durante esta fase.
- Hallazgo preexistente de minimización: el HTML contiene identificadores UUID pseudónimos de compatibilidad histórica ya publicados. No son credenciales ni otorgan acceso sin RLS; tampoco permiten afirmar que el artefacto carece absolutamente de identificadores personales. Se conservan por el requisito expreso de no cambiar aliases/lógica. Su retirada a una configuración privada requeriría otro alcance y regresiones, no una sustitución silenciosa.
- No se hallaron nuevas claves secretas, credenciales OAuth, service role, sesiones, backups, SQL o informes en el output permitido. El scanner no demuestra ausencia matemática de cualquier dato sensible: complementarlo con revisión de cada archivo y minimización.

## Checklist jurídico pendiente de titular y revisión profesional

| Área | Decisión/evidencia pendiente |
|---|---|
| Responsable | Identidad y contacto reales; no se inventó NIF, domicilio o identidad fiscal. |
| Información | Aviso de privacidad completo, finalidades, destinatarios y transferencias; los enlaces terms/privacy del frontend siguen sin configurar. |
| Bases jurídicas | Determinar por finalidad y datos, incluida información de salud aportada accidentalmente. No asumir consentimiento genérico para todo. |
| Conservación | Plazos para perfiles, entrenamiento, Chat, check-ins, revisión, logs, backups y solicitudes de derechos. |
| Derechos | Canal y procedimiento de acceso, rectificación, supresión, portabilidad, oposición y limitación, verificando identidad de forma proporcionada. |
| Encargados | Inventario, DPA/contratos, subencargados, transferencias y garantías efectivas por proveedor. |
| Seguridad/incidentes | Registro, evaluación y respuesta a incidentes, responsables y notificación cuando proceda. |
| Servicio | Condiciones de uso y límites de Coach; revisión profesional del piloto/comercialización. |
| Suscripción futura | Precio, renovación, cancelación, desistimiento/reembolsos y soporte antes de cobrar; Stripe sigue fuera de esta fase. |

Referencias de orientación: [AEPD responsable/encargado](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/8-responsable-y-encargado-del-tratamiento/FAQ-0251-como-se-si-soy-responsable-o-encargado), [contrato de encargo](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/8-responsable-y-encargado-del-tratamiento/FAQ-0238-cual-seria-el-contenido-del-contrato-de-encargo-de-tratamiento), [registro de actividades](https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/actividades-tratamiento). Son referencias, no asesoramiento ni validación legal de SIMPLE.

## Capacidad y costes

Pages y Zero Trust son productos distintos. Las 50 plazas de Zero Trust Free NO son el límite comercial de atletas de SIMPLE. Pages sirve contenido estático público y el acceso a datos depende del backend.

Documentación Pages Free consultada el16/10: 500 builds/mes, un build concurrente, timeout20min, 20.000 archivos y 25MiB por archivo; el paquete de36 archivos queda dentro. Estos límites de build/tamaño no son un número garantizado de usuarios concurrentes ni un SLA. No se activa Workers/Functions ni se contrata un plan. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

La organización Supabase observada es Free. La página de precios describe 50.000 MAU, base500MB, almacenamiento1GB, egress5GB más5GB cached y500.000 invocaciones Edge; dos proyectos activos y pausa por inactividad de una semana. MAU no equivale a capacidad concurrente o disponibilidad, y llamadas/egress/tamaño/IA pueden ser el cuello de botella antes. Revisar métricas reales y coste antes de ampliar piloto. No se cambió plan, presupuesto o cuota. [Supabase pricing](https://supabase.com/pricing).

Un subdominio pages.dev se genera automáticamente y puede servir provisionalmente como entrada principal HTTPS: no se ha encontrado un requisito técnico de comprar un dominio para este flujo con callback Supabase. El dominio propio mejoraría marca/control, pero no es un bloqueo impuesto por la arquitectura; cualquier cambio futuro exige orígenes/redirects y revisión de consentimiento por separado. [Pages domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [pages.dev](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/).
