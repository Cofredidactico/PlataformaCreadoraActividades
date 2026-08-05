import type { GenerateContext, GeneratedActivity, Point } from '../../core/types';
import {
  imageToMask,
  keepLargestComponent,
  countComponents,
} from '../../core/geometry/imageProcessing';
import { traceContour } from '../../core/geometry/contour';
import { simplifyClosed, smoothClosed } from '../../core/geometry/simplify';
import { distributePoints } from '../../core/geometry/resample';
import { renderConnectDots, validate, type ConnectDotsData } from './render';

// ============================================================================
// Pipeline geometrico "Unir Puntos" (sin IA):
// 1 detectar contorno -> 2 vectorizar -> 3 limpiar curvas -> 4 medir longitud
// -> 5 distribuir N puntos -> 6 separacion uniforme -> 7 evitar cruces (por
// construccion sobre curva simple) -> 8 numerar -> 9 validar -> 10 exportar.
// ============================================================================

const LEVEL_PRESETS: Record<string, { epsilon: number; smooth: number }> = {
  facil: { epsilon: 3.5, smooth: 3 },
  medio: { epsilon: 2.2, smooth: 2 },
  dificil: { epsilon: 1.2, smooth: 1 },
};

export async function generateConnectDots(
  ctx: GenerateContext,
): Promise<GeneratedActivity<ConnectDotsData>> {
  const { image, config, onProgress } = ctx;
  if (!image) throw new Error('Este modulo necesita una imagen.');

  const count = Number(config.count ?? 20);
  const level = String(config.level ?? 'medio');
  const removeSmall = config.removeSmall !== false;
  const showNumbers = config.showNumbers !== false;
  const showGuide = config.showGuide !== false;
  const closeShape = config.closeShape !== false;
  const dotSizeCfg = Number(config.dotSize ?? 10);
  const preset = LEVEL_PRESETS[level] ?? LEVEL_PRESETS.medio;

  onProgress?.(0.1, 'Analizando imagen...');
  let mask = imageToMask(image.element);

  const warnings: string[] = [];
  const components = countComponents(mask);
  if (components > 6) {
    warnings.push(
      `La imagen tiene muchos detalles (${components} zonas). Se simplifico al contorno principal. Para mejores resultados usa una silueta clara.`,
    );
  }

  onProgress?.(0.3, 'Aislando figura principal...');
  if (removeSmall) mask = keepLargestComponent(mask);

  onProgress?.(0.45, 'Trazando contorno...');
  let contour = traceContour(mask);
  if (contour.length < 8) {
    throw new Error(
      'No se pudo detectar un contorno claro. Proba con una imagen de silueta simple sobre fondo liso.',
    );
  }

  onProgress?.(0.6, 'Vectorizando y limpiando curvas...');
  contour = simplifyClosed(contour, preset.epsilon);
  contour = smoothClosed(contour, preset.smooth);

  // Escalar el contorno (coords de mascara) a un lienzo de trabajo con margen
  // para que los numeros no se corten.
  const xs = contour.map((p) => p.x);
  const ys = contour.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const shapeW = Math.max(1, maxX - minX);
  const shapeH = Math.max(1, maxY - minY);
  const targetInner = 900;
  const scale = targetInner / Math.max(shapeW, shapeH);
  const pad = 90;
  const canvasW = Math.round(shapeW * scale + pad * 2);
  const canvasH = Math.round(shapeH * scale + pad * 2);
  const scaled: Point[] = contour.map((p) => ({
    x: (p.x - minX) * scale + pad,
    y: (p.y - minY) * scale + pad,
  }));

  onProgress?.(0.8, 'Distribuyendo puntos...');
  const { points, spacing } = distributePoints(scaled, count);

  const dotSize = (dotSizeCfg / 10) * Math.max(6, Math.min(16, canvasW / 90));
  const fontSize = dotSize * 2.4;

  const data: ConnectDotsData = {
    points,
    canvasW,
    canvasH,
    showNumbers,
    showGuide,
    closeShape,
    dotSize,
    minSpacing: spacing,
    fontSize,
    dotColor: '#1B3A6B',
    numberColor: '#E1306C',
    guideColor: '#B7C4D6',
  };

  onProgress?.(0.95, 'Validando...');
  const svg = renderConnectDots(data);
  const validation = validate(data);

  onProgress?.(1, 'Listo');
  return {
    svg,
    width: canvasW,
    height: canvasH,
    data,
    validation,
    supportsTransparent: true,
    warnings,
  };
}
