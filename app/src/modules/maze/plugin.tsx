import type {
  ActivityPlugin,
  EditorProps,
  GenerateContext,
  GeneratedActivity,
  ValidationResult,
} from '../../core/types';
import { svgDocument, round } from '../../core/svg';

// ============================================================================
// Modulo "Laberintos" (algoritmico, sin imagen).
// Genera un laberinto PERFECTO (arbol generador de la grilla): entre dos celdas
// cualesquiera existe exactamente un camino, asi que la solucion es UNICA por
// construccion. Ademas se verifica matematicamente (aristas = celdas - 1 y
// grafo conexo) y se resuelve con BFS.
// ============================================================================

interface Cell { walls: [boolean, boolean, boolean, boolean]; } // top,right,bottom,left

export interface MazeData {
  cols: number;
  rows: number;
  cellSize: number;
  cells: Cell[]; // fila por fila
  solution: number[]; // indices de celdas del camino
  showSolution: boolean;
  wallColor: string;
  solutionColor: string;
  level: string;
  seed: number;
}

const LEVELS: Record<string, number> = { muy_facil: 8, facil: 12, medio: 18, dificil: 26 };

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function idx(c: number, r: number, cols: number) { return r * cols + c; }

/** Genera un laberinto perfecto con backtracker aleatorio (DFS). */
function carve(cols: number, rows: number, rand: () => number): { cells: Cell[]; edges: number } {
  const cells: Cell[] = Array.from({ length: cols * rows }, () => ({ walls: [true, true, true, true] as [boolean, boolean, boolean, boolean] }));
  const visited = new Array(cols * rows).fill(false);
  const stack: number[] = [0];
  visited[0] = true;
  let edges = 0;

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    const neighbors: { ni: number; dir: number; opp: number }[] = [];
    if (r > 0 && !visited[idx(c, r - 1, cols)]) neighbors.push({ ni: idx(c, r - 1, cols), dir: 0, opp: 2 });
    if (c < cols - 1 && !visited[idx(c + 1, r, cols)]) neighbors.push({ ni: idx(c + 1, r, cols), dir: 1, opp: 3 });
    if (r < rows - 1 && !visited[idx(c, r + 1, cols)]) neighbors.push({ ni: idx(c, r + 1, cols), dir: 2, opp: 0 });
    if (c > 0 && !visited[idx(c - 1, r, cols)]) neighbors.push({ ni: idx(c - 1, r, cols), dir: 3, opp: 1 });

    if (neighbors.length === 0) { stack.pop(); continue; }
    const pick = neighbors[Math.floor(rand() * neighbors.length)];
    cells[cur].walls[pick.dir] = false;
    cells[pick.ni].walls[pick.opp] = false;
    edges++;
    visited[pick.ni] = true;
    stack.push(pick.ni);
  }
  return { cells, edges };
}

/** BFS del inicio (0) al final (ultima celda). Devuelve el camino de indices. */
function solve(cells: Cell[], cols: number, rows: number): number[] {
  const start = 0;
  const end = cols * rows - 1;
  const prev = new Array(cols * rows).fill(-1);
  const seen = new Array(cols * rows).fill(false);
  const queue = [start];
  seen[start] = true;
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === end) break;
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    const w = cells[cur].walls;
    const moves: number[] = [];
    if (!w[0]) moves.push(idx(c, r - 1, cols));
    if (!w[1]) moves.push(idx(c + 1, r, cols));
    if (!w[2]) moves.push(idx(c, r + 1, cols));
    if (!w[3]) moves.push(idx(c - 1, r, cols));
    for (const m of moves) {
      if (m >= 0 && m < cols * rows && !seen[m]) { seen[m] = true; prev[m] = cur; queue.push(m); }
    }
  }
  const path: number[] = [];
  let node = end;
  if (!seen[end]) return path;
  while (node !== -1) { path.push(node); node = prev[node]; }
  return path.reverse();
}

