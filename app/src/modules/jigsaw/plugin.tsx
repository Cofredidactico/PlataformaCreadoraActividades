import type {
  ActivityPlugin,
  EditorProps,
  GenerateContext,
  GeneratedActivity,
  ValidationResult,
} from '../../core/types';
import { svgDocument, round } from '../../core/svg';

// ============================================================================
// Modulo "Rompecabezas". Recorta la imagen en piezas dibujando las lineas de
// corte sobre ella. Estilos: clasico (recto), curvas (lengüetas), horizontal,
// vertical. Listo para imprimir y recortar.
// ============================================================================

export interface JigsawData {
  imgSrc: string;
  cols: number;
  rows: number;
  style: string;
  lineColor: string;
  lineWidth: number;
  showNumbers: boolean;
  boardW: number;
  boardH: number;
  pad: number;
  seed: number;
}

/** Elige filas x columnas que mejor respetan la proporcion de la imagen. */
function bestGrid(count: number, aspect: number): { rows: number; cols: number } {
  let best = { rows: 1, cols: count };
  let bestScore = Infinity;
  for (let r = 1; r <= count; r++) {
    if (count % r !== 0) continue;
    const c = count / r;
    const score = Math.abs(c / r - aspect);
    if (score < bestScore) { bestScore = score; best = { rows: r, cols: c }; }
  }
  return best;
}

// PRNG determinista para que los tabs no cambien en cada render.
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function edgePath(
  ax: number, ay: number, bx: number, by: number, flip: number, curved: boolean,
): string {
  if (!curved) return `L ${round(bx)} ${round(by)}`;
  const L = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / L, uy = (by - ay) / L;
  const r = L * 0.16;
  const p1x = ax + ux * (L / 2 - r), p1y = ay + uy * (L / 2 - r);
  const p2x = ax + ux * (L / 2 + r), p2y = ay + uy * (L / 2 + r);
  const sweep = flip > 0 ? 1 : 0;
  return `L ${round(p1x)} ${round(p1y)} A ${round(r)} ${round(r)} 0 0 ${sweep} ${round(p2x)} ${round(p2y)} L ${round(bx)} ${round(by)}`;
}

function renderJigsaw(d: JigsawData): string {
  const { cols, rows, pad, boardW, boardH } = d;
  const curved = d.style === 'curvas';
  const cw = boardW / cols;
  const ch = boardH / rows;
  const W = boardW + pad * 2;
  const H = boardH + pad * 2;
  const ox = pad, oy = pad;
  const rand = mulberry32(d.seed);

  let content = `<image href="${d.imgSrc}" x="${ox}" y="${oy}" width="${boardW}" height="${boardH}" preserveAspectRatio="xMidYMid slice"/>`;

  // marco exterior
  content += `<rect x="${ox}" y="${oy}" width="${boardW}" height="${boardH}" fill="none" stroke="${d.lineColor}" stroke-width="${d.lineWidth * 1.4}" rx="6"/>`;

  const stroke = `stroke="${d.lineColor}" stroke-width="${d.lineWidth}" fill="none" stroke-linejoin="round" stroke-linecap="round"`;

  // lineas verticales internas (por celda, con tab aleatorio)
  for (let c = 1; c < cols; c++) {
    const x = ox + c * cw;
    for (let r = 0; r < rows; r++) {
      const y0 = oy + r * ch;
      const y1 = oy + (r + 1) * ch;
      const flip = rand() > 0.5 ? 1 : -1;
      content += `<path d="M ${round(x)} ${round(y0)} ${edgePath(x, y0, x, y1, flip, curved)}" ${stroke}/>`;
    }
  }
  // lineas horizontales internas
  for (let r = 1; r < rows; r++) {
    const y = oy + r * ch;
    for (let c = 0; c < cols; c++) {
      const x0 = ox + c * cw;
      const x1 = ox + (c + 1) * cw;
      const flip = rand() > 0.5 ? 1 : -1;
      content += `<path d="M ${round(x0)} ${round(y)} ${edgePath(x0, y, x1, y, flip, curved)}" ${stroke}/>`;
    }
  }

  if (d.showNumbers) {
    let n = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ox + c * cw + cw / 2;
        const y = oy + r * ch + ch / 2;
        content += `<circle cx="${round(x)}" cy="${round(y)}" r="18" fill="#ffffff" fill-opacity="0.85" stroke="${d.lineColor}" stroke-width="2"/>`;
        content += `<text x="${round(x)}" y="${round(y + 7)}" font-family="'Baloo 2',system-ui,sans-serif" font-size="22" font-weight="700" fill="#1B3A6B" text-anchor="middle">${n++}</text>`;
      }
    }
  }

  return svgDocument(W, H, content);
}

