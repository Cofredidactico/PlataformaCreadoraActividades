// ============================================================================
// Tipos centrales del nucleo de la plataforma.
// El nucleo NO conoce ningun modulo en particular: solo define los contratos
// que cada plugin de actividad debe cumplir. Asi se agregan modulos nuevos
// (crucigramas, domino, etc.) sin tocar el nucleo.
// ============================================================================

export type Point = { x: number; y: number };

/** Imagen ya cargada y lista para procesar por los modulos. */
export interface SourceImage {
  /** URL (dataURL) para mostrar. */
  src: string;
  width: number;
  height: number;
  /** El elemento HTMLImageElement ya decodificado. */
  element: HTMLImageElement;
}

/** Un campo de configuracion que el modulo expone al usuario. */
export type ConfigField =
  | {
      type: 'select';
      key: string;
      label: string;
      options: { value: string; label: string }[];
      default: string;
      help?: string;
    }
  | {
      type: 'slider';
      key: string;
      label: string;
      min: number;
      max: number;
      step: number;
      default: number;
      unit?: string;
      help?: string;
    }
  | {
      type: 'toggle';
      key: string;
      label: string;
      default: boolean;
      help?: string;
    }
  | {
      type: 'text';
      key: string;
      label: string;
      default: string;
      placeholder?: string;
      help?: string;
    }
  | {
      type: 'textarea';
      key: string;
      label: string;
      default: string;
      placeholder?: string;
      help?: string;
    };

export type ConfigValues = Record<string, string | number | boolean>;

/** Resultado de una validacion automatica de calidad. */
export interface ValidationCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface ValidationResult {
  /** true solo si TODAS las comprobaciones criticas pasan. */
  passed: boolean;
  checks: ValidationCheck[];
}

/**
 * Todo modulo produce, como fuente de verdad, un SVG (string) mas metadata
 * editable. El SVG permite exportar a PNG 300dpi, PDF A4 y SVG con un unico
 * pipeline generico. `data` guarda el estado editable del modulo.
 */
export interface GeneratedActivity<TData = unknown> {
  /** SVG completo (con viewBox) representando la actividad. */
  svg: string;
  /** Ancho/alto del lienzo en px (unidades del viewBox). */
  width: number;
  height: number;
  /** Estado editable especifico del modulo. */
  data: TData;
  /** Resultado de la validacion automatica. */
  validation: ValidationResult;
  /** Si la actividad admite fondo transparente al exportar. */
  supportsTransparent: boolean;
  /** Avisos no bloqueantes para el usuario (ej: imagen muy compleja). */
  warnings?: string[];
}

export interface GenerateContext {
  image: SourceImage | null;
  config: ConfigValues;
  /** Reporta progreso 0..1 (para tareas pesadas). */
  onProgress?: (p: number, message?: string) => void;
}

/** Props que el nucleo pasa al editor de cada modulo. */
export interface EditorProps<TData = unknown> {
  activity: GeneratedActivity<TData>;
  /** Reemplaza el estado editado y re-renderiza / re-valida. */
  onChange: (next: GeneratedActivity<TData>) => void;
}

/** Contrato que cada plugin de actividad implementa. */
export interface ActivityPlugin<TData = unknown> {
  id: string;
  name: string;
  /** Descripcion corta para la galeria. */
  tagline: string;
  /** Emoji o icono corto para la galeria. */
  icon: string;
  /** Color de acento del modulo (para la tarjeta). */
  accent: string;
  /** Rango etario sugerido. */
  ageRange: string;
  /** Si el modulo requiere una imagen de entrada. */
  requiresImage: boolean;
  /** Estado del modulo. 'ready' = usable; 'soon' = anunciado pero no activo. */
  status: 'ready' | 'soon';
  /** Campos de configuracion. */
  configFields: ConfigField[];
  /** Genera la actividad (puede ser async por procesamiento pesado). */
  generate: (ctx: GenerateContext) => Promise<GeneratedActivity<TData>>;
  /** Componente editor (React). Opcional: si no hay, solo se previsualiza. */
  Editor?: React.ComponentType<EditorProps<TData>>;
}
