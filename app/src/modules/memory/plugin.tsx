import type {
  ActivityPlugin,
  EditorProps,
  GenerateContext,
  GeneratedActivity,
  ValidationResult,
} from '../../core/types';
import { svgDocument, escapeXml, round } from '../../core/svg';

// ============================================================================
// Modulo "Memotest". Genera un mazo de cartas en pares (frentes) listo para
// recortar. La imagen subida (opcional) se usa como diseño del reverso.
// ============================================================================

const THEMES: Record<string, string[]> = {
  animales: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄'],
  frutas: ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🍑', '🍒', '🥝', '🍍', '🥥', '🥑', '🍅', '🌽', '🥕', '🍄'],
  transporte: ['🚗', '🚌', '🚑', '🚒', '🚜', '🚲', '🛵', '🚂', '✈️', '🚀', '⛵', '🚁', '🛴', '🚚', '🏍️', '🚤'],
  naturaleza: ['🌵', '🌲', '🌻', '🌸', '🍁', '🐚', '⭐', '🌙', '☀️', '🌈', '❄️', '🔥', '💧', '🍀', '🌴', '🌷'],
};

export interface MemoryData {
  faces: string[]; // 2N emojis mezclados
  cols: number;
  cardSize: number;
  gap: number;
  backImg: string | null;
  backColor: string;
  showBacks: boolean;
  title: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function layout(count: number): number {
  // columnas que dan una grilla compacta
  const cols = Math.ceil(Math.sqrt(count * 1.3));
  return Math.min(cols, count);
}

function renderMemory(d: MemoryData): { svg: string; W: number; H: number } {
  const { faces, cols, cardSize, gap, title } = d;
  const rows = Math.ceil(faces.length / cols);
  const pad = 50;
  const W = pad * 2 + cols * cardSize + (cols - 1) * gap;
  const gridH = rows * cardSize + (rows - 1) * gap;
  const backsH = d.showBacks ? cardSize + 90 : 0;
  const H = pad * 2 + 70 + gridH + backsH;

  let content = '';
  content += `<text x="${W / 2}" y="${pad + 20}" font-family="'Baloo 2',system-ui,sans-serif" font-size="42" font-weight="800" fill="#1B3A6B" text-anchor="middle">${escapeXml(title)}</text>`;

  const gy = pad + 60;
  faces.forEach((face, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = pad + c * (cardSize + gap);
    const y = gy + r * (cardSize + gap);
    content += `<rect x="${x}" y="${y}" width="${cardSize}" height="${cardSize}" rx="${round(cardSize * 0.12)}" fill="#ffffff" stroke="#1B3A6B" stroke-width="3"/>`;
    content += `<text x="${round(x + cardSize / 2)}" y="${round(y + cardSize * 0.68)}" font-size="${round(cardSize * 0.6)}" text-anchor="middle">${face}</text>`;
  });

  if (d.showBacks) {
    const by = gy + gridH + 50;
    content += `<text x="${pad}" y="${by - 6}" font-family="'Baloo 2',system-ui,sans-serif" font-size="26" font-weight="700" fill="#E1306C">Reverso (dorso de todas las cartas):</text>`;
    const bx = pad;
    content += `<rect x="${bx}" y="${by + 10}" width="${cardSize}" height="${cardSize}" rx="${round(cardSize * 0.12)}" fill="${d.backColor}" stroke="#1B3A6B" stroke-width="3"/>`;
    if (d.backImg) {
      const m = cardSize * 0.12;
      content += `<clipPath id="bkclip"><rect x="${bx + m}" y="${by + 10 + m}" width="${cardSize - m * 2}" height="${cardSize - m * 2}" rx="${round(cardSize * 0.08)}"/></clipPath>`;
      content += `<image href="${d.backImg}" x="${bx + m}" y="${by + 10 + m}" width="${cardSize - m * 2}" height="${cardSize - m * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#bkclip)"/>`;
    } else {
      content += `<text x="${round(bx + cardSize / 2)}" y="${round(by + 10 + cardSize * 0.6)}" font-size="${round(cardSize * 0.5)}" text-anchor="middle">❓</text>`;
    }
  }

  return { svg: svgDocument(W, H, content), W, H };
}

function validate(d: MemoryData): ValidationResult {
  const counts = new Map<string, number>();
  for (const f of d.faces) counts.set(f, (counts.get(f) ?? 0) + 1);
  const allPairs = Array.from(counts.values()).every((v) => v === 2);
  const checks = [
    { label: 'Número de cartas par', ok: d.faces.length % 2 === 0, detail: `${d.faces.length} cartas` },
    { label: 'Cada figura aparece exactamente 2 veces', ok: allPairs, detail: `${counts.size} pares` },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}

function build(d: MemoryData): GeneratedActivity<MemoryData> {
  const { svg, W, H } = renderMemory(d);
  return { svg, width: W, height: H, data: d, validation: validate(d), supportsTransparent: false };
}

function MemoryEditor({ activity, onChange }: EditorProps<MemoryData>) {
  const d = activity.data;
  const patch = (p: Partial<MemoryData>) => onChange(build({ ...d, ...p }));
  return (
    <div className="editor">
      <div className="editor-toolbar">
        <label className="mini-slider">Tamaño
          <input type="range" min={120} max={280} step={10} value={d.cardSize} onChange={(e) => patch({ cardSize: Number(e.target.value) })} />
        </label>
        <label className="mini-toggle">
          <input type="checkbox" checked={d.showBacks} onChange={(e) => patch({ showBacks: e.target.checked })} /> Mostrar reverso
        </label>
        <input type="color" value={d.backColor} onChange={(e) => patch({ backColor: e.target.value })} title="Color del reverso" />
        <button className="tool" onClick={() => patch({ faces: shuffle(d.faces) })}>🔀 Mezclar</button>
      </div>
      <div className="editor-canvas" dangerouslySetInnerHTML={{ __html: activity.svg }} />
      <p className="editor-hint">Imprimí, recortá y jugá. El reverso usa la imagen que subiste (si la subiste).</p>
    </div>
  );
}

export const memoryPlugin: ActivityPlugin<MemoryData> = {
  id: 'memory',
  name: 'Memotest',
  tagline: 'Mazo de cartas en pares para el juego de memoria. La imagen es el reverso.',
  icon: '🃏',
  accent: '#0984E3',
  ageRange: '3 a 8 años',
  requiresImage: false,
  status: 'ready',
  configFields: [
    { type: 'text', key: 'title', label: 'Título', default: 'Memotest' },
    {
      type: 'select', key: 'pairs', label: 'Cantidad de pares', default: '8',
      options: ['4', '6', '8', '10', '12'].map((v) => ({ value: v, label: `${v} pares (${Number(v) * 2} cartas)` })),
    },
    {
      type: 'select', key: 'theme', label: 'Tema de las figuras', default: 'animales',
      options: [
        { value: 'animales', label: 'Animales' },
        { value: 'frutas', label: 'Frutas' },
        { value: 'transporte', label: 'Transporte' },
        { value: 'naturaleza', label: 'Naturaleza' },
      ],
    },
    { type: 'toggle', key: 'showBacks', label: 'Incluir diseño de reverso', default: true },
  ],
  async generate(ctx: GenerateContext) {
    const { image, config } = ctx;
    const pairs = Number(config.pairs ?? 8);
    const theme = String(config.theme ?? 'animales');
    const pool = THEMES[theme] ?? THEMES.animales;
    const chosen = pool.slice(0, pairs);
    const faces = shuffle([...chosen, ...chosen]);
    const d: MemoryData = {
      faces,
      cols: layout(faces.length),
      cardSize: 180,
      gap: 24,
      backImg: image?.src ?? null,
      backColor: '#6C5CE7',
      showBacks: config.showBacks !== false,
      title: String(config.title ?? 'Memotest'),
    };
    return build(d);
  },
  Editor: MemoryEditor,
};
