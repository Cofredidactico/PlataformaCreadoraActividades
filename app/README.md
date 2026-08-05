# 🎨 Cofre Actividades

Plataforma web **modular** para crear actividades didácticas imprimibles de calidad
editorial en minutos. Todo el procesamiento (visión artificial y geometría) ocurre
**en el navegador**: no hay servidor, no hay costos de hosting y funciona offline.

> Producto de **Cofre Didáctico**.

---

## ✨ Qué hace

Subís una imagen, elegís una actividad, la configurás, la generás, la editás y la
exportás. Cada actividad pasa una **validación automática** y solo se puede exportar
si es correcta.

**Formatos de exportación:** PNG 300 DPI · PDF A4 · SVG · fondo transparente (cuando aplica).

### Módulos listos

| Módulo | Descripción | Técnica |
|---|---|---|
| ✏️ **Unir Puntos** | Convierte una imagen en un une-puntos numerado | Detección de contorno + vectorización + distribución de N puntos por **longitud de arco** (100% geométrico, sin IA) |
| 🔤 **Sopa de Letras** | Grilla con las palabras que elijas | Colocación con validación de que todas entren |
| 🧩 **Rompecabezas** | Rompecabezas listo para imprimir y recortar | Corte en grilla con lengüetas interlazadas o recto |
| 🃏 **Memotest** | Mazo de cartas en pares | La imagen subida se usa como diseño del reverso |

### Hoja de ruta (arquitectura ya preparada)

Encontrá las Diferencias · Buscá y Encontrá · Laberintos · Colorear por Números ·
Unir Imagen con Palabra · Sombras · Secuencias · Trazos.

---

## 🚀 Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm run build      # compila a dist/
npm run preview    # previsualiza el build
```

Requiere Node 18+.

### Pruebas (opcional)

```bash
npm i -D playwright
npm run test:smoke   # prueba de humo en Chromium (genera y valida los 4 módulos)
```

---

## 🧩 Arquitectura de plugins

El **núcleo** (`src/core`) no conoce ningún módulo. Cada actividad es un plugin
independiente que implementa el contrato `ActivityPlugin` (`src/core/types.ts`):

```
Imagen → Seleccionar actividad → Configurar → Generar → Editar → Exportar
```

- **`src/core/geometry`** — visión artificial y geometría (contorno, RDP, remuestreo).
- **`src/core/exporters`** — pipeline único SVG → PNG 300dpi / PDF A4 / SVG.
- **`src/core/registry.ts`** — registro de plugins.
- **`src/modules/*`** — un plugin por carpeta.

### Agregar un módulo nuevo

1. Creá `src/modules/miModulo/plugin.tsx` implementando `ActivityPlugin`.
2. Registralo en `src/modules/index.ts` con `registerPlugin(miPlugin)`.

No hace falta tocar el núcleo ni la interfaz: aparece solo en la galería.

---

## 🌐 Publicación

El proyecto usa `base: './'` (rutas relativas), así que el contenido de `dist/`
funciona en cualquier hosting estático.

- **Vercel / Netlify (recomendado):** importá el repo, *Root Directory* = `plataforma`,
  *Build* = `npm run build`, *Output* = `dist`.
- **GitHub Pages:** hay un workflow en `.github/workflows/deploy-plataforma.yml`.
  Para activarlo, en *Settings → Pages* elegí *Source: GitHub Actions*.
  (Ojo: eso reemplaza la fuente actual de Pages del repositorio.)
