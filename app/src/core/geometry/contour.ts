import type { Point } from '../types';
import type { BinaryMask } from './imageProcessing';

// ============================================================================
// Trazado de contorno (Moore-neighbor boundary tracing).
// Dada una mascara binaria, devuelve el contorno exterior ordenado del blob
// mas grande como una polilinea cerrada de puntos. Es 100% geometrico.
// ============================================================================

const NEIGHBORS = [
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
];

function at(mask: BinaryMask, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return 0;
  return mask.data[y * mask.width + x];
}

/**
 * Traza el contorno exterior del primer blob encontrado (recorriendo de arriba
 * a abajo, izquierda a derecha). Se asume que ya se aislo el componente mas
 * grande. Devuelve puntos en orden a lo largo del borde.
 */
export function traceContour(mask: BinaryMask): Point[] {
  const { width: w, height: h } = mask;

  // Encontrar primer pixel de figura (arriba-izquierda).
  let startX = -1;
  let startY = -1;
  outer: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(mask, x, y) === 1) {
        startX = x;
        startY = y;
        break outer;
      }
    }
  }
  if (startX < 0) return [];

  const contour: Point[] = [];
  let cx = startX;
  let cy = startY;
  // Direccion de entrada inicial: veniamos desde la izquierda.
  let backtrackDir = 4; // apuntando a (-1,0)

  const maxSteps = w * h * 4;
  let steps = 0;

  do {
    contour.push({ x: cx, y: cy });
    // Buscar el siguiente pixel de borde girando en sentido horario a partir
    // de la direccion opuesta a la de entrada.
    let found = false;
    const startDir = (backtrackDir + 1) % 8;
    for (let i = 0; i < 8; i++) {
      const dir = (startDir + i) % 8;
      const nx = cx + NEIGHBORS[dir].dx;
      const ny = cy + NEIGHBORS[dir].dy;
      if (at(mask, nx, ny) === 1) {
        // La direccion de "backtrack" es la opuesta a como llegamos.
        backtrackDir = (dir + 4) % 8;
        cx = nx;
        cy = ny;
        found = true;
        break;
      }
    }
    if (!found) break; // pixel aislado
    steps++;
  } while ((cx !== startX || cy !== startY) && steps < maxSteps);

  return contour;
}

/** Perimetro total (longitud) de una polilinea (cerrada). */
export function polylineLength(pts: Point[], closed = true): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    len += dist(pts[i], pts[i + 1]);
  }
  if (closed && pts.length > 1) len += dist(pts[pts.length - 1], pts[0]);
  return len;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
