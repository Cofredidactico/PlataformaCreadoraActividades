// Pequeñas utilidades para construir SVG como string de forma segura.

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function round(n: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

/** Envuelve contenido en un <svg> con viewBox y un fondo opcional (id __bg). */
export function svgDocument(
  width: number,
  height: number,
  content: string,
  background = '#ffffff',
): string {
  const bg = `<rect id="__bg" x="0" y="0" width="${width}" height="${height}" fill="${background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bg}${content}</svg>`;
}
