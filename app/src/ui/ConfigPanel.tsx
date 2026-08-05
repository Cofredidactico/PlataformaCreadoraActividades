import type { ConfigField, ConfigValues } from '../core/types';

export function ConfigPanel({
  fields,
  values,
  onChange,
}: {
  fields: ConfigField[];
  values: ConfigValues;
  onChange: (key: string, value: string | number | boolean) => void;
}) {
  return (
    <div>
      {fields.map((f) => (
        <div className="field" key={f.key}>
          {f.type === 'toggle' ? (
            <div className="switch">
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                type="checkbox"
                checked={Boolean(values[f.key])}
                onChange={(e) => onChange(f.key, e.target.checked)}
              />
            </div>
          ) : (
            <>
              <label htmlFor={f.key}>{f.label}</label>
              {f.type === 'select' && (
                <select id={f.key} value={String(values[f.key])} onChange={(e) => onChange(f.key, e.target.value)}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {f.type === 'slider' && (
                <div className="range-row">
                  <input
                    id={f.key}
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={Number(values[f.key])}
                    onChange={(e) => onChange(f.key, Number(e.target.value))}
                  />
                  <span className="val">{Number(values[f.key])}{f.unit ?? ''}</span>
                </div>
              )}
              {f.type === 'text' && (
                <input
                  id={f.key}
                  type="text"
                  value={String(values[f.key])}
                  placeholder={f.placeholder}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}
              {f.type === 'textarea' && (
                <textarea
                  id={f.key}
                  value={String(values[f.key])}
                  placeholder={f.placeholder}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}
            </>
          )}
          {f.help && <p className="help">{f.help}</p>}
        </div>
      ))}
    </div>
  );
}
