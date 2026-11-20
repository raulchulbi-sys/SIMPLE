# Reinicio de ciclo

La barra cuenta los días reconocidos de cada rutina por separado. Tras cuatro días completos sin entrenar esa rutina, el progreso parcial vuelve a cero. Si la última sesión fue el lunes, entrenar el viernes continúa el ciclo y entrenar el sábado abre uno nuevo con 1/5 en una rutina de cinco días. Se usan fechas de Madrid. Completar todos los días mantiene la barra llena durante esa fecha.

«Reiniciar ciclo» registra un corte para la cuenta y la rutina elegidas. La siguiente sesión cuenta aunque se guarde el mismo día del reinicio. Se conservan los entrenamientos anteriores, las notas y las etapas de estadísticas. Cada confirmación tiene un identificador para que repetir la petición tras una interrupción conserve el corte original.

## Cambios de base de datos

Aplicar primero `apply.sql` y después `manual.sql`. El primero recoge la revisión intermedia de tres días. El segundo establece el umbral de cuatro y crea el registro privado de reinicios y su función de escritura. Las tres funciones de progreso verifican sus definiciones de partida y destino. El propietario de la rutina o su atleta con asignación activa pueden reiniciar exclusivamente su propio ciclo.

Para revertir, retirar la interfaz y ejecutar `rollback-manual.sql`. La reversión conserva los cortes para una reinstalación y devuelve las lecturas al umbral intermedio. Ejecutar también `rollback.sql` para recuperar las lecturas originales.

## Regresión local

Ejecutar `node tests/cycle-inactivity/test.mjs` con PGlite disponible, o pasar como primer argumento la ruta absoluta al módulo instalado. Se reproducen el fallo original, los límites de fechas, las tres rutas de lectura, los reinicios en el mismo día, los permisos y la reversión en una base sintética en memoria.
