import { useRef, useState } from 'react';
import type { SourceImage } from '../core/types';
import { fileToSourceImage } from '../core/geometry/imageProcessing';
import { sampleList, loadSample } from './samples';

export function ImageDropzone({
  image,
  onImage,
}: {
  image: SourceImage | null;
  onImage: (img: SourceImage | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const samples = sampleList();

  const handle = async (file?: File) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('El archivo debe ser una imagen.'); return; }
    try {
      const img = await fileToSourceImage(file);
      onImage(img);
    } catch {
      setError('No se pudo cargar la imagen.');
    }
  };

  if (image) {
    return (
      <div className="thumb">
        <img src={image.src} alt="entrada" />
        <button className="rm" onClick={() => onImage(null)} title="Quitar imagen">✕</button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      >
        <div className="dz-icon">🖼️</div>
        <strong>Subí una imagen</strong>
        <p>Arrastrala acá o hacé clic. Ideal: silueta clara sobre fondo liso (PNG/JPG).</p>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => handle(e.target.files?.[0])} />
      </div>
      {error && <p className="help" style={{ color: 'var(--err)' }}>{error}</p>}
      <p className="help" style={{ marginTop: 10, marginBottom: 6 }}>O probá con un ejemplo:</p>
      <div className="samples">
        {samples.map((s) => (
          <button key={s.name} className="sample" title={s.name} onClick={async () => onImage(await loadSample(s.name))}>
            <img src={s.thumb} alt={s.name} />
            <span>{s.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}
