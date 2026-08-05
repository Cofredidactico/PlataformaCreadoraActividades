import { chromium } from 'playwright';

// Ruta al Chromium: usa CHROME_BIN si esta seteada; si no, el que trae Playwright
// (instalalo con `npx playwright install chromium`). BASE apunta al preview local.
const EXE = process.env.CHROME_BIN || undefined;
const BASE = process.env.BASE_URL || 'http://localhost:4599/';

// Genera un PNG (dataURL) con una silueta simple (estrella) para probar
// los modulos que requieren imagen.
function makeStarDataUrl() {
  // Se ejecuta en el navegador via page.evaluate.
  const c = document.createElement('canvas');
  c.width = 400; c.height = 400;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 400, 400);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  const cx = 200, cy = 200, spikes = 5, outer = 160, inner = 70;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  return c.toDataURL('image/png');
}

const results = [];
function log(name, ok, extra = '') { results.push({ name, ok, extra }); console.log(`${ok ? '✅' : '❌'} ${name} ${extra}`); }

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  // ignorar ruido de red externa (fuentes/favicon) que no afecta a la app
  if (/Failed to load resource|ERR_CONNECTION|fonts\.g/i.test(t)) return;
  errors.push(t);
});

await page.goto(BASE, { waitUntil: 'networkidle' });

// Galeria
const cards = await page.locator('.card').count();
log('Galería muestra los módulos', cards >= 4, `(${cards} tarjetas)`);

// --- Sopa de Letras (sin imagen) ---
await page.locator('.card', { hasText: 'Sopa de Letras' }).click();
await page.getByRole('button', { name: /Generar actividad/ }).click();
await page.waitForSelector('.validation', { timeout: 10000 });
let svgOk = await page.locator('.editor-canvas svg, .preview-wrap svg').count();
let checksBad = await page.locator('.check.bad').count();
log('Sopa de Letras genera y valida', svgOk > 0 && checksBad === 0, `(svg:${svgOk}, fallos:${checksBad})`);
let pngEnabled = await page.getByRole('button', { name: 'PNG 300dpi' }).isEnabled();
log('Sopa de Letras habilita exportación', pngEnabled);

// volver
await page.getByRole('button', { name: /Todos los módulos/ }).click();

// --- Memotest (sin imagen) ---
await page.locator('.card', { hasText: 'Memotest' }).click();
await page.getByRole('button', { name: /Generar actividad/ }).click();
await page.waitForSelector('.validation', { timeout: 10000 });
checksBad = await page.locator('.check.bad').count();
svgOk = await page.locator('.editor-canvas svg, .preview-wrap svg').count();
log('Memotest genera y valida', svgOk > 0 && checksBad === 0, `(fallos:${checksBad})`);
await page.getByRole('button', { name: /Todos los módulos/ }).click();

// --- Unir Puntos (con imagen) ---
await page.locator('.card', { hasText: 'Unir Puntos' }).click();
const dataUrl = await page.evaluate(makeStarDataUrl);
// convertir dataURL a File y setear en el input
const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
await page.locator('input[type=file]').setInputFiles({ name: 'star.png', mimeType: 'image/png', buffer });
await page.waitForSelector('.thumb img', { timeout: 5000 });
await page.getByRole('button', { name: /Generar actividad/ }).click();
await page.waitForSelector('.validation', { timeout: 15000 });
checksBad = await page.locator('.check.bad').count();
const dots = await page.locator('.dot-handle').count();
log('Unir Puntos detecta contorno y distribuye puntos', dots >= 10 && checksBad === 0, `(puntos:${dots}, fallos:${checksBad})`);
pngEnabled = await page.getByRole('button', { name: 'PNG 300dpi' }).isEnabled();
log('Unir Puntos: sin cruces y export habilitado', pngEnabled);

// probar editor: cambiar a modo agregar y click
await page.getByRole('button', { name: /Agregar/ }).click();
await page.locator('.editor-canvas svg').click({ position: { x: 30, y: 30 } });
const dots2 = await page.locator('.dot-handle').count();
log('Editor: agregar punto funciona', dots2 === dots + 1, `(${dots} -> ${dots2})`);

// deshacer: el punto agregado se revierte con Ctrl+Z
await page.keyboard.press('Control+z');
await page.waitForFunction((n) => document.querySelectorAll('.dot-handle').length === n, dots, { timeout: 3000 }).catch(() => {});
const dots3 = await page.locator('.dot-handle').count();
log('Deshacer (Ctrl+Z) revierte el cambio', dots3 === dots, `(${dots2} -> ${dots3})`);

await page.getByRole('button', { name: /Todos los módulos/ }).click();

