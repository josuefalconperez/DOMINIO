DOMINIO v4 — BASE LIMPIA

Esta versión está preparada para una prueba desde cero.

IMPORTANTE:
- No incluye Service Worker.
- No registra ningún Service Worker.
- No contiene datos personales precargados.
- Los datos de prueba se guardan únicamente en el almacenamiento local del navegador.
- Incluye manifest para PWA.
- Incluye la imagen fondo.jpg seleccionada para DOMINIO.

ARCHIVOS:
- index.html
- styles.css
- app.js
- manifest.webmanifest
- icon.svg
- fondo.jpg

PRUEBA:
1. Sube TODOS estos archivos a la raíz del nuevo repositorio de GitHub.
2. Activa GitHub Pages desde Settings > Pages > Deploy from a branch > main > /(root).
3. Abre la URL de GitHub Pages.
4. Comprueba primero:
   - navegación inferior
   - + Ingreso
   - + Gasto
   - + Previsión
   - + Activo
   - + Deuda
   - Cuentas
5. No hay Service Worker en esta versión para evitar interferencias de caché.

OBJETIVO DE ESTA FASE:
Confirmar que la interfaz y el JavaScript responden correctamente antes de incorporar el modo offline/PWA completo.
