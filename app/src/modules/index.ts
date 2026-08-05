import { registerPlugin } from '../core/registry';
import type { ActivityPlugin } from '../core/types';
import { connectDotsPlugin } from './connectDots/plugin';
import { wordSearchPlugin } from './wordSearch/plugin';
import { jigsawPlugin } from './jigsaw/plugin';
import { memoryPlugin } from './memory/plugin';

// ============================================================================
// Punto unico donde se registran los modulos. Para agregar uno nuevo:
//   1. crear su carpeta en modules/ con su plugin
//   2. importarlo y llamarlo en registerPlugin() aca
// El nucleo no necesita cambios.
// ============================================================================

// Modulos anunciados en la hoja de ruta (arquitectura ya preparada).
function soon(
  id: string, name: string, icon: string, tagline: string, accent: string, requiresImage: boolean,
): ActivityPlugin {
  return {
    id, name, icon, tagline, accent, requiresImage,
    ageRange: '4 a 10 años', status: 'soon', configFields: [],
    async generate() { throw new Error('Módulo en construcción'); },
  };
}

export function registerAllModules(): void {
  // Modulos listos
  registerPlugin(connectDotsPlugin);
  registerPlugin(wordSearchPlugin);
  registerPlugin(jigsawPlugin);
  registerPlugin(memoryPlugin);

  // Hoja de ruta (proximos)
  registerPlugin(soon('differences', 'Encontrá las Diferencias', '🔍', 'Genera dos imágenes con diferencias equilibradas.', '#FD79A8', true));
  registerPlugin(soon('seek-find', 'Buscá y Encontrá', '👀', 'Lista de búsqueda verificada sobre una ilustración.', '#FDCB6E', true));
  registerPlugin(soon('maze', 'Laberintos', '🌀', 'Laberintos con solución única garantizada.', '#00CEC9', false));
  registerPlugin(soon('color-numbers', 'Colorear por Números', '🎨', 'Zonas numeradas con leyenda de colores.', '#A29BFE', true));
  registerPlugin(soon('match-word', 'Unir Imagen con Palabra', '🔗', 'Relacioná dibujos con sus nombres.', '#55EFC4', true));
  registerPlugin(soon('shadows', 'Sombras', '🌑', 'Encontrá la sombra correcta entre distractores.', '#636E72', true));
  registerPlugin(soon('sequences', 'Secuencias', '🔢', 'Ordená los pasos de una historia.', '#E84393', true));
  registerPlugin(soon('tracing', 'Trazos', '✍️', 'Repasá líneas, curvas y figuras punteadas.', '#74B9FF', true));
}