function validate(d: JigsawData, requested: number): ValidationResult {
  const pieces = d.rows * d.cols;
  const checks = [
    { label: 'Cantidad de piezas correcta', ok: pieces === requested, detail: `${pieces} piezas (${d.rows}×${d.cols})` },
    { label: 'Imagen cargada', ok: !!d.imgSrc, detail: d.imgSrc ? 'OK' : 'Falta imagen' },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}

function build(d: JigsawData, requested: number): GeneratedActivity<JigsawData> {
  return {
    svg: renderJigsaw(d),
    width: d.boardW + d.pad * 2,
    height: d.boardH + d.pad * 2,
    data: d,
    validation: validate(d, requested),
    supportsTransparent: false,
  };
}

function JigsawEditor({ activity, onChange }: EditorProps<JigsawData>) {
  const d = activity.data;
  const patch = (p: Partial<JigsawData>) => onChange(build({ ...d, ...p }, d.rows * d.cols));
  return (
    <div className="editor">
      <div className="editor-toolbar">
        <label className="mini-toggle">
          <input type="checkbox" checked={d.showNumbers} onChange={(e) => patch({ showNumbers: e.target.checked })} /> Numerar piezas
        </label>
        <label className="mini-slider">Grosor
          <input type="range" min={1} max={8} step={1} value={d.lineWidth} onChange={(e) => patch({ lineWidth: Number(e.target.value) })} />
        </label>
        <input type="color" value={d.lineColor} onChange={(e) => patch({ lineColor: e.target.value })} title="Color de corte" />
        <button className="tool" onClick={() => patch({ seed: Math.floor(Math.random() * 1e9) })}>🎲 Otras lengüetas</button>
      </div>
      <div className="editor-canvas" dangerouslySetInnerHTML={{ __html: activity.svg }} />
      <p className="editor-hint">Ajustá el corte. Para cambiar cantidad de piezas o estilo, volvé a Configurar.</p>
    </div>
  );
}

export const jigsawPlugin: ActivityPlugin<JigsawData> = {
  id: 'jigsaw',
  name: 'Rompecabezas',
  tagline: 'Convierte una imagen en un rompecabezas listo para imprimir y recortar.',
  icon: '🧩',
  accent: '#E17055',
  ageRange: '3 a 8 años',
  requiresImage: true,
  status: 'ready',
  configFields: [
    {
      type: 'select', key: 'pieces', label: 'Cantidad de piezas', default: '9',
      options: ['2', '4', '6', '9', '12', '16', '20', '24', '30'].map((v) => ({ value: v, label: `${v} piezas` })),
    },
    {
      type: 'select', key: 'style', label: 'Estilo de corte', default: 'curvas',
      options: [
        { value: 'curvas', label: 'Curvas (lengüetas)' },
        { value: 'clasico', label: 'Clásico (recto)' },
        { value: 'horizontal', label: 'Tiras horizontales' },
        { value: 'vertical', label: 'Tiras verticales' },
      ],
    },
    { type: 'toggle', key: 'showNumbers', label: 'Numerar piezas (guía)', default: false },
  ],
  async generate(ctx: GenerateContext) {
    const { image, config } = ctx;
    if (!image) throw new Error('Este modulo necesita una imagen.');
    const requested = Number(config.pieces ?? 9);
    const style = String(config.style ?? 'curvas');
    const aspect = image.width / image.height;

    let rows: number, cols: number;
    if (style === 'horizontal') { rows = requested; cols = 1; }
    else if (style === 'vertical') { rows = 1; cols = requested; }
    else { const g = bestGrid(requested, aspect); rows = g.rows; cols = g.cols; }

    const targetW = 1200;
    const boardW = targetW;
    const boardH = Math.round(targetW / aspect);

    const d: JigsawData = {
      imgSrc: image.src, cols, rows, style,
      lineColor: '#ffffff', lineWidth: 4, showNumbers: config.showNumbers === true,
      boardW, boardH, pad: 30, seed: Math.floor(Math.random() * 1e9),
    };
    return build(d, requested);
  },
  Editor: JigsawEditor,
};
