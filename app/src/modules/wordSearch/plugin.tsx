import type {
  ActivityPlugin,
  EditorProps,
  GenerateContext,
  GeneratedActivity,
  ValidationResult,
} from '../../core/types';
import { svgDocument, escapeXml, round } from '../../core/svg';

// ============================================================================
// Modulo "Sopa de Letras" (algoritmico, no requiere imagen).
// Coloca las palabras en una grilla en las direcciones elegidas, verifica que
// TODAS entren y rellena el resto con letras aleatorias.
// ============================================================================

export interface Placement {
  word: string;
  cells: { r: number; c: number }[];
}
export interface WordSearchData {
  grid: string[][];
  size: number;
  words: string[];
  placements: Placement[];
  title: string;
  showSolution: boolean;
  cell: number;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function normalizeWord(w: string): string {
  return w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-ZÑ]/g, '')
    .replace(/Ñ/g, 'N');
}

interface Dir { dr: number; dc: number; }

function buildDirections(cfg: GenerateContext['config']): Dir[] {
  const dirs: Dir[] = [];
  const rev = cfg.reverse !== false;
  if (cfg.horizontal !== false) { dirs.push({ dr: 0, dc: 1 }); if (rev) dirs.push({ dr: 0, dc: -1 }); }
  if (cfg.vertical !== false) { dirs.push({ dr: 1, dc: 0 }); if (rev) dirs.push({ dr: -1, dc: 0 }); }
  if (cfg.diagonal !== false) {
    dirs.push({ dr: 1, dc: 1 }); dirs.push({ dr: 1, dc: -1 });
    if (rev) { dirs.push({ dr: -1, dc: -1 }); dirs.push({ dr: -1, dc: 1 }); }
  }
  return dirs.length ? dirs : [{ dr: 0, dc: 1 }];
}

function tryPlace(
  grid: string[][], word: string, size: number, dirs: Dir[],
): Placement | null {
  for (let attempt = 0; attempt < 300; attempt++) {
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const r0 = Math.floor(Math.random() * size);
    const c0 = Math.floor(Math.random() * size);
    const rEnd = r0 + dir.dr * (word.length - 1);
    const cEnd = c0 + dir.dc * (word.length - 1);
    if (rEnd < 0 || rEnd >= size || cEnd < 0 || cEnd >= size) continue;
    let ok = true;
    for (let i = 0; i < word.length; i++) {
      const r = r0 + dir.dr * i;
      const c = c0 + dir.dc * i;
      if (grid[r][c] !== '' && grid[r][c] !== word[i]) { ok = false; break; }
    }
    if (!ok) continue;
    const cells: { r: number; c: number }[] = [];
    for (let i = 0; i < word.length; i++) {
      const r = r0 + dir.dr * i;
      const c = c0 + dir.dc * i;
      grid[r][c] = word[i];
      cells.push({ r, c });
    }
    return { word, cells };
  }
  return null;
}

function generateData(ctx: GenerateContext): { data: WordSearchData; failed: string[] } {
  const cfg = ctx.config;
  const size = Number(cfg.size ?? 12);
  const title = String(cfg.title ?? 'Sopa de Letras');
  const raw = String(cfg.words ?? '');
  const words = Array.from(new Set(
    raw.split(/[\n,]/).map(normalizeWord).filter((w) => w.length >= 2 && w.length <= size),
  )).sort((a, b) => b.length - a.length);

  const dirs = buildDirections(cfg);
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const placements: Placement[] = [];
  const failed: string[] = [];

  for (const w of words) {
    const p = tryPlace(grid, w, size, dirs);
    if (p) placements.push(p);
    else failed.push(w);
  }

  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r][c] === '') grid[r][c] = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];

  const data: WordSearchData = {
    grid, size, words: placements.map((p) => p.word), placements, title,
    showSolution: false, cell: 64,
  };
  return { data, failed };
}