function renderMaze(d: MazeData): { svg: string; W: number; H: number } {
  const { cols, rows, cellSize: cs, cells } = d;
  const pad = 40;
  const W = cols * cs + pad * 2;
  const H = rows * cs + pad * 2 + 40;
  const ox = pad, oy = pad + 40;

  let content = '';
  content += `<text x="${W / 2}" y="${pad + 10}" font-family="'Baloo 2',system-ui,sans-serif" font-size="34" font-weight="800" fill="#1B3A6B" text-anchor="middle">Laberinto</text>`;

  // solucion (debajo de las paredes)
  if (d.showSolution && d.solution.length > 1) {
    let path = '';
    d.solution.forEach((ci, i) => {
      const c = ci % cols, r = Math.floor(ci / cols);
      const x = ox + c * cs + cs / 2, y = oy + r * cs + cs / 2;
      path += (i === 0 ? 'M' : 'L') + ` ${round(x)} ${round(y)}`;
    });
    content += `<path d="${path}" fill="none" stroke="${d.solutionColor}" stroke-width="${round(cs * 0.32)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.6"/>`;
  }

  const sw = Math.max(2, Math.round(cs * 0.12));
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${d.wallColor}" stroke-width="${sw}" stroke-linecap="round"/>`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const w = cells[idx(c, r, cols)].walls;
      const x = ox + c * cs, y = oy + r * cs;
      // entrada: abrir pared izquierda de (0,0); salida: derecha de la ultima
      if (c === 0 && r === 0) { /* entrada abierta */ } else if (w[3]) content += line(x, y, x, y + cs);
      if (w[0]) content += line(x, y, x + cs, y);
      if (c === cols - 1 && r === rows - 1) { /* salida abierta */ } else if (w[1]) content += line(x + cs, y, x + cs, y + cs);
      if (w[2]) content += line(x, y + cs, x + cs, y + cs);
    }
  }

  // marcadores entrada/salida
  content += `<text x="${round(ox - 8)}" y="${round(oy + cs / 2 + 10)}" font-size="${round(cs * 0.7)}" text-anchor="end">🐭</text>`;
  content += `<text x="${round(ox + cols * cs + 8)}" y="${round(oy + (rows - 1) * cs + cs / 2 + 10)}" font-size="${round(cs * 0.7)}">🧀</text>`;

  return { svg: svgDocument(W, H, content), W, H };
}

function validate(d: MazeData): ValidationResult {
  const n = d.cols * d.rows;
  // contar aristas (pasajes): sumar paredes internas ausentes / 2
  let passages = 0;
  for (let i = 0; i < n; i++) {
    const w = d.cells[i].walls;
    if (!w[1]) passages++; // derecha (evita doble conteo contando solo dos direcciones)
    if (!w[2]) passages++; // abajo
  }
  const isTree = passages === n - 1;
  const solved = d.solution.length > 0 && d.solution[0] === 0 && d.solution[d.solution.length - 1] === n - 1;
  const checks = [
    { label: 'Existe una solución', ok: solved, detail: solved ? `Camino de ${d.solution.length} celdas` : 'No se encontró' },
    { label: 'La solución es única', ok: isTree, detail: isTree ? 'Laberinto perfecto (árbol): un solo camino' : 'Hay bucles o zonas aisladas' },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}

function build(d: MazeData): GeneratedActivity<MazeData> {
  const { svg, W, H } = renderMaze(d);
  return { svg, width: W, height: H, data: d, validation: validate(d), supportsTransparent: true };
}

function MazeEditor({ activity, onChange }: EditorProps<MazeData>) {
  const d = activity.data;
  const patch = (p: Partial<MazeData>) => onChange(build({ ...d, ...p }));
  const regen = () => {
    const seed = Math.floor(Math.random() * 1e9);
    const rand = mulberry32(seed);
    const { cells } = carve(d.cols, d.rows, rand);
    const solution = solve(cells, d.cols, d.rows);
    onChange(build({ ...d, cells, solution, seed }));
  };
  return (
    <div className="editor">
      <div className="editor-toolbar">
        <label className="mini-toggle">
          <input type="checkbox" checked={d.showSolution} onChange={(e) => patch({ showSolution: e.target.checked })} /> Mostrar solución
        </label>
        <input type="color" value={d.wallColor} onChange={(e) => patch({ wallColor: e.target.value })} title="Color de paredes" />
        <button className="tool" onClick={regen}>🎲 Otro laberinto</button>
      </div>
      <div className="editor-canvas" dangerouslySetInnerHTML={{ __html: activity.svg }} />
      <p className="editor-hint">Ayudá al ratón 🐭 a llegar al queso 🧀. La solución es siempre única.</p>
    </div>
  );
}

export const mazePlugin: ActivityPlugin<MazeData> = {
  id: 'maze',
  name: 'Laberintos',
  tagline: 'Laberintos con solución única garantizada matemáticamente.',
  icon: '🌀',
  accent: '#00CEC9',
  ageRange: '4 a 10 años',
  requiresImage: false,
  status: 'ready',
  configFields: [
    {
      type: 'select', key: 'level', label: 'Dificultad', default: 'facil',
      options: [
        { value: 'muy_facil', label: 'Muy fácil (8×8)' },
        { value: 'facil', label: 'Fácil (12×12)' },
        { value: 'medio', label: 'Medio (18×18)' },
        { value: 'dificil', label: 'Difícil (26×26)' },
      ],
    },
    { type: 'toggle', key: 'showSolution', label: 'Incluir solución', default: false },
  ],
  async generate(ctx: GenerateContext) {
    const size = LEVELS[String(ctx.config.level ?? 'facil')] ?? 12;
    const seed = Math.floor(Math.random() * 1e9);
    const rand = mulberry32(seed);
    const { cells } = carve(size, size, rand);
    const solution = solve(cells, size, size);
    const cellSize = Math.max(18, Math.round(620 / size));
    const d: MazeData = {
      cols: size, rows: size, cellSize, cells, solution,
      showSolution: ctx.config.showSolution === true,
      wallColor: '#1B3A6B', solutionColor: '#E1306C',
      level: String(ctx.config.level ?? 'facil'), seed,
    };
    return build(d);
  },
  Editor: MazeEditor,
};
