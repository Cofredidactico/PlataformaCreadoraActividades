import type { ActivityPlugin } from './types';

// ============================================================================
// Registro de plugins. El nucleo mantiene un mapa de modulos disponibles.
// Los modulos se registran a si mismos en el arranque (ver modules/index.ts),
// de modo que agregar uno nuevo es tan simple como crear su carpeta y
// registrarlo, sin modificar el nucleo.
// ============================================================================

const registry = new Map<string, ActivityPlugin<any>>();

export function registerPlugin(plugin: ActivityPlugin<any>): void {
  if (registry.has(plugin.id)) {
    console.warn(`[registry] plugin duplicado ignorado: ${plugin.id}`);
    return;
  }
  registry.set(plugin.id, plugin);
}

export function getPlugins(): ActivityPlugin<any>[] {
  return Array.from(registry.values());
}

export function getPlugin(id: string): ActivityPlugin<any> | undefined {
  return registry.get(id);
}
