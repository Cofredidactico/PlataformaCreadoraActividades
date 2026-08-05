import { useMemo, useState } from 'react';
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

function defaultsFor(plugin: ActivityPlugin): ConfigValues {
  const v: ConfigValues = {};
  for (const f of plugin.configFields) v[f.key] = f.default;
  return v;
}

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

  const plugin = pluginId ? getPlugin(pluginId) : null;

  const openPlugin = (p: ActivityPlugin) => {
    if (p.status === 'soon') return;
    setPluginId(p.id);
    setConfig(defaultsFor(p));
    setImage(null);
    setActivity(null);
    setError('');
    setView('workspace');
  };

  const goHome = () => { setView('gallery'); setPluginId(null); setActivity(null); };

  const runGenerate = async () => {
    if (!plugin) return;
    setError('');
    if (plugin.requiresImage && !image) { setError('Primero subí una imagen.'); return; }
    setGenerating(true);
    setActivity(null);
    setProgress({ p: 0, msg: 'Iniciando...' });
    try {
      // Ceder el hilo para que la UI muestre el progreso.
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
    if (fmt === 'png') await exportPNG(activity, name, transparent);
    else if (fmt === 'pdf') await exportPDF(activity, name);
    else await exportSVG(activity, name, transparent);
  };

  const canExport = activity?.validation.passed ?? false;
  const steps = plugin?.requiresImage
    ? ['Imagen', 'Configurar', 'Generar', 'Editar', 'Exportar']
    : ['Configurar', 'Generar', 'Editar', 'Exportar'];
  const currentStep = !activity ? (plugin?.requiresImage && !image ? 0 : plugin?.requiresImage ? 1 : 0) : steps.length - 2;

  const Editor = plugin?.Editor;

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
            <p>Subí una imagen, elegí una actividad y exportá en PNG 300 DPI, PDF A4 o SVG. Calidad editorial, con validación automática de cada recurso.</p>
          </section>
          <section className="gallery">
            {plugins.map((p) => (
              <div
                key={p.id}
                className={`card ${p.status === 'soon' ? 'soon' : ''}`}
                onClick={() => openPlugin(p)}
                style={{ borderTopColor: p.accent }}
              >
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
                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 10 }}>Exportar</label>
                {activity.supportsTransparent && (
                  <div className="switch" style={{ marginBottom: 12 }}>
                    <label htmlFor="tr">Fondo transparente</label>
                    <input id="tr" type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
                  </div>
                )}
                <div className="export-grid">
                  <button className="btn btn-primary" disabled={!canExport} onClick={() => doExport('png')}>PNG 300dpi</button>
                  <button className="btn btn-primary" disabled={!canExport} onClick={() => doExport('pdf')}>PDF A4</button>
                  <button className="btn btn-ghost" disabled={!canExport} onClick={() => doExport('svg')}>SVG</button>
                  <button className="btn btn-ghost" disabled onClick={() => {}}>{canExport ? 'Listo ✓' : 'Bloqueado'}</button>
                </div>
                {!canExport && <p className="export-note">La exportación se habilita cuando todas las validaciones pasan.</p>}
              </>
            )}
          </aside>

          <main className="canvas-area">
            {!activity && !generating && (
              <div className="placeholder">
                <div className="big">{plugin.icon}</div>
                <h3>{plugin.name}</h3>
                <p>{plugin.requiresImage ? 'Subí una imagen y presioná “Generar actividad”.' : 'Configurá las opciones y presioná “Generar actividad”.'}</p>
              </div>
            )}
            {generating && (
              <div className="placeholder">
                <div className="big">⚙️</div>
                <p>{progress.msg || 'Procesando…'}</p>
              </div>
            )}
            {activity && !generating && (
              Editor
                ? <Editor activity={activity} onChange={setActivity} />
                : <div className="preview-wrap" dangerouslySetInnerHTML={{ __html: activity.svg }} />
            )}
          </main>
        </div>
      )}
    </>
  );
}
