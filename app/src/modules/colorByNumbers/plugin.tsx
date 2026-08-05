import type {
  ActivityPlugin,
  EditorProps,
  GenerateContext,
  GeneratedActivity,
  ValidationResult,
} from '../../core/types';
import { svgDocument, round } from '../../core/svg';

// ============================================================================
// Modulo "Colorear por Números". Cuantiza los colores de la imagen (k-means),
// dibuja el line-art de los bordes entre zonas, numera las zonas y arma la
// leyenda de colores. Opcion de mostrar la version coloreada (solucion).
// ============================================================================

export interface ColorByNumbersData {
  lineArt: string;   // dataURL del contorno
  colored: string;   // dataURL de la version coloreada (solucion)
  artW: number;
  artH: number;
  numbers: { x: number; y: number; n: number }[];
  palette: { color: string; n: number }[];
  showColors: boolean;
}

interface RGB { r: number; g: number; b: number; }

function kmeans(pixels: RGB[], k: number, iters = 8): { centroids: RGB[]; assign: (p: RGB) => number } {
  // init: muestreo espaciado
  const centroids: RGB[] = [];
  for (let i = 0; i < k; i++) centroids.push({ ...pixels[Math.floor((i + 0.5) / k * pixels.length)] });
  const labels = new Int32Array(pixels.length);
  const dist = (a: RGB, b: RGB) => (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < pixels.length; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) { const d = dist(pixels[i], centroids[c]); if (d < bd) { bd = d; best = c; } }
      labels[i] = best;
    }
    const sum = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (let i = 0; i < pixels.length; i++) { const s = sum[labels[i]]; s.r += pixels[i].r; s.g += pixels[i].g; s.b += pixels[i].b; s.n++; }
    for (let c = 0; c < k; c++) if (sum[c].n) centroids[c] = { r: sum[c].r / sum[c].n, g: sum[c].g / sum[c].n, b: sum[c].b / sum[c].n };
  }
  const assign = (p: RGB) => { let best = 0, bd = Infinity; for (let c = 0; c < k; c++) { const d = dist(p, centroids[c]); if (d < bd) { bd = d; best = c; } } return best; };
  return { centroids, assign };
}

function toHex(c: RGB): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function renderCBN(d: ColorByNumbersData): { svg: string; W: number; H: number } {
  const pad = 50;
  const legendH = 120;
  const artDisplayW = 900;
  const artDisplayH = Math.round(artDisplayW * (d.artH / d.artW));
  const W = artDisplayW + pad * 2;
  const H = pad + 60 + artDisplayH + 30 + legendH + pad;
  const sx = artDisplayW / d.artW, sy = artDisplayH / d.artH;
  const ax = pad, ay = pad + 60;

  let c = '';
  c += `<text x="${W / 2}" y="${pad + 20}" font-family="'Baloo 2',system-ui,sans-serif" font-size="38" font-weight="800" fill="#1B3A6B" text-anchor="middle">Coloreá por números</text>`;
  c += `<image href="${d.showColors ? d.colored : d.lineArt}" x="${ax}" y="${ay}" width="${artDisplayW}" height="${artDisplayH}"/>`;
  c += `<rect x="${ax}" y="${ay}" width="${artDisplayW}" height="${artDisplayH}" fill="none" stroke="#1B3A6B" stroke-width="2" rx="8"/>`;

  if (!d.showColors) {
    for (const num of d.numbers) {
      const x = ax + num.x * sx, y = ay + num.y * sy;
      c += `<circle cx="${round(x)}" cy="${round(y)}" r="16" fill="#ffffff" fill-opacity="0.75"/>`;
      c += `<text x="${round(x)}" y="${round(y + 7)}" font-family="'Baloo 2',system-ui,sans-serif" font-size="22" font-weight="700" fill="#2b2b3a" text-anchor="middle">${num.n}</text>`;
    }
  }

  // leyenda
  const ly = ay + artDisplayH + 40;
  c += `<text x="${ax}" y="${ly}" font-family="'Baloo 2',system-ui,sans-serif" font-size="28" font-weight="800" fill="#E1306C">Leyenda:</text>`;
  const perRow = Math.min(d.palette.length, 6);
  const cellW = artDisplayW / perRow;
  d.palette.forEach((p, i) => {
    const col = i % perRow, row = Math.floor(i / perRow);
    const x = ax + col * cellW, y = ly + 24 + row * 56;
    c += `<rect x="${x}" y="${y}" width="46" height="46" rx="8" fill="${p.color}" stroke="#1B3A6B" stroke-width="2"/>`;
    c += `<text x="${x + 58}" y="${y + 32}" font-family="'Baloo 2',system-ui,sans-serif" font-size="26" font-weight="700" fill="#2b2b3a">= ${p.n}</text>`;
  });

  return { svg: svgDocument(W, H, c), W, H };
}

