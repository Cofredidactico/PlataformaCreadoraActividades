import { jsPDF } from 'jspdf';
import type { GeneratedActivity } from '../types';

// ============================================================================
// Pipeline de exportacion generico y unico para TODOS los modulos.
// El SVG es la fuente de verdad. De ahi derivamos:
//   - SVG          (vectorial)
//   - PNG 300 DPI  (rasterizado de alta calidad)
//   - PDF A4       (imagen 300dpi centrada en hoja A4)
// Soporta fondo transparente quitando el rect de fondo (id="__bg").
// ============================================================================

const DPI = 300;
const MM_PER_INCH = 25.4;
// A4 en px a 300 DPI (retrato).
const A4 = {
  wPx: Math.round((210 / MM_PER_INCH) * DPI), // 2480
  hPx: Math.round((297 / MM_PER_INCH) * DPI), // 3508
  wMm: 210,
  hMm: 297,
};
const MARGIN_MM = 12;

function stripBackground(svg: string): string {
  // Quita el rect de fondo marcado con id="__bg".
  return svg.replace(/<rect[^>]*id="__bg"[^>]*\/>/, '').replace(/<rect[^>]*id="__bg"[^>]*><\/rect>/, '');
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Rasteriza un SVG (string) a un canvas de outW x outH px (contain, centrado). */
function svgToCanvas(
  svg: string,
  outW: number,
  outH: number,
  background: string | null,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, outW, outH);
    }
    const svg64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = new Image();
    img.onload = () => {
      // contain
      const ar = img.width / img.height;
      const outAr = outW / outH;
      let dw = outW;
      let dh = outH;
      if (ar > outAr) {
        dh = outW / ar;
      } else {
        dw = outH * ar;
      }
      const dx = (outW - dw) / 2;
      const dy = (outH - dh) / 2;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, dx, dy, dw, dh);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = svg64;
  });
}

/** Asegura que el SVG tenga width/height/xmlns para rasterizar bien. */
function normalizeSvg(activity: GeneratedActivity, transparent: boolean): string {
  let svg = transparent && activity.supportsTransparent
    ? stripBackground(activity.svg)
    : activity.svg;
  if (!/xmlns=/.test(svg)) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

export async function exportSVG(
  activity: GeneratedActivity,
  filename: string,
  transparent: boolean,
): Promise<void> {
  const svg = normalizeSvg(activity, transparent);
  download(new Blob([svg], { type: 'image/svg+xml' }), `${filename}.svg`);
}

/** PNG a 300 DPI, dimensionado al area imprimible A4 (contain). */
export async function exportPNG(
  activity: GeneratedActivity,
  filename: string,
  transparent: boolean,
): Promise<void> {
  const printableW = A4.wPx - Math.round((MARGIN_MM / MM_PER_INCH) * DPI) * 2;
  const printableH = A4.hPx - Math.round((MARGIN_MM / MM_PER_INCH) * DPI) * 2;
  const ar = activity.width / activity.height;
  let outW = printableW;
  let outH = Math.round(printableW / ar);
  if (outH > printableH) {
    outH = printableH;
    outW = Math.round(printableH * ar);
  }
  const svg = normalizeSvg(activity, transparent);
  const canvas = await svgToCanvas(svg, outW, outH, transparent && activity.supportsTransparent ? null : '#ffffff');
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
  download(blob, `${filename}.png`);
}

/** PDF A4 con la actividad centrada a 300 DPI. */
export async function exportPDF(
  activity: GeneratedActivity,
  filename: string,
): Promise<void> {
  const printableWmm = A4.wMm - MARGIN_MM * 2;
  const printableHmm = A4.hMm - MARGIN_MM * 2;
  const ar = activity.width / activity.height;
  let wMm = printableWmm;
  let hMm = printableWmm / ar;
  if (hMm > printableHmm) {
    hMm = printableHmm;
    wMm = printableHmm * ar;
  }
  // Rasterizar a la resolucion 300dpi correspondiente a ese tamaño en mm.
  const outW = Math.round((wMm / MM_PER_INCH) * DPI);
  const outH = Math.round((hMm / MM_PER_INCH) * DPI);
  const svg = normalizeSvg(activity, false);
  const canvas = await svgToCanvas(svg, outW, outH, '#ffffff');
  const dataUrl = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const x = (A4.wMm - wMm) / 2;
  const y = (A4.hMm - hMm) / 2;
  pdf.addImage(dataUrl, 'PNG', x, y, wMm, hMm);
  pdf.save(`${filename}.pdf`);
}

export type ExportFormat = 'png' | 'pdf' | 'svg';
