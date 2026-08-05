import type { SourceImage } from '../types';

// ============================================================================
// Procesamiento de imagen -> mascara binaria.
// Convierte una imagen (con o sin transparencia) en una matriz binaria donde
// 1 = figura (tinta) y 0 = fondo. Es la base para detectar el contorno.
// Todo se hace en un canvas, en el navegador, sin IA.
// ============================================================================

export interface BinaryMask {
  data: Uint8Array; // 0 o 1, fila por fila
  width: number;
  height: number;
}

/** Carga un dataURL/URL a un HTMLImageElement decodificado. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function fileToSourceImage(file: File): Promise<SourceImage> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const element = await loadImage(src);
  return { src, width: element.naturalWidth, height: element.naturalHeight, element };
}

/**
 * Construye una mascara binaria a partir de la imagen.
 * Estrategia:
 *  - Si la imagen tiene transparencia significativa -> figura = pixeles opacos.
 *  - Si no -> se estima el color de fondo (esquinas) y figura = pixeles que
 *    difieren del fondo (tinta sobre papel).
 * `maxDim` reduce la resolucion de trabajo para que el trazado sea rapido.
 */
export function imageToMask(img: HTMLImageElement, maxDim = 520): BinaryMask {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const { data: px } = ctx.getImageData(0, 0, w, h);

  // Detectar si hay transparencia real.
  let transparentPixels = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 200) transparentPixels++;
  const hasAlpha = transparentPixels > w * h * 0.03;

  const mask = new Uint8Array(w * h);

  if (hasAlpha) {
    for (let p = 0, i = 3; p < w * h; p++, i += 4) {
      mask[p] = px[i] > 128 ? 1 : 0;
    }
  } else {
    // Estimar color de fondo promediando las 4 esquinas.
    const corners = [
      0,
      (w - 1) * 4,
      (h - 1) * w * 4,
      ((h - 1) * w + (w - 1)) * 4,
    ];
    let br = 0, bg = 0, bb = 0;
    for (const c of corners) {
      br += px[c];
      bg += px[c + 1];
      bb += px[c + 2];
    }
    br /= 4; bg /= 4; bb /= 4;
    // Umbral por distancia de color al fondo.
    const threshold = 60;
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const dr = px[i] - br;
      const dg = px[i + 1] - bg;
      const db = px[i + 2] - bb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      mask[p] = dist > threshold ? 1 : 0;
    }
  }

  return { data: mask, width: w, height: h };
}

/**
 * Conserva solo el componente conexo mas grande (elimina detalles/manchas
 * pequeñas). Devuelve una nueva mascara. Usa 4-conectividad flood fill.
 */
export function keepLargestComponent(mask: BinaryMask): BinaryMask {
  const { data, width: w, height: h } = mask;
  const labels = new Int32Array(w * h).fill(0);
  let current = 0;
  let bestLabel = 0;
  let bestSize = 0;
  const stack: number[] = [];

  for (let start = 0; start < w * h; start++) {
    if (data[start] !== 1 || labels[start] !== 0) continue;
    current++;
    let size = 0;
    stack.push(start);
    labels[start] = current;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      const neigh = [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ];
      for (const n of neigh) {
        if (n >= 0 && data[n] === 1 && labels[n] === 0) {
          labels[n] = current;
          stack.push(n);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = current;
    }
  }

  const out = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) out[p] = labels[p] === bestLabel ? 1 : 0;
  return { data: out, width: w, height: h };
}

/** Cuenta cuantos componentes conexos (>minSize) hay: mide "complejidad". */
export function countComponents(mask: BinaryMask, minSize = 12): number {
  const { data, width: w, height: h } = mask;
  const seen = new Uint8Array(w * h);
  let count = 0;
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (data[start] !== 1 || seen[start]) continue;
    let size = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      const neigh = [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ];
      for (const n of neigh) {
        if (n >= 0 && data[n] === 1 && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (size >= minSize) count++;
  }
  return count;
}
