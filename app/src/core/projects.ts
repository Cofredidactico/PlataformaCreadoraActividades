import type { ConfigValues, GeneratedActivity } from './types';

// ============================================================================
// Persistencia de proyectos en localStorage (guardar / abrir / recientes).
// Todo el estado editable es serializable (SVG string + data plana), asi que
// se guarda y restaura directamente sin backend.
// ============================================================================

export interface Project {
  id: string;
  name: string;
  pluginId: string;
  config: ConfigValues;
  imageSrc: string | null;
  activity: GeneratedActivity | null;
  updatedAt: number;
}

const KEY = 'cofre-projects-v1';

export function listProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Project[];
    return arr.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveProject(p: Omit<Project, 'id' | 'updatedAt'> & { id?: string }): Project {
  const projects = listProjects();
  const id = p.id ?? `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const project: Project = { ...p, id, updatedAt: Date.now() };
  const idx = projects.findIndex((x) => x.id === id);
  if (idx >= 0) projects[idx] = project;
  else projects.unshift(project);
  try {
    localStorage.setItem(KEY, JSON.stringify(projects.slice(0, 60)));
  } catch {
    // si se llena el almacenamiento, guardar sin la imagen para ahorrar espacio
    const light = projects.map((x) => ({ ...x, imageSrc: null }));
    localStorage.setItem(KEY, JSON.stringify(light.slice(0, 60)));
  }
  return project;
}

export function deleteProject(id: string): void {
  const projects = listProjects().filter((p) => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(projects));
}
