import type {
  ActivityPlugin,
  EditorProps,
  GenerateContext,
  GeneratedActivity,
  Point,
  ValidationResult,
} from '../../core/types';
import { svgDocument, round } from '../../core/svg';
import { imageToMask, keepLargestComponent } from '../../core/geometry/imageProcessing';
import { traceContour } from '../../core/geometry/contour';
import { simplifyClosed, smoothClosed } from '../../core/geometry/simplify';
import { sampleSilhouettes } from '../../ui/samples';

// ============================================================================
// Modulo "Sombras". Muestra un objeto y varias sombras: hay que encontrar la
// sombra correcta (la silueta del objeto) entre distractores.
// ============================================================================

interface Option { kind: 'contour' | 'shapes'; points?: Point[]; shapes?: string; correct: boolean; }

export interface ShadowsData {
  imgSrc: string;
  options: Option[];
  showSolution: boolean;
}

function silhouettePath(points: Point[], x: number, y: number, size: number): string {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  const scale = (size * 0.82) / Math.max(w, h);
  const ox = x + (size - w * scale) / 2 - minX * scale;
  const oy = y + (size - h * scale) / 2 - minY * scale;
  let d = '';
  points.forEach((p, i) => { d += (i === 0 ? 'M' : 'L') + ` ${round(ox + p.x * scale)} ${round(oy + p.y * scale)}`; });
  return d + ' Z';
}

function renderShadows(d: ShadowsData): { svg: string; W: number; H: number } {
  const n = d.options.length;
  const box = 300, gap = 40, pad = 60;
  const W = pad * 2 + n * box + (n - 1) * gap;
  const objH = 340;
  const H = pad + objH + 80 + box + 90 + pad;

  let content = '';
  // objeto arriba
  content += `<text x="${W / 2}" y="${pad + 30}" font-family="'Baloo 2',system-ui,sans-serif" font-size="38" font-weight="800" fill="#1B3A6B" text-anchor="middle">¿Cuál es su sombra?</text>`;
  const objSize = 260;
  content += `<image href="${d.imgSrc}" x="${round(W / 2 - objSize / 2)}" y="${pad + 60}" width="${objSize}" height="${objSize}" preserveAspectRatio="xMidYMid meet"/>`;

  const rowY = pad + objH + 80;
  const letters = ['A', 'B', 'C', 'D', 'E'];
  d.options.forEach((opt, i) => {
    const x = pad + i * (box + gap);
    content += `<rect x="${x}" y="${rowY}" width="${box}" height="${box}" rx="20" fill="#F4F5FB" stroke="#1B3A6B" stroke-width="3"/>`;
    if (opt.kind === 'contour' && opt.points) {
      content += `<path d="${silhouettePath(opt.points, x, rowY, box)}" fill="#2b2b3a"/>`;
    } else if (opt.shapes) {
      // las formas de ejemplo estan en viewBox 400x400
      const s = (box * 0.82) / 400;
      const off = (box - 400 * s) / 2;
      content += `<g transform="translate(${round(x + off)} ${round(rowY + off)}) scale(${round(s, 4)})" fill="#2b2b3a">${opt.shapes}</g>`;
    }
    content += `<text x="${round(x + box / 2)}" y="${round(rowY + box + 46)}" font-family="'Baloo 2',system-ui,sans-serif" font-size="40" font-weight="800" fill="#1B3A6B" text-anchor="middle">${letters[i]}</text>`;
    if (d.showSolution && opt.correct) {
      content += `<circle cx="${round(x + box - 28)}" cy="${round(rowY + 28)}" r="24" fill="#00B894"/>`;
      content += `<text x="${round(x + box - 28)}" y="${round(rowY + 37)}" font-size="28" fill="#fff" text-anchor="middle">✓</text>`;
    }
  });

  return { svg: svgDocument(W, H, content), W, H };
}

function validate(d: ShadowsData): ValidationResult {
  const correct = d.options.filter((o) => o.correct).length;
  const checks = [
    { label: 'Hay una única sombra correcta', ok: correct === 1, detail: `${correct} correcta(s)` },
    { label: 'Hay distractores suficientes', ok: d.options.length >= 3, detail: `${d.options.length} opciones` },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}

function build(d: ShadowsData): GeneratedActivity<ShadowsData> {
  const { svg, W, H } = renderShadows(d);
  return { svg, width: W, height: H, data: d, validation: validate(d), supportsTransparent: false };
}

function shuffle<T>(a: T[]): T[] { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

function ShadowsEditor({ activity, onChange }: EditorProps<ShadowsData>) {
  const d = activity.data;
  const patch = (p: Partial<ShadowsData>) => onChange(build({ ...d, ...p }));
  return (
    <div className="editor">
      <div className="editor-toolbar">
        <label className="mini-toggle"><input type="checkbox" checked={d.showSolution} onChange={(e) => patch({ showSolution: e.target.checked })} /> Mostrar solución</label>
        <button className="tool" onClick={() => patch({ options: shuffle(d.options) })}>🔀 Mezclar</button>
      </div>
      <div className="editor-canvas" dangerouslySetInnerHTML={{ __html: activity.svg }} />
      <p className="editor-hint">Uní el objeto con su sombra correcta.</p>
    </div>
  );
}

export const shadowsPlugin: ActivityPlugin<ShadowsData> = {
  id: 'shadows',
  name: 'Sombras',
  tagline: 'Encontrá la sombra correcta del objeto entre distractores.',
  icon: '🌑',
  accent: '#636E72',
  ageRange: '3 a 7 años',
  requiresImage: true,
  status: 'ready',
  configFields: [
    { type: 'select', key: 'options', label: 'Cantidad de sombras', default: '4', options: ['3', '4', '5'].map((v) => ({ value: v, label: v })) },
    { type: 'toggle', key: 'showSolution', label: 'Incluir solución', default: false },
  ],
  async generate(ctx: GenerateContext) {
    const { image, config } = ctx;
    if (!image) throw new Error('Este modulo necesita una imagen.');
    let mask = imageToMask(image.element);
    mask = keepLargestComponent(mask);
    let contour = traceContour(mask);
    if (contour.length < 8) throw new Error('No se pudo detectar la silueta. Proba con una imagen simple sobre fondo liso.');
    contour = simplifyClosed(contour, 2.0);
    contour = smoothClosed(contour, 2);

    const total = Number(config.options ?? 4);
    const distractors = shuffle(sampleSilhouettes()).slice(0, total - 1);
    const opts: Option[] = [
      { kind: 'contour', points: contour, correct: true },
      ...distractors.map((s) => ({ kind: 'shapes' as const, shapes: s.shapes, correct: false })),
    ];
    const d: ShadowsData = { imgSrc: image.src, options: shuffle(opts), showSolution: config.showSolution === true };
    return build(d);
  },
  Editor: ShadowsEditor,
};