function validate(d: ColorByNumbersData): ValidationResult {
  const checks = [
    { label: 'Zonas detectadas y numeradas', ok: d.numbers.length >= 2, detail: `${d.numbers.length} zonas` },
    { label: 'Leyenda de colores completa', ok: d.palette.length >= 2, detail: `${d.palette.length} colores` },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}

function build(d: ColorByNumbersData): GeneratedActivity<ColorByNumbersData> {
  const { svg, W, H } = renderCBN(d);
  return { svg, width: W, height: H, data: d, validation: validate(d), supportsTransparent: false };
}

function CBNEditor({ activity, onChange }: EditorProps<ColorByNumbersData>) {
  const d = activity.data;
  const patch = (p: Partial<ColorByNumbersData>) => onChange(build({ ...d, ...p }));
  return (
    <div className="editor">
      <div className="editor-toolbar">
        <label className="mini-toggle"><input type="checkbox" checked={d.showColors} onChange={(e) => patch({ showColors: e.target.checked })} /> Ver coloreado (solución)</label>
      </div>
      <div className="editor-canvas" dangerouslySetInnerHTML={{ __html: activity.svg }} />
      <p className="editor-hint">Pintá cada zona con el color que indica su número.</p>
    </div>
  );
}

export const colorByNumbersPlugin: ActivityPlugin<ColorByNumbersData> = {
  id: 'color-numbers',
  name: 'Colorear por Números',
  tagline: 'Convierte una imagen en zonas numeradas con leyenda de colores.',
  icon: '🎨',
  accent: '#A29BFE',
  ageRange: '5 a 10 años',
  requiresImage: true,
  status: 'ready',
  configFields: [
    { type: 'select', key: 'colors', label: 'Cantidad de colores', default: '8', options: ['4', '6', '8', '10', '12'].map((v) => ({ value: v, label: v })) },
    { type: 'toggle', key: 'showColors', label: 'Mostrar coloreado al generar', default: false },
  ],
  async generate(ctx: GenerateContext) {
    const { image, config, onProgress } = ctx;
    if (!image) throw new Error('Este modulo necesita una imagen.');
    const k = Number(config.colors ?? 8);

    onProgress?.(0.15, 'Preparando imagen...');
    const maxDim = 480;
    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    const w = Math.max(1, Math.round(image.width * scale));
    const h = Math.max(1, Math.round(image.height * scale));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true })!;
    cx.drawImage(image.element, 0, 0, w, h);
    const img = cx.getImageData(0, 0, w, h);
    const px = img.data;

    const pixels: RGB[] = new Array(w * h);
    for (let i = 0, p = 0; p < w * h; p++, i += 4) pixels[p] = { r: px[i], g: px[i + 1], b: px[i + 2] };

    onProgress?.(0.4, 'Agrupando colores...');
    const { centroids, assign } = kmeans(pixels, k);
    const labels = new Int32Array(w * h);
    for (let p = 0; p < w * h; p++) labels[p] = assign(pixels[p]);

    onProgress?.(0.65, 'Dibujando contornos...');
    // line-art
    const artScale = 2; // mejor resolucion para impresion
    const aw = w * artScale, ah = h * artScale;
    const lineCv = document.createElement('canvas'); lineCv.width = aw; lineCv.height = ah;
    const lctx = lineCv.getContext('2d')!;
    lctx.fillStyle = '#fff'; lctx.fillRect(0, 0, aw, ah);
    lctx.fillStyle = '#333';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = labels[y * w + x];
        const right = x < w - 1 ? labels[y * w + x + 1] : l;
        const down = y < h - 1 ? labels[(y + 1) * w + x] : l;
        if (l !== right || l !== down) lctx.fillRect(x * artScale, y * artScale, artScale, artScale);
      }
    }
    const lineArt = lineCv.toDataURL('image/png');

    // coloreado (solucion)
    const colCv = document.createElement('canvas'); colCv.width = aw; colCv.height = ah;
    const cctx = colCv.getContext('2d')!;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = centroids[labels[y * w + x]];
      cctx.fillStyle = toHex(c); cctx.fillRect(x * artScale, y * artScale, artScale, artScale);
    }
    const colored = colCv.toDataURL('image/png');

    onProgress?.(0.85, 'Numerando zonas...');
    // componentes conexos por etiqueta -> centroides de zonas grandes
    const seen = new Uint8Array(w * h);
    const numbers: { x: number; y: number; n: number }[] = [];
    const minArea = (w * h) / 90;
    const stack: number[] = [];
    for (let start = 0; start < w * h; start++) {
      if (seen[start]) continue;
      const lab = labels[start];
      let sx = 0, sy = 0, area = 0;
      stack.push(start); seen[start] = 1;
      while (stack.length) {
        const q = stack.pop()!;
        const qx = q % w, qy = (q - qx) / w;
        sx += qx; sy += qy; area++;
        const neigh = [qx > 0 ? q - 1 : -1, qx < w - 1 ? q + 1 : -1, qy > 0 ? q - w : -1, qy < h - 1 ? q + w : -1];
        for (const nb of neigh) if (nb >= 0 && !seen[nb] && labels[nb] === lab) { seen[nb] = 1; stack.push(nb); }
      }
      if (area >= minArea) numbers.push({ x: (sx / area) * artScale, y: (sy / area) * artScale, n: lab + 1 });
    }

    // paleta ordenada por numero
    const used = Array.from(new Set(numbers.map((n) => n.n))).sort((a, b) => a - b);
    const palette = used.map((n) => ({ color: toHex(centroids[n - 1]), n }));

    onProgress?.(1, 'Listo');
    const d: ColorByNumbersData = {
      lineArt, colored, artW: aw, artH: ah, numbers, palette,
      showColors: config.showColors === true,
    };
    return build(d);
  },
  Editor: CBNEditor,
};
