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

// ============================================================================
// Modulo "Trazos". Convierte una imagen en una figura punteada para repasar
// (grafomotricidad). Reutiliza el pipeline de contorno del modulo Unir Puntos.
// ============================================================================

export interface TracingData {
  points: Point[]; // contorno normalizado (0..1) relativo a bbox
  reps: number;
  style: string;
  strokeColor: string;
  strokeWidth: number;
  showGuide: boolean;
  showStart: boolean;
  aspect: number;
}

function pathFrom(points: Point[], x: number, y: number, w: number, h: number): string {
  if (!points.length) return '';
  let d = '';
  points.forEach((p, i) => {
    d += (i === 0 ? 'M' : 'L') + ` ${round(x + p.x * w)} ${round(y + p.y * h)}`;
  });
  return d + ' Z';
}

function dashFor(style: string, sw: number): string {
  if (style === 'punteado') return `0.1 ${round(sw * 1.8)}`;
  if (style === 'rayado') return `${round(sw * 2.4)} ${round(sw * 1.8)}`;
  return '';
}

function renderTracing(d: TracingData): { svg: string; W: number; H: number } {
  const pad = 60;
  const cols = d.reps >= 4 ? 2 : 1;
  const rows = Math.ceil(d.reps / cols);
  const cellW = 480;
  const cellH = Math.round(cellW / d.aspect);
  const W = pad * 2 + cols * cellW + (cols - 1) * 40;
  const H = pad * 2 + 40 + rows * cellH + (rows - 1) * 30;

  let content = `<text x="${W / 2}" y="${pad}" font-family="'Baloo 2',system-ui,sans-serif" font-size="34" font-weight="800" fill="#1B3A6B" text-anchor="middle">Repasá la figura</text>`;

  const dash = dashFor(d.style, d.strokeWidth);
  const capRound = d.style === 'punteado' ? 'round' : 'butt';

  for (let i = 0; i < d.reps; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + col * (cellW + 40);
    const y = pad + 40 + row * (cellH + 30);
    const path = pathFrom(d.points, x, y, cellW, cellH);
    if (d.showGuide) {
      content += `<path d="${path}" fill="none" stroke="#E4E6F0" stroke-width="${round(d.strokeWidth * 1.6)}" stroke-linejoin="round"/>`;
    }
    content += `<path d="${path}" fill="none" stroke="${d.strokeColor}" stroke-width="${d.strokeWidth}" stroke-dasharray="${dash}" stroke-linecap="${capRound}" stroke-linejoin="round"/>`;
    if (d.showStart && d.points.length) {
      const sp = d.points[0];
      content += `<circle cx="${round(x + sp.x * cellW)}" cy="${round(y + sp.y * cellH)}" r="${round(d.strokeWidth * 1.4)}" fill="#00B894"/>`;
    }
  }

  return { svg: svgDocument(W, H, content), W, H };
}

function validate(d: TracingData): ValidationResult {
  const checks = [
    { label: 'Contorno detectado', ok: d.points.length >= 8, detail: `${d.points.length} puntos de trazo` },
    { label: 'Figura lista para repasar', ok: d.reps >= 1 && d.points.length >= 8 },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}

function build(d: TracingData): GeneratedActivity<TracingData> {
  const { svg, W, H } = renderTracing(d);
  return { svg, width: W, height: H, data: d, validation: validate(d), supportsTransparent: true };
}

function TracingEditor({ activity, onChange }: EditorProps<TracingData>) {
  const d = activity.data;
  const patch = (p: Partial<TracingData>) => onChange(build({ ...d, ...p }));
  return (
    <div className="editor">
      <div className="editor-toolbar">
        <label className="mini-slider">Grosor
          <input type="range" min={2} max={12} step={1} value={d.strokeWidth} onChange={(e) => patch({ strokeWidth: Number(e.target.value) })} />
        </label>
        <label className="mini-toggle"><input type="checkbox" checked={d.showGuide} onChange={(e) => patch({ showGuide: e.target.checked })} /> Guía tenue</label>
        <label className="mini-toggle"><input type="checkbox" checked={d.showStart} onChange={(e) => patch({ showStart: e.target.checked })} /> Punto de inicio</label>
        <input type="color" value={d.strokeColor} onChange={(e) => patch({ strokeColor: e.target.value })} title="Color del trazo" />
      </div>
      <div className="editor-canvas" dangerouslySetInnerHTML={{ __html: activity.svg }} />
      <p className="editor-hint">Repasá la línea punteada con el lápiz siguiendo el contorno.</p>
    </div>
  );
}

export const tracingPlugin: ActivityPlugin<TracingData> = {
  id: 'tracing',
  name: 'Trazos',
  tagline: 'Convierte una imagen en una figura punteada para repasar.',
  icon: '✍️',
  accent: '#74B9FF',
  ageRange: '3 a 7 años',
  requiresImage: true,
  status: 'ready',
  configFields: [
    {
      type: 'select', key: 'style', label: 'Estilo de línea', default: 'punteado',
      options: [
        { value: 'punteado', label: 'Punteado' },
        { value: 'rayado', label: 'Rayado' },
        { value: 'continuo', label: 'Continuo tenue' },
      ],
    },
    {
      type: 'select', key: 'reps', label: 'Repeticiones', default: '1',
      options: ['1', '2', '4', '6'].map((v) => ({ value: v, label: `${v}` })),
    },
    { type: 'toggle', key: 'showGuide', label: 'Guía tenue de fondo', default: true },
    { type: 'toggle', key: 'showStart', label: 'Marcar punto de inicio', default: true },
  ],
  async generate(ctx: GenerateContext) {
    const { image, config } = ctx;
    if (!image) throw new Error('Este modulo necesita una imagen.');
    let mask = imageToMask(image.element);
    mask = keepLargestComponent(mask);
    let contour = traceContour(mask);
    if (contour.length < 8) throw new Error('No se pudo detectar un contorno claro. Proba con una silueta simple.');
    contour = simplifyClosed(contour, 2.0);
    contour = smoothClosed(contour, 3);

    // normalizar a 0..1 dentro del bbox
    const xs = contour.map((p) => p.x), ys = contour.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    const points = contour.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h }));

    const style = String(config.style ?? 'punteado');
    const d: TracingData = {
      points, reps: Number(config.reps ?? 1), style,
      strokeColor: '#1B3A6B', strokeWidth: 6,
      showGuide: config.showGuide !== false, showStart: config.showStart !== false,
      aspect: w / h,
    };
    return build(d);
  },
  Editor: TracingEditor,
};
