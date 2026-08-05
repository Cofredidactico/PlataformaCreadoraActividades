import type { Point } from '../types';
import { dist } from './contour';

// ============================================================================
// Simplificacion de polilineas (Ramer-Douglas-Peucker) + suavizado.
// Limpia el ruido del contorno para curvas mas prolijas antes de repartir los
// puntos. Puramente geometrico.
// ============================================================================

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return dist(p, a);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

/** Ramer-Douglas-Peucker para una polilinea abierta. */
export function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points.slice();
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[end]];
}

/** Simplifica una polilinea CERRADA preservando el cierre. */
export function simplifyClosed(points: Point[], epsilon: number): Point[] {
  if (points.length < 4) return points.slice();
  const open = points.concat([points[0]]);
  const simplified = rdp(open, epsilon);
  // quitar el punto duplicado del cierre
  if (simplified.length > 1) simplified.pop();
  return simplified;
}

/** Suavizado por promedio movil (Chaikin-lite) para una polilinea cerrada. */
export function smoothClosed(points: Point[], iterations = 1): Point[] {
  let pts = points.slice();
  for (let it = 0; it < iterations; it++) {
    const out: Point[] = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const cur = pts[i];
      const next = pts[(i + 1) % n];
      out.push({
        x: cur.x * 0.5 + prev.x * 0.25 + next.x * 0.25,
        y: cur.y * 0.5 + prev.y * 0.25 + next.y * 0.25,
      });
    }
    pts = out;
  }
  return pts;
}
