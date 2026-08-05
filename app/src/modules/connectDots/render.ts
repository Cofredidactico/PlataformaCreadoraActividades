import type { Point, ValidationResult } from '../../core/types';
import { svgDocument, round } from '../../core/svg';
import { dist } from '../../core/geometry/contour';

// ============================================================================
// Estado editable + render + validacion del modulo "Unir Puntos".
// render() y validate() se usan tanto al generar como al editar, para que la
// vista y las comprobaciones sean siempre coherentes.
// ============================================================================

export interface ConnectDotsData {
  points: Point[]; // en coordenadas del lienzo
  canvasW: number;
  canvasH: number;
  showNumbers: boolean;
  showGuide: boolean;
  closeShape: boolean;
  dotSize: number;
  minSpacing: number; // separacion minima objetivo (px de lienzo)
  fontSize: number;
  dotColor: string;
  numberColor: string;
  guideColor: string;
}

/** Deteccion de interseccion de segmentos (para verificar "sin cruces"). */
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

/** Cuenta cruces entre segmentos NO adyacentes de la secuencia de puntos. */
export function countCrossings(points: Point[], closed: boolean): number {
  const n = points.length;
  const edges: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) edges.push([i, i + 1]);
  if (closed && n > 2) edges.push([n - 1, 0]);
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i];
      const [c, e] = edges[j];
      // saltar si comparten vertice
      if (a === c || a === e || b === c || b === e) continue;
      if (segmentsIntersect(points[a], points[b], points[c], points[e])) crossings++;
    }
  }
  return crossings;
}

export function validate(data: ConnectDotsData): ValidationResult {
  const { points, closeShape, minSpacing } = data;
  const n = points.length;

  // separacion
  let minObserved = Infinity;
  let maxObserved = 0;
  for (let i = 0; i < n - 1; i++) {
    const d = dist(points[i], points[i + 1]);
    minObserved = Math.min(minObserved, d);
    maxObserved = Math.max(maxObserved, d);
  }
  if (closeShape && n > 1) {
    const d = dist(points[n - 1], points[0]);
    minObserved = Math.min(minObserved, d);
    maxObserved = Math.max(maxObserved, d);
  }
  const uniformity = maxObserved > 0 ? minObserved / maxObserved : 1;

  const crossings = countCrossings(points, closeShape);
  const tooClose = minObserved < minSpacing * 0.6;

  const checks = [
    {
      label: 'Todos los puntos se conectan en secuencia',
      ok: n >= 2,
      detail: `${n} puntos numerados de 1 a ${n}`,
    },
    {
      label: 'Sin lineas cruzadas',
      ok: crossings === 0,
      detail: crossings === 0 ? 'Ningun segmento se cruza' : `${crossings} cruce(s) detectado(s)`,
    },
    {
      label: 'Distancia entre puntos uniforme',
      ok: uniformity >= 0.5,
      detail: `Uniformidad ${(uniformity * 100).toFixed(0)}%`,
    },
    {
      label: 'Ningun par de puntos demasiado junto',
      ok: !tooClose,
      detail: `Separacion minima ${round(minObserved, 1)}px`,
    },
  ];

  return { passed: checks.every((c) => c.ok), checks };
}

export function renderConnectDots(data: ConnectDotsData): string {
  const {
    points, canvasW, canvasH, showNumbers, showGuide, closeShape,
    dotSize, fontSize, dotColor, numberColor, guideColor,
  } = data;
  const n = points.length;

  // centroide para ubicar los numeros hacia afuera
  const cx = points.reduce((s, p) => s + p.x, 0) / n;
  const cy = points.reduce((s, p) => s + p.y, 0) / n;

  let content = '';

  if (showGuide && n > 1) {
    let dPath = `M ${round(points[0].x)} ${round(points[0].y)}`;
    for (let i = 1; i < n; i++) dPath += ` L ${round(points[i].x)} ${round(points[i].y)}`;
    if (closeShape) dPath += ' Z';
    content += `<path d="${dPath}" fill="none" stroke="${guideColor}" stroke-width="${round(dotSize * 0.35)}" stroke-dasharray="${round(dotSize)} ${round(dotSize * 1.4)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // puntos
  for (let i = 0; i < n; i++) {
    const p = points[i];
    content += `<circle cx="${round(p.x)}" cy="${round(p.y)}" r="${round(dotSize)}" fill="${dotColor}"/>`;
    content += `<circle cx="${round(p.x)}" cy="${round(p.y)}" r="${round(dotSize * 0.4)}" fill="#ffffff"/>`;
  }

  // numeros
  if (showNumbers) {
    for (let i = 0; i < n; i++) {
      const p = points[i];
      let dx = p.x - cx;
      let dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const off = dotSize + fontSize * 0.75;
      const nx = p.x + (dx / len) * off;
      const ny = p.y + (dy / len) * off;
      content += `<text x="${round(nx)}" y="${round(ny + fontSize * 0.35)}" font-family="'Comic Sans MS','Baloo 2',system-ui,sans-serif" font-size="${round(fontSize)}" font-weight="700" fill="${numberColor}" text-anchor="middle">${i + 1}</text>`;
    }
  }

  return svgDocument(canvasW, canvasH, content);
}
