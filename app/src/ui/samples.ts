import type { SourceImage } from '../core/types';
import { loadImage } from '../core/geometry/imageProcessing';

// ============================================================================
// Biblioteca de siluetas de ejemplo (para probar sin subir imagen).
// Cada silueta es un SVG de figuras negras sobre fondo transparente; se
// rasteriza a un dataURL y se entrega como SourceImage.
// ============================================================================

function starPoints(cx: number, cy: number, outer: number, inner: number, spikes = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

function flowerShapes(): string {
  let s = '';
  const cx = 200, cy = 200, R = 95, pr = 62;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    s += `<circle cx="${(cx + Math.cos(a) * R).toFixed(1)}" cy="${(cy + Math.sin(a) * R).toFixed(1)}" r="${pr}"/>`;
  }
  s += `<circle cx="${cx}" cy="${cy}" r="70"/>`;
  return s;
}

interface Sample { name: string; emoji: string; shapes: string; }

const SAMPLES: Sample[] = [
  { name: 'Estrella', emoji: '⭐', shapes: `<polygon points="${starPoints(200, 200, 175, 72)}"/>` },
  {
    name: 'Corazón', emoji: '❤️',
    shapes: `<path d="M200 340 C 55 235, 55 105, 150 105 C 185 105, 200 135, 200 160 C 200 135, 215 105, 250 105 C 345 105, 345 235, 200 340 Z"/>`,
  },
  {
    name: 'Casa', emoji: '🏠',
    shapes: `<rect x="118" y="185" width="164" height="150" rx="6"/><polygon points="96,190 200,80 304,190"/>`,
  },
  {
    name: 'Pez', emoji: '🐟',
    shapes: `<ellipse cx="185" cy="200" rx="115" ry="72"/><polygon points="275,200 350,145 350,255"/>`,
  },
  {
    name: 'Nube', emoji: '☁️',
    shapes: `<circle cx="145" cy="225" r="58"/><circle cx="205" cy="185" r="78"/><circle cx="278" cy="222" r="60"/><rect x="145" y="215" width="133" height="62" rx="10"/>`,
  },
  { name: 'Flor', emoji: '🌸', shapes: flowerShapes() },
];

function toSvg(shapes: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><g fill="#111">${shapes}</g></svg>`;
}

/** Devuelve las siluetas (formas negras) para reutilizar como distractores. */
export function sampleSilhouettes(): { name: string; shapes: string }[] {
  return SAMPLES.map((s) => ({ name: s.name, shapes: s.shapes }));
}

export interface SampleEntry { name: string; emoji: string; thumb: string; }

export function sampleList(): SampleEntry[] {
  return SAMPLES.map((s) => ({
    name: s.name,
    emoji: s.emoji,
    thumb: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(toSvg(s.shapes)),
  }));
}

export async function loadSample(name: string): Promise<SourceImage> {
  const s = SAMPLES.find((x) => x.name === name)!;
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(toSvg(s.shapes));
  // rasterizar a PNG para que el pipeline de mascara trabaje sobre pixeles
  const svgImg = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 400;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(svgImg, 0, 0, 400, 400);
  const png = canvas.toDataURL('image/png');
  const element = await loadImage(png);
  return { src: png, width: 400, height: 400, element };
}
