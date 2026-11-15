# CARTAS 11-12 · actualización

## Qué cambió

1. **Regalo centrado.** Al tocar el regalo, la cámara se coloca sola justo **enfrente** (centrada), sin importar desde qué lado estuviera girando. Se queda así mientras aparece **"TE AMO MI BEBÉ"** y, cuando ya se leyó, el regalo empieza a girar **despacio hacia la izquierda o la derecha (al azar en cada apertura)**. El rótulo siempre queda de frente al espectador.
2. **Panel admin (Ctrl + clic, o 3 toques al botón de música).** Al pulsar **Ver carta** salen 2 opciones:
   - **✉ Ver carta**: abre la carta del día elegido, como antes.
   - **▶ Ver desde la animación del calendario y luego la carta**: reproduce la animación del calendario hasta la fecha elegida y después abre la carta (la simulación). Se puede repetir y "Saltar" funciona.
   El historial de después del 12/12 (el que ve ella) no cambia: abre la carta directo.
3. **Banner de GitHub (`.github/workflows/portada.yml`)**: versión reforzada (ver abajo).
4. `index.html`: `og:image` y `twitter:image` ahora dicen `portada.png` (la que corresponde del 12/11 al 11/12).
5. Nuevas `portada.jpg`, `portada11-11.jpg`, `portada12.jpg` (~100 KB, sin pérdida visible; las PNG pesaban ~770 KB y WhatsApp suele ignorar imágenes de más de ~300 KB).

No hay que tocar Apps Script ni volver a desplegarlo.

## Cómo desplegar (GitHub Pages)

Repositorio: `sitiosv/11-11`.

1. Descomprime el zip.
2. En el repositorio sube y reemplaza en la raíz: `index.html`, `portada.jpg`, `portada11-11.jpg`, `portada12.jpg`.
3. **Importante, el workflow no estaba en el repositorio** (la carpeta `.github` no existía en GitHub). Súbelo así: *Add file → Create new file*, escribe el nombre `.github/workflows/portada.yml` (las barras crean las carpetas) y pega el contenido del archivo. Hacer commit lo ejecuta una vez solo y deja la portada de hoy.
4. En la pestaña **Actions**: abre **Portada automática**; debe aparecer una ejecución en verde. Si Actions estuviera desactivado, actívalo. Puedes relanzarlo con **Run workflow**.
5. Revisa que `index.html` publicado ya diga `portada.jpg` (o `portada.png`) en `og:image`.

## Cómo probar

- Simulación: abre el panel, elige una fecha, **Ver carta → ▶ Ver desde la animación…**
- Otro día completo (regalo incluido): agrega `?dia=2026-11-20` a la dirección.
- Vista previa del enlace: https://developers.facebook.com/tools/debug/ (botón "Scrape Again"). WhatsApp y otras apps guardan en caché la vista previa de enlaces ya compartidos, así que el cambio se nota sobre todo en enlaces nuevos.

## Sobre el banner

- Cambia a las 00:10 hora de El Salvador (12/11 y 12/12 incluidos) y también cuando subes `index.html` o las portadas.
- Un commit hecho por el bot a veces no reconstruye GitHub Pages solo; por eso el workflow pide la reconstrucción explícitamente. No pude probar ese paso desde fuera de GitHub: si tras una ejecución el sitio no cambia, revisa en Settings → Pages.