function validate(data: WordSearchData, failed: string[]): ValidationResult {
  const checks = [
    {
      label: 'Hay palabras para buscar',
      ok: data.placements.length > 0,
      detail: `${data.placements.length} palabra(s) colocada(s)`,
    },
    {
      label: 'Todas las palabras entran en la grilla',
      ok: failed.length === 0,
      detail: failed.length ? `No entraron: ${failed.join(', ')}` : 'Todas ubicadas correctamente',
    },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}

function renderWordSearch(data: WordSearchData): string {
  const { grid, size, placements, title, showSolution } = data;
  const cell = data.cell;
  const pad = 60;
  const gridPx = size * cell;
  const listCols = 3;
  const listRows = Math.ceil(placements.length / listCols);
  const listH = 70 + listRows * 46;
  const W = gridPx + pad * 2;
  const H = pad + 70 + gridPx + 40 + listH;

  let content = '';
  content += `<text x="${W / 2}" y="${pad + 20}" font-family="'Baloo 2',system-ui,sans-serif" font-size="46" font-weight="800" fill="#1B3A6B" text-anchor="middle">${escapeXml(title)}</text>`;

  const gx = pad;
  const gy = pad + 60;

  if (showSolution) {
    for (const p of placements) {
      const a = p.cells[0], b = p.cells[p.cells.length - 1];
      const x1 = gx + a.c * cell + cell / 2;
      const y1 = gy + a.r * cell + cell / 2;
      const x2 = gx + b.c * cell + cell / 2;
      const y2 = gy + b.r * cell + cell / 2;
      content += `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="#6C5CE7" stroke-opacity="0.35" stroke-width="${cell * 0.7}" stroke-linecap="round"/>`;
    }
  }

  content += `<rect x="${gx}" y="${gy}" width="${gridPx}" height="${gridPx}" fill="none" stroke="#1B3A6B" stroke-width="3" rx="12"/>`;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const x = gx + c * cell + cell / 2;
      const y = gy + r * cell + cell / 2 + cell * 0.32;
      content += `<text x="${round(x)}" y="${round(y)}" font-family="'Baloo 2',monospace" font-size="${round(cell * 0.55)}" font-weight="600" fill="#2b2b3a" text-anchor="middle">${grid[r][c]}</text>`;
    }
  }

  // lista de palabras
  const ly = gy + gridPx + 40;
  content += `<text x="${gx}" y="${ly + 10}" font-family="'Baloo 2',system-ui,sans-serif" font-size="30" font-weight="800" fill="#E1306C">Encontrá:</text>`;
  const colW = gridPx / listCols;
  placements.forEach((p, i) => {
    const col = i % listCols;
    const row = Math.floor(i / listCols);
    const x = gx + col * colW;
    const y = ly + 56 + row * 46;
    content += `<text x="${round(x)}" y="${round(y)}" font-family="'Baloo 2',system-ui,sans-serif" font-size="30" fill="#2b2b3a">☐ ${escapeXml(p.word)}</text>`;
  });

  return svgDocument(W, H, content);
}

function build(data: WordSearchData, failed: string[]): GeneratedActivity<WordSearchData> {
  const svg = renderWordSearch(data);
  // recompute size from svg viewBox is unnecessary; recompute W/H here:
  const cell = data.cell;
  const pad = 60;
  const gridPx = data.size * cell;
  const listRows = Math.ceil(data.placements.length / 3);
  const W = gridPx + pad * 2;
  const H = pad + 70 + gridPx + 40 + (70 + listRows * 46);
  return {
    svg, width: W, height: H, data,
    validation: validate(data, failed),
    supportsTransparent: false,
  };
}

function WordSearchEditor({ activity, onChange }: EditorProps<WordSearchData>) {
  const d = activity.data;
  const patch = (p: Partial<WordSearchData>) => onChange(build({ ...d, ...p }, []));
  return (
    <div className="editor">
      <div className="editor-toolbar">
        <label className="mini-slider">Título
          <input type="text" value={d.title} onChange={(e) => patch({ title: e.target.value })} style={{ padding: '4px 8px', borderRadius: 8 }} />
        </label>
        <label className="mini-toggle">
          <input type="checkbox" checked={d.showSolution} onChange={(e) => patch({ showSolution: e.target.checked })} /> Mostrar solución
        </label>
      </div>
      <div className="editor-canvas" dangerouslySetInnerHTML={{ __html: activity.svg }} />
      <p className="editor-hint">Editá el título o mostrá la solución. Para cambiar las palabras, volvé a Configurar.</p>
    </div>
  );
}

export const wordSearchPlugin: ActivityPlugin<WordSearchData> = {
  id: 'word-search',
  name: 'Sopa de Letras',
  tagline: 'Grilla de letras con las palabras que elijas. Verifica que todas entren.',
  icon: '🔤',
  accent: '#00B894',
  ageRange: '6 a 10 años',
  requiresImage: false,
  status: 'ready',
  configFields: [
    { type: 'text', key: 'title', label: 'Título', default: 'Sopa de Letras', placeholder: 'Ej: Los animales' },
    { type: 'textarea', key: 'words', label: 'Palabras (una por línea o separadas por coma)', default: 'GATO\nPERRO\nCONEJO\nPATO\nVACA\nCABALLO', placeholder: 'GATO\nPERRO\n...' },
    { type: 'slider', key: 'size', label: 'Tamaño de la grilla', min: 8, max: 18, step: 1, default: 12, unit: '×' },
    { type: 'toggle', key: 'horizontal', label: 'Horizontal', default: true },
    { type: 'toggle', key: 'vertical', label: 'Vertical', default: true },
    { type: 'toggle', key: 'diagonal', label: 'Diagonal', default: true },
    { type: 'toggle', key: 'reverse', label: 'Al revés (reversa)', default: false },
  ],
  async generate(ctx) {
    const { data, failed } = generateData(ctx);
    return build(data, failed);
  },
  Editor: WordSearchEditor,
};
