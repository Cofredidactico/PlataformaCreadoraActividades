import { useRef, useState } from 'react';
import type {
  ActivityPlugin,
  EditorProps,
  GeneratedActivity,
  Point,
} from '../../core/types';
import { generateConnectDots } from './generate';
import { renderConnectDots, validate, type ConnectDotsData } from './render';
import { dist } from '../../core/geometry/contour';

// Reconstruye una actividad completa a partir de datos editados.
function rebuild(data: ConnectDotsData): GeneratedActivity<ConnectDotsData> {
  return {
    svg: renderConnectDots(data),
    width: data.canvasW,
    height: data.canvasH,
    data,
    validation: validate(data),
    supportsTransparent: true,
  };
}

type Mode = 'move' | 'add' | 'delete';

function ConnectDotsEditor({ activity, onChange }: EditorProps<ConnectDotsData>) {
  const data = activity.data;
  const svgRef = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<Mode>('move');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const toSvg = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = pt.matrixTransform(ctm.inverse());
    return { x: inv.x, y: inv.y };
  };

  const update = (points: Point[]) => onChange(rebuild({ ...data, points }));
  const patch = (p: Partial<ConnectDotsData>) => onChange(rebuild({ ...data, ...p }));

  const onPointerDownDot = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (mode === 'delete') {
      if (data.points.length > 3) {
        const pts = data.points.slice();
        pts.splice(i, 1);
        update(pts);
      }
      return;
    }
    if (mode === 'move') {
      (e.target as Element).setPointerCapture(e.pointerId);
      setDragIdx(i);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const p = toSvg(e.clientX, e.clientY);
    const pts = data.points.slice();
    pts[dragIdx] = p;
    update(pts);
  };

  const onPointerUp = () => setDragIdx(null);

  const onCanvasClick = (e: React.PointerEvent) => {
    if (mode !== 'add') return;
    const p = toSvg(e.clientX, e.clientY);
    // insertar en la posicion de la secuencia mas cercana (menor incremento de
    // recorrido) para mantener el orden y evitar cruces.
    const pts = data.points;
    let bestIdx = pts.length;
    let bestCost = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const cost = dist(a, p) + dist(p, b) - dist(a, b);
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i + 1;
      }
    }
    const next = pts.slice();
    next.splice(bestIdx, 0, p);
    update(next);
  };

  const d = data;
  const cx = d.points.reduce((s, p) => s + p.x, 0) / d.points.length;
  const cy = d.points.reduce((s, p) => s + p.y, 0) / d.points.length;

  let guide = '';
  if (d.showGuide && d.points.length > 1) {
    guide = `M ${d.points[0].x} ${d.points[0].y}` +
      d.points.slice(1).map((p) => ` L ${p.x} ${p.y}`).join('') +
      (d.closeShape ? ' Z' : '');
  }

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <div className="tool-group">
          <button className={`tool ${mode === 'move' ? 'active' : ''}`} onClick={() => setMode('move')} title="Mover puntos">✥ Mover</button>
          <button className={`tool ${mode === 'add' ? 'active' : ''}`} onClick={() => setMode('add')} title="Agregar punto">＋ Agregar</button>
          <button className={`tool ${mode === 'delete' ? 'active' : ''}`} onClick={() => setMode('delete')} title="Eliminar punto">🗑 Eliminar</button>
        </div>
        <div className="tool-group">
          <label className="mini-toggle">
            <input type="checkbox" checked={d.showNumbers} onChange={(e) => patch({ showNumbers: e.target.checked })} /> Números
          </label>
          <label className="mini-toggle">
            <input type="checkbox" checked={d.showGuide} onChange={(e) => patch({ showGuide: e.target.checked })} /> Guía
          </label>
          <label className="mini-toggle">
            <input type="checkbox" checked={d.closeShape} onChange={(e) => patch({ closeShape: e.target.checked })} /> Cerrar
          </label>
        </div>
        <div className="tool-group">
          <label className="mini-slider">Punto
            <input type="range" min={4} max={22} step={1} value={d.dotSize} onChange={(e) => patch({ dotSize: Number(e.target.value) })} />
          </label>
          <label className="mini-slider">N°
            <input type="range" min={12} max={60} step={1} value={d.fontSize} onChange={(e) => patch({ fontSize: Number(e.target.value) })} />
          </label>
          <input type="color" value={d.numberColor} onChange={(e) => patch({ numberColor: e.target.value })} title="Color de números" />
          <input type="color" value={d.dotColor} onChange={(e) => patch({ dotColor: e.target.value })} title="Color de puntos" />
        </div>
      </div>

      <div className={`editor-canvas mode-${mode}`}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${d.canvasW} ${d.canvasH}`}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerDown={onCanvasClick}
        >
          <rect x={0} y={0} width={d.canvasW} height={d.canvasH} fill="#ffffff" />
          {guide && (
            <path d={guide} fill="none" stroke={d.guideColor} strokeWidth={d.dotSize * 0.35}
              strokeDasharray={`${d.dotSize} ${d.dotSize * 1.4}`} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {d.points.map((p, i) => (
            <g key={i} className="dot-handle" onPointerDown={onPointerDownDot(i)} style={{ cursor: mode === 'move' ? 'grab' : mode === 'delete' ? 'not-allowed' : 'copy' }}>
              <circle cx={p.x} cy={p.y} r={d.dotSize * 2.2} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={d.dotSize} fill={d.dotColor} />
              <circle cx={p.x} cy={p.y} r={d.dotSize * 0.4} fill="#fff" />
            </g>
          ))}
          {d.showNumbers && d.points.map((p, i) => {
            const dx = p.x - cx, dy = p.y - cy;
            const len = Math.hypot(dx, dy) || 1;
            const off = d.dotSize + d.fontSize * 0.75;
            return (
              <text key={`n${i}`} x={p.x + (dx / len) * off} y={p.y + (dy / len) * off + d.fontSize * 0.35}
                fontFamily="'Comic Sans MS','Baloo 2',system-ui,sans-serif" fontSize={d.fontSize}
                fontWeight={700} fill={d.numberColor} textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {i + 1}
              </text>
            );
          })}
        </svg>
      </div>
      <p className="editor-hint">
        {mode === 'move' && 'Arrastrá cualquier punto para reubicarlo.'}
        {mode === 'add' && 'Hacé clic en el lienzo para agregar un punto (se inserta en el mejor lugar de la secuencia).'}
        {mode === 'delete' && 'Hacé clic en un punto para eliminarlo.'}
      </p>
    </div>
  );
}

export const connectDotsPlugin: ActivityPlugin<ConnectDotsData> = {
  id: 'connect-dots',
  name: 'Unir Puntos',
  tagline: 'Convierte una imagen en un dibujo para unir puntos numerados.',
  icon: '✏️',
  accent: '#6C5CE7',
  ageRange: '4 a 8 años',
  requiresImage: true,
  status: 'ready',
  configFields: [
    {
      type: 'select', key: 'count', label: 'Cantidad de puntos', default: '20',
      options: ['10', '15', '20', '25', '30', '40', '50', '75', '100'].map((v) => ({ value: v, label: v })),
      help: 'Más puntos = más difícil.',
    },
    {
      type: 'select', key: 'level', label: 'Nivel', default: 'medio',
      options: [
        { value: 'facil', label: 'Fácil (líneas suaves)' },
        { value: 'medio', label: 'Medio' },
        { value: 'dificil', label: 'Difícil (más detalle)' },
      ],
    },
    { type: 'slider', key: 'dotSize', label: 'Tamaño del punto', min: 4, max: 20, step: 1, default: 10 },
    { type: 'toggle', key: 'showNumbers', label: 'Mostrar números', default: true },
    { type: 'toggle', key: 'showGuide', label: 'Mostrar línea guía', default: false },
    { type: 'toggle', key: 'closeShape', label: 'Cerrar la figura', default: true },
    { type: 'toggle', key: 'removeSmall', label: 'Eliminar detalles pequeños', default: true },
  ],
  generate: generateConnectDots,
  Editor: ConnectDotsEditor,
};
