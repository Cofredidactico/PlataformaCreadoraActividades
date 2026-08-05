# 🎨 Cofre Actividades — Plataforma Creadora de Actividades

Plataforma web **modular** para crear actividades didácticas imprimibles de calidad
editorial en minutos. Todo el procesamiento (visión artificial y geometría) ocurre
**en el navegador**: sin servidor, sin costos, funciona offline.

> Producto de **Cofre Didáctico**.

**🌐 En vivo:** https://cofredidactico.github.io/PlataformaCreadoraActividades/

---

## 📁 Estructura del repositorio

- **Raíz** (`index.html`, `assets/`) → el sitio **ya compilado**, que es lo que
  publica GitHub Pages desde `main`.
- **`app/`** → el **código fuente** (React + TypeScript + Vite) para desarrollar y
  volver a compilar.

### Volver a compilar tras editar el código

```bash
cd app
npm install
npm run build        # genera app/dist
# copiar el resultado a la raíz para actualizar el sitio publicado:
rm -rf ../assets ../index.html && cp -r dist/. ../
git add -A && git commit -m "Actualizar sitio" && git push
```

Para desarrollo local con recarga en caliente: `cd app && npm run dev`.

---

## ✨ Qué hace

Subís una imagen, elegís una actividad, la configurás, la generás, la editás y la
exportás en **PNG 300 DPI · PDF A4 · SVG** (fondo transparente cuando aplica).
Cada actividad pasa una **validación automática** y solo se puede exportar si es
correcta.

### Módulos listos (8)

| Módulo | Técnica |
|---|---|
| ✏️ **Unir Puntos** | Detección de contorno + vectorización + distribución de N puntos por **longitud de arco** (100% geométrico, sin IA) |
| ✍️ **Trazos** | Contorno convertido en figura punteada para repasar (grafomotricidad) |
| 🔤 **Sopa de Letras** | Colocación con validación de que todas las palabras entren |
| 🌀 **Laberintos** | Laberinto perfecto (árbol): **solución única garantizada matemáticamente** |
| 🎨 **Colorear por Números** | Cuantización de color (k-means) → line-art, zonas numeradas y leyenda |
| 🌑 **Sombras** | Silueta del objeto + distractores, con solución |
| 🧩 **Rompecabezas** | Corte en grilla con lengüetas interlazadas o recto |
| 🃏 **Memotest** | Mazo de cartas en pares; la imagen es el reverso |

### Funciones del editor y la plataforma

Deshacer/rehacer (Ctrl+Z / Ctrl+Y) · zoom y ajuste · **guardar y abrir proyectos**
(en el navegador) · biblioteca de **imágenes de ejemplo** · **hoja de cuadernillo**
(marco A4 con título, instrucciones, campos Nombre/Fecha, logo y pie de marca).

### Hoja de ruta (arquitectura ya preparada)

Encontrá las Diferencias · Buscá y Encontrá · Unir Imagen con Palabra · Secuencias.

---

## 🧩 Arquitectura de plugins

El **núcleo** (`app/src/core`) no conoce ningún módulo. Cada actividad es un plugin
que implementa el contrato `ActivityPlugin`. Para agregar un módulo nuevo:

1. Creá `app/src/modules/miModulo/plugin.tsx` implementando `ActivityPlugin`.
2. Registralo en `app/src/modules/index.ts` con `registerPlugin(miPlugin)`.

No hace falta tocar el núcleo ni la interfaz: aparece solo en la galería.
