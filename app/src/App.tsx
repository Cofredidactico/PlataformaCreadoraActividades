import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from './ui/useTheme';
import { getPlugins, getPlugin } from './core/registry';
import type {
  ActivityPlugin,
  ConfigValues,
  GeneratedActivity,
  SourceImage,
} from './core/types';
import { ImageDropzone } from './ui/ImageDropzone';
import { ConfigPanel } from './ui/ConfigPanel';
import { exportPNG, exportPDF, exportSVG } from './core/exporters';
import { loadImage } from './core/geometry/imageProcessing';
import { listProjects, saveProject, deleteProject, type Project } from './core/projects';
import { defaultWorksheet, framedActivity, type WorksheetOptions } from './core/worksheet';

function defaultsFor(plugin: ActivityPlugin): ConfigValues {
  const v: ConfigValues = {};
  for (const f of plugin.configFields) v[f.key] = f.default;
  return v;
}

const INSTRUCTIONS: Record<string, string> = {
  'connect-dots': 'Uní los puntos en orden, del 1 al final.',
  'tracing': 'Repasá la figura punteada con el lápiz.',
  'word-search': 'Encontrá y marcá todas las palabras de la lista.',
  'maze': 'Ayudá al ratón a llegar hasta el queso.',
  'jigsaw': 'Recortá las piezas y armá el rompecabezas.',
  'memory': 'Recortá las cartas y jugá a encontrar los pares.',
  'shadows': 'Uní cada objeto con su sombra correcta.',
  'color-numbers': 'Pintá cada zona con el color que indica su número.',
};
const instructionsFor = (id: string) => INSTRUCTIONS[id] ?? 'Completá la actividad.';

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const plugins = useMemo(() => getPlugins(), []);
  const [view, setView] = useState<'gallery' | 'workspace'>('gallery');
  const [pluginId, setPluginId] = useState<string | null>(null);
  const [image, setImage] = useState<SourceImage | null>(null);
  const [config, setConfig] = useState<ConfigValues>({});
  const [activity, setActivity] = useState<GeneratedActivity | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ p: number; msg: string }>({ p: 0, msg: '' });
  const [error, setError] = useState('');
  const [transparent, setTransparent] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [worksheet, setWorksheet] = useState<WorksheetOptions>(defaultWorksheet('', '', '#6C5CE7'));
  const [previewMode, setPreviewMode] = useState<'editar' | 'hoja'>('editar');

  // Historial para deshacer/rehacer.
  const past = useRef<GeneratedActivity[]>([]);
  const future = useRef<GeneratedActivity[]>([]);
  const lastChangeAt = useRef(0);
  const [, forceRender] = useState(0);

  const plugin = pluginId ? getPlugin(pluginId) : null;

  useEffect(() => { setProjects(listProjects()); }, [view]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const resetHistory = () => { past.current = []; future.current = []; };

  // Cambios desde el editor: se agrupan los rapidos (arrastres) en un solo paso.
  const commitActivity = (next: GeneratedActivity) => {
    const now = Date.now();
    if (activity && now - lastChangeAt.current > 500) {
      past.current.push(activity);
      future.current = [];
    }
    lastChangeAt.current = now;
    setActivity(next);
  };

  const undo = () => {
    if (!past.current.length || !activity) return;
    future.current.push(activity);
    const prev = past.current.pop()!;
    lastChangeAt.current = 0;
    setActivity(prev);
    forceRender((n) => n + 1);
  };
  const redo = () => {
    if (!future.current.length || !activity) return;
    past.current.push(activity);
    const nxt = future.current.pop()!;
    lastChangeAt.current = 0;
    setActivity(nxt);
    forceRender((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const openPlugin = (p: ActivityPlugin) => {
    if (p.status === 'soon') return;
    setPluginId(p.id);
    setConfig(defaultsFor(p));
    setImage(null);
    setActivity(null);
    setError('');
    setZoom(1);
    setProjectId(undefined);
    setWorksheet(defaultWorksheet(p.name, instructionsFor(p.id), p.accent));
    setPreviewMode('editar');
    resetHistory();
    setView('workspace');
  };

  const goHome = () => { setView('gallery'); setPluginId(null); setActivity(null); };

  const runGenerate = async () => {
    if (!plugin) return;
    setError('');
    if (plugin.requiresImage && !image) { setError('Primero subí una imagen o elegí un ejemplo.'); return; }
    setGenerating(true);
    setActivity(null);
    resetHistory();
    setZoom(1);
    setProgress({ p: 0, msg: 'Iniciando...' });
    try {
      await new Promise((r) => setTimeout(r, 30));
      const result = await plugin.generate({
        image,
        config,
        onProgress: (p, msg) => setProgress({ p, msg: msg ?? '' }),
      });
      setActivity(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error al generar la actividad.');
    } finally {
      setGenerating(false);
    }
  };

  const doExport = async (fmt: 'png' | 'pdf' | 'svg') => {
    if (!activity || !plugin) return;
    const name = `${plugin.id}-cofre`;
    const target = worksheet.enabled ? framedActivity(activity, worksheet) : activity;
    const tr = worksheet.enabled ? false : transparent;
    if (fmt === 'png') await exportPNG(target, name, tr);
    else if (fmt === 'pdf') await exportPDF(target, name);
    else await exportSVG(target, name, tr);
  };

  const onLogoFile = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setWorksheet((w) => ({ ...w, logo: r.result as string }));
    r.readAsDataURL(file);
  };

  const doSaveProject = () => {
    if (!plugin) return;
    const name = plugin.name + ' · ' + new Date().toLocaleDateString('es-AR');
    const saved = saveProject({ id: projectId, name, pluginId: plugin.id, config, imageSrc: image?.src ?? null, activity });
    setProjectId(saved.id);
    setProjects(listProjects());
    flash('Proyecto guardado ✓');
  };

  const openProject = async (p: Project) => {
    const pl = getPlugin(p.pluginId);
    if (!pl) return;
    setPluginId(p.pluginId);
    setConfig(p.config);
    setActivity(p.activity);
    setProjectId(p.id);
    setError('');
    setZoom(1);
    setWorksheet(defaultWorksheet(pl.name, instructionsFor(pl.id), pl.accent));
    setPreviewMode('editar');
    resetHistory();
    if (p.imageSrc) {
      try {
        const el = await loadImage(p.imageSrc);
        setImage({ src: p.imageSrc, width: el.naturalWidth, height: el.naturalHeight, element: el });
      } catch { setImage(null); }
    } else setImage(null);
    setView('workspace');
  };

  const canExport = activity?.validation.passed ?? false;
  const steps = plugin?.requiresImage
    ? ['Imagen', 'Configurar', 'Generar', 'Editar', 'Exportar']
    : ['Configurar', 'Generar', 'Editar', 'Exportar'];
  const currentStep = !activity ? (plugin?.requiresImage && !image ? 0 : plugin?.requiresImage ? 1 : 0) : steps.length - 2;

  const Editor = plugin?.Editor;
  const readyCount = plugins.filter((p) => p.status === 'ready').length;

  return (
    <>
      <header className="topbar">
        <div className="brand" onClick={goHome}>
          <div className="logo">✨</div>
          <div>
            Cofre Actividades
            <small>Generador de recursos didácticos</small>
          </div>
        </div>
        <div className="topbar-actions">
          {view === 'workspace' && <button className="btn btn-ghost" onClick={goHome}>← Módulos</button>}
          <button className="icon-btn" onClick={toggleTheme} title="Cambiar tema">{theme === 'light' ? '🌙' : '☀️'}</button>
        </div>
      </header>

      {view === 'gallery' && (
        <>
          <section className="hero">
            <h1>Creá <span>actividades didácticas</span> imprimibles en minutos</h1>
            <p>Subí una imagen, elegí una actividad y exportá en PNG 300 DPI, PDF A4 o SVG. {readyCount} módulos listos, con validación automática de cada recurso.</p>
          </section>

          {projects.length > 0 && (
            <section className="recent">
              <h2 className="section-title">Mis proyectos</h2>
              <div className="recent-row">
                {projects.slice(0, 8).map((p) => (
                  <div key={p.id} className="recent-card" onClick={() => openProject(p)}>
                    <div className="recent-thumb" dangerouslySetInnerHTML={{ __html: p.activity?.svg ?? '' }} />
                    <div className="recent-meta">
                      <strong>{getPlugin(p.pluginId)?.name ?? p.pluginId}</strong>
                      <small>{new Date(p.updatedAt).toLocaleDateString('es-AR')}</small>
                    </div>
                    <button className="recent-del" title="Eliminar" onClick={(e) => { e.stopPropagation(); deleteProject(p.id); setProjects(listProjects()); }}>✕</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="gallery">
            {plugins.map((p) => (
              <div key={p.id} className={`card ${p.status === 'soon' ? 'soon' : ''}`} onClick={() => openPlugin(p)} style={{ borderTopColor: p.accent }}>
                {p.status === 'soon' && <span className="badge-soon">PRONTO</span>}
                <div className="ic" style={{ background: p.accent }}>{p.icon}</div>
                <h3>{p.name}</h3>
                <p>{p.tagline}</p>
                <div className="meta">
                  <span className="tag age">{p.ageRange}</span>
                  <span className="tag">{p.requiresImage ? 'Usa imagen' : 'Sin imagen'}</span>
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {view === 'workspace' && plugin && (
        <div className="workspace">
          <aside className="sidebar">
            <button className="back-link" onClick={goHome}>← Todos los módulos</button>
            <h2><span>{plugin.icon}</span> {plugin.name}</h2>
            <p className="sub">{plugin.tagline}</p>

            <div className="stepper">
              {steps.map((s, i) => (
                <span key={s} className={`step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}`}>{s}</span>
              ))}
            </div>

            {plugin.requiresImage && (
              <div className="field">
                <label>1 · Imagen de entrada</label>
                <ImageDropzone image={image} onImage={setImage} />
              </div>
            )}

            <div className="divider" />
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12 }}>
              {plugin.requiresImage ? '2 · ' : '1 · '}Configuración
            </label>
            <ConfigPanel fields={plugin.configFields} values={config} onChange={(k, v) => setConfig((c) => ({ ...c, [k]: v }))} />

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={runGenerate} disabled={generating}>
              {generating ? 'Generando…' : activity ? '↻ Regenerar' : '✨ Generar actividad'}
            </button>

            {generating && (
              <div className="progress">
                <div className="bar"><div style={{ width: `${Math.round(progress.p * 100)}%` }} /></div>
                <div className="lbl">{progress.msg}</div>
              </div>
            )}

            {error && <div className="warn-box" style={{ borderColor: 'var(--err)', background: 'color-mix(in srgb, var(--err) 12%, transparent)' }}>⚠️ {error}</div>}

            {activity && (
              <>
                <div className="divider" />
                <div className="validation">
                  <h4>✅ Validación automática</h4>
                  {activity.validation.checks.map((c, i) => (
                    <div key={i} className={`check ${c.ok ? 'ok' : 'bad'}`}>
                      <span className="mk">{c.ok ? '✓' : '✕'}</span>
                      <span>{c.label}{c.detail && <span className="detail"> — {c.detail}</span>}</span>
                    </div>
                  ))}
                  {activity.warnings?.map((w, i) => <div key={i} className="warn-box">💡 {w}</div>)}
                </div>

                <div className="divider" />
                <div className="switch" style={{ marginBottom: worksheet.enabled ? 12 : 0 }}>
                  <label htmlFor="ws">📄 Hoja de cuadernillo</label>
                  <input id="ws" type="checkbox" checked={worksheet.enabled} onChange={(e) => { setWorksheet((w) => ({ ...w, enabled: e.target.checked })); setPreviewMode(e.target.checked ? 'hoja' : 'editar'); }} />
                </div>
                {worksheet.enabled && (
                  <div className="ws-panel">
                    <div className="field"><label>Título</label><input type="text" value={worksheet.title} onChange={(e) => setWorksheet((w) => ({ ...w, title: e.target.value }))} /></div>
                    <div className="field"><label>Instrucciones</label><input type="text" value={worksheet.instructions} onChange={(e) => setWorksheet((w) => ({ ...w, instructions: e.target.value }))} /></div>
                    <div className="switch" style={{ marginBottom: 12 }}>
                      <label htmlFor="nd">Campos Nombre / Fecha</label>
                      <input id="nd" type="checkbox" checked={worksheet.nameDate} onChange={(e) => setWorksheet((w) => ({ ...w, nameDate: e.target.checked }))} />
                    </div>
                    <div className="field"><label>Pie de página</label><input type="text" value={worksheet.footer} onChange={(e) => setWorksheet((w) => ({ ...w, footer: e.target.value }))} /></div>
                    <div className="field">
                      <label>Logo (opcional)</label>
                      {worksheet.logo
                        ? <div className="thumb" style={{ maxWidth: 140 }}><img src={worksheet.logo} alt="logo" /><button className="rm" onClick={() => setWorksheet((w) => ({ ...w, logo: null }))}>✕</button></div>
                        : <input type="file" accept="image/*" onChange={(e) => onLogoFile(e.target.files?.[0])} />}
                    </div>
                  </div>
                )}

                <div className="divider" />
                <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }} onClick={doSaveProject}>💾 Guardar proyecto</button>

                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 10 }}>Exportar</label>
                {activity.supportsTransparent && !worksheet.enabled && (
                  <div className="switch" style={{ marginBottom: 12 }}>
                    <label htmlFor="tr">Fondo transparente</label>
                    <input id="tr" type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
                  </div>
                )}
                <div className="export-grid">
                  <button className="btn btn-primary" disabled={!canExport} onClick={() => doExport('png')}>PNG 300dpi</button>
                  <button className="btn btn-primary" disabled={!canExport} onClick={() => doExport('pdf')}>PDF A4</button>
                  <button className="btn btn-ghost" disabled={!canExport} onClick={() => doExport('svg')}>SVG</button>
                  <button className="btn btn-ghost" disabled>{canExport ? 'Listo ✓' : 'Bloqueado'}</button>
                </div>
                {!canExport && <p className="export-note">La exportación se habilita cuando todas las validaciones pasan.</p>}
              </>
            )}
          </aside>

          <main className="canvas-area">
            {activity && !generating && (
              <div className="canvas-tools">
                <div className="tool-group">
                  <button className="icon-btn" onClick={undo} disabled={!past.current.length} title="Deshacer (Ctrl+Z)">↩</button>
                  <button className="icon-btn" onClick={redo} disabled={!future.current.length} title="Rehacer (Ctrl+Y)">↪</button>
                </div>
                <div className="tool-group">
                  <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))} title="Alejar">−</button>
                  <span className="zoom-val">{Math.round(zoom * 100)}%</span>
                  <button className="icon-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.15))} title="Acercar">＋</button>
                  <button className="icon-btn" onClick={() => setZoom(1)} title="Ajustar">⤢</button>
                </div>
                {worksheet.enabled && (
                  <div className="tool-group seg">
                    <button className={`seg-btn ${previewMode === 'editar' ? 'active' : ''}`} onClick={() => setPreviewMode('editar')}>Editar</button>
                    <button className={`seg-btn ${previewMode === 'hoja' ? 'active' : ''}`} onClick={() => setPreviewMode('hoja')}>Hoja</button>
                  </div>
                )}
              </div>
            )}

            {!activity && !generating && (
              <div className="placeholder">
                <div className="big">{plugin.icon}</div>
                <h3>{plugin.name}</h3>
                <p>{plugin.requiresImage ? 'Subí una imagen (o elegí un ejemplo) y presioná “Generar actividad”.' : 'Configurá las opciones y presioná “Generar actividad”.'}</p>
              </div>
            )}
            {generating && (
              <div className="placeholder">
                <div className="big">⚙️</div>
                <p>{progress.msg || 'Procesando…'}</p>
              </div>
            )}
            {activity && !generating && (
              <div className="zoom-wrap" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                {worksheet.enabled && previewMode === 'hoja'
                  ? <div className="preview-wrap sheet" dangerouslySetInnerHTML={{ __html: framedActivity(activity, worksheet).svg }} />
                  : Editor
                    ? <Editor activity={activity} onChange={commitActivity} />
                    : <div className="preview-wrap" dangerouslySetInnerHTML={{ __html: activity.svg }} />}
              </div>
            )}
          </main>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