// --- Rompecabezas (con imagen) ---
await page.locator('.card', { hasText: 'Rompecabezas' }).click();
await page.locator('input[type=file]').setInputFiles({ name: 'star.png', mimeType: 'image/png', buffer });
await page.waitForSelector('.thumb img', { timeout: 5000 });
await page.getByRole('button', { name: /Generar actividad/ }).click();
await page.waitForSelector('.validation', { timeout: 10000 });
checksBad = await page.locator('.check.bad').count();
const hasImg = await page.locator('.editor-canvas image, .editor-canvas svg').count();
log('Rompecabezas genera piezas', checksBad === 0 && hasImg > 0, `(fallos:${checksBad})`);
await page.getByRole('button', { name: /Todos los módulos/ }).click();

// --- Sombras (con imagen) ---
await page.locator('.card', { hasText: 'Sombras' }).click();
await page.locator('input[type=file]').setInputFiles({ name: 'star.png', mimeType: 'image/png', buffer });
await page.waitForSelector('.thumb img', { timeout: 5000 });
await page.getByRole('button', { name: /Generar actividad/ }).click();
await page.waitForSelector('.validation', { timeout: 15000 });
checksBad = await page.locator('.check.bad').count();
log('Sombras: una sola correcta + distractores', checksBad === 0, `(fallos:${checksBad})`);
await page.getByRole('button', { name: /Todos los módulos/ }).click();

// --- Colorear por Números (con imagen) ---
await page.locator('.card', { hasText: 'Colorear por Números' }).click();
await page.locator('input[type=file]').setInputFiles({ name: 'star.png', mimeType: 'image/png', buffer });
await page.waitForSelector('.thumb img', { timeout: 5000 });
await page.getByRole('button', { name: /Generar actividad/ }).click();
await page.waitForSelector('.validation', { timeout: 20000 });
checksBad = await page.locator('.check.bad').count();
const cbnImg = await page.locator('.editor-canvas image').count();
log('Colorear por Números genera line-art + leyenda', checksBad === 0 && cbnImg > 0, `(fallos:${checksBad})`);
await page.getByRole('button', { name: /Todos los módulos/ }).click();

// --- Laberintos (sin imagen, solucion unica) ---
await page.locator('.card', { hasText: 'Laberintos' }).click();
await page.getByRole('button', { name: /Generar actividad/ }).click();
await page.waitForSelector('.validation', { timeout: 10000 });
checksBad = await page.locator('.check.bad').count();
const uniqueTxt = await page.locator('.check', { hasText: 'única' }).textContent();
log('Laberintos: solución única garantizada', checksBad === 0 && /árbol|un solo camino/i.test(uniqueTxt || ''), `(fallos:${checksBad})`);
await page.getByRole('button', { name: /Todos los módulos/ }).click();

// --- Trazos (con imagen de ejemplo) ---
await page.locator('.card', { hasText: 'Trazos' }).click();
await page.locator('.sample', { hasText: 'Estrella' }).click();
await page.waitForSelector('.thumb img', { timeout: 5000 });
await page.getByRole('button', { name: /Generar actividad/ }).click();
await page.waitForSelector('.validation', { timeout: 15000 });
checksBad = await page.locator('.check.bad').count();
svgOk = await page.locator('.editor-canvas svg, .preview-wrap svg').count();
log('Trazos genera figura punteada desde ejemplo', checksBad === 0 && svgOk > 0, `(fallos:${checksBad})`);

// activar marco de cuadernillo y verificar vista "Hoja"
await page.locator('#ws').check();
await page.waitForFunction(() => !!document.querySelector('.preview-wrap.sheet'), null, { timeout: 3000 }).catch(() => {});
const sheetShown = await page.locator('.preview-wrap.sheet svg').count();
const pngWithSheet = await page.getByRole('button', { name: 'PNG 300dpi' }).isEnabled();
log('Marco de cuadernillo se aplica y exporta', sheetShown > 0 && pngWithSheet, `(hoja:${sheetShown})`);

// guardar proyecto y verificar que aparece en la galeria
await page.getByRole('button', { name: /Guardar proyecto/ }).click();
await page.getByRole('button', { name: /Todos los módulos/ }).click();
const recent = await page.locator('.recent-card').count();
log('Guardar/abrir proyectos funciona', recent >= 1, `(proyectos:${recent})`);

// tema oscuro
await page.locator('.icon-btn').first().click();
const themeDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
log('Modo oscuro conmuta', themeDark === 'dark');

log('Sin errores de consola/página', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas OK`);
process.exit(failed.length ? 1 : 0);
