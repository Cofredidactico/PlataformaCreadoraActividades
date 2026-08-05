import type { GeneratedActivity } from './types';
import { escapeXml, round } from './svg';

// ============================================================================
// Marco editorial de cuadernillo (A4). Envuelve la actividad de CUALQUIER
// modulo en una hoja lista para imprimir: encabezado con titulo e
// instrucciones, campos Nombre/Fecha, logo opcional y pie de marca.
// La actividad se incrusta como <image> (data URI) para no mezclar arboles SVG.
// ============================================================================

export interface WorksheetOptions {
  enabled: boolean;
  title: string;
  instructions: string;
  nameDate: boolean;
  footer: string;
  accent: string;
  logo: string | null; // dataURL opcional
}

export function defaultWorksheet(title: string, instructions: string, accent: string): WorksheetOptions {
  return { enabled: false, title, instructions, nameDate: true, footer: 'Cofre Didáctico', accent, logo: null };
}

// A4 retrato en unidades SVG (x10 de mm) para buena resolucion.
const W = 2100;
const H = 2970;
const M = 120;

export function buildWorksheet(activity: GeneratedActivity, o: WorksheetOptions): { svg: string; width: number; height: number } {
  const accent = o.accent || '#6C5CE7';
  const topY = M;
  const logoW = o.logo ? 220 : 0;

  let c = '';
  // barra de acento superior
  c += `<rect x="0" y="0" width="${W}" height="24" fill="${accent}"/>`;

  // logo (derecha)
  if (o.logo) {
    c += `<image href="${o.logo}" x="${W - M - logoW}" y="${topY - 10}" width="${logoW}" height="140" preserveAspectRatio="xMidYMid meet"/>`;
  }

  // titulo
  c += `<text x="${M}" y="${topY + 60}" font-family="'Baloo 2',system-ui,sans-serif" font-size="72" font-weight="800" fill="#1B3A6B">${escapeXml(o.title)}</text>`;
  // instrucciones
  let cursorY = topY + 60;
  if (o.instructions) {
    cursorY += 62;
    c += `<text x="${M}" y="${cursorY}" font-family="'Baloo 2',system-ui,sans-serif" font-size="40" fill="#5b5d72">${escapeXml(o.instructions)}</text>`;
  }

  // linea Nombre / Fecha
  if (o.nameDate) {
    cursorY += 90;
    const lineY = cursorY;
    c += `<text x="${M}" y="${lineY}" font-family="'Baloo 2',system-ui,sans-serif" font-size="40" font-weight="700" fill="#1B3A6B">Nombre:</text>`;
    c += `<line x1="${M + 190}" y1="${lineY + 8}" x2="${M + 900}" y2="${lineY + 8}" stroke="#9aa0b4" stroke-width="3"/>`;
    c += `<text x="${M + 1000}" y="${lineY}" font-family="'Baloo 2',system-ui,sans-serif" font-size="40" font-weight="700" fill="#1B3A6B">Fecha:</text>`;
    c += `<line x1="${M + 1150}" y1="${lineY + 8}" x2="${W - M}" y2="${lineY + 8}" stroke="#9aa0b4" stroke-width="3"/>`;
  } else {
    cursorY += 20;
  }

  // area del cuerpo
  const bodyTop = cursorY + 60;
  const footerH = 90;
  const bodyBottom = H - M - footerH;
  const bodyW = W - M * 2;
  const bodyH = bodyBottom - bodyTop;

  // fit contain de la actividad dentro del cuerpo
  const ar = activity.width / activity.height;
  let aw = bodyW, ah = bodyW / ar;
  if (ah > bodyH) { ah = bodyH; aw = bodyH * ar; }
  const ax = M + (bodyW - aw) / 2;
  const ay = bodyTop + (bodyH - ah) / 2;
  const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    activity.svg.includes('xmlns') ? activity.svg : activity.svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'),
  );
  c += `<image href="${dataUri}" x="${round(ax)}" y="${round(ay)}" width="${round(aw)}" height="${round(ah)}" preserveAspectRatio="xMidYMid meet"/>`;

  // pie
  const fy = H - M + 10;
  c += `<line x1="${M}" y1="${fy - 40}" x2="${W - M}" y2="${fy - 40}" stroke="#e4e6f0" stroke-width="2"/>`;
  c += `<text x="${W / 2}" y="${fy}" font-family="'Baloo 2',system-ui,sans-serif" font-size="34" font-weight="700" fill="${accent}" text-anchor="middle">${escapeXml(o.footer)}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect id="__bg" x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>${c}</svg>`;
  return { svg, width: W, height: H };
}

/** Envuelve una actividad en una pseudo-actividad enmarcada, lista para exportar. */
export function framedActivity(activity: GeneratedActivity, o: WorksheetOptions): GeneratedActivity {
  const { svg, width, height } = buildWorksheet(activity, o);
  return { svg, width, height, data: null, validation: activity.validation, supportsTransparent: false };
}
