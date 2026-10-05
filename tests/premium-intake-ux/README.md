# Ajuste acotado del cuestionario Premium

Base: `660dcb12b3db99139dfd763df3c796f0b41e0b90`. Rama aislada
`codex/premium-intake-ux`. Sin publicación ni cambios en Supabase/OpenAI.

## Cambios

- Casilla «Tengo todo el equipamiento» en el inventario Premium: selecciona
  los 37 IDs del catálogo que aparece en esa pantalla, sin duplicarlos.
- Las excepciones individuales sincronizan el estado parcial de la casilla.
  Desmarcarla limpia únicamente el inventario del catálogo. No cambia equipo
  personalizado, exclusiones ni otras respuestas; no añade campos al contrato.
- El cuestionario Premium usa el desplazamiento nativo del diálogo, sin otro
  scroll dentro de los inventarios/exclusiones. Barra de 14 px en motores con
  soporte, contraste según tema y espacio reservado para evitar saltos.
  Se conserva el desplazamiento táctil vertical y el zoom por pellizco.
- Los cambios se limitan a Premium. Basic conserva sus controles y estilos.

## Validación local

`tests/premium-intake-ux/ui.cjs`: **62/62** comprobaciones en Chromium (Edge)
y WebKit. Selección completa, búsqueda, excepciones, vaciado, conservación de
equipo adicional y exclusiones, atrás/adelante, revisión válida, teclado/foco,
ausencia de cambios en Basic. Matriz 320/360/390/430/1280 px, Claro/Oscuro:
sin desbordamiento horizontal, objetivos táctiles >=44 px y navegación
alcanzable con rueda sin quedar atrapada en otra zona de scroll.

`tests/coach-intake-v2/unit.cjs`: **50/50**, contrato de cuestionarios existente.
Los resultados repetidos durante los ajustes no se suman al total final.

Pruebas exclusivamente locales: la suite bloquea peticiones fuera de loopback.
No prueba un dispositivo iPhone físico. Las barras nativas pueden ocultarse
automáticamente según el navegador/sistema, especialmente con entrada táctil.
Las capturas y resultados se guardan en `results/`, ignorado por Git.

Preview sin Supabase ni OpenAI:

```powershell
$env:PREMIUM_PORT='4234'
node tests/premium-phase1/preview.cjs
```

Abrir `http://127.0.0.1:4234/review` y pulsar «Abrir Premium».
La preview anterior se mantiene intacta. Su borrador guardado se conserva en
memoria en el nuevo servidor local, sin incorporarlo a archivos ni a Git.
