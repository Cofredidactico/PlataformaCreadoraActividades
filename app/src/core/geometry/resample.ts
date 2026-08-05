import type { Point } from '../types';
import { dist, polylineLength } from './contour';

// ============================================================================
// Remuestreo por longitud de arco.
// Reparte EXACTAMENTE N puntos a lo largo de una polilinea cerrada, todos a la
// misma distancia (uniforme). Al estar sobre una curva cerrada simple y en
// orden, unir puntos consecutivos NUNCA produce cruces. Pura geometria.
// ============================================================================

export interface DistributeResult {
  points: Point[];
  /** distancia teorica entre puntos consecutivos (perimetro / N). */
  spacing: number;
  /** distancia real minima observada entre puntos consecutivos. */
  minSpacing: number;
}

/**
 * Distribuye N puntos equiespaciados por longitud de arco sobre una polilinea
 * cerrada. Comienza en el punto de la polilinea mas cercano al "top" (el mas
 * alto), para que el numero 1 quede arriba, que es lo natural para un niño.
 */
export function distributePoints(contour: Point[], n: number): DistributeResult {
  if (contour.length < 2 || n < 2) {
    return { points: contour.slice(0, n), spacing: 0, minSpacing: 0 };
  }

  // Rotar el contorno para empezar por el punto mas alto (menor y).
  let startIdx = 0;
  for (let i = 1; i < contour.length; i++) {
    if (contour[i].y < contour[startIdx].y) startIdx = i;
  }
  const rotated = contour.slice(startIdx).concat(contour.slice(0, startIdx));

  const perimeter = polylineLength(rotated, true);
  const spacing = perimeter / n;

  // Precalcular distancias acumuladas incluyendo el segmento de cierre.
  const closed = rotated.concat([rotated[0]]);
  const cum: number[] = [0];
  for (let i = 1; i < closed.length; i++) {
    cum.push(cum[i - 1] + dist(closed[i - 1], closed[i]));
  }

  const points: Point[] = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const target = k * spacing;
    while (seg < closed.length - 2 && cum[seg + 1] < target) seg++;
    const segLen = cum[seg + 1] - cum[seg];
    const t = segLen === 0 ? 0 : (target - cum[seg]) / segLen;
    const a = closed[seg];
    const b = closed[seg + 1];
    points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }

  // Medir separacion real minima (deberia ser ~= spacing).
  let minSpacing = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = dist(points[i], points[(i + 1) % points.length]);
    if (d < minSpacing) minSpacing = d;
  }

  return { points, spacing, minSpacing };
}
