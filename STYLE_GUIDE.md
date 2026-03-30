# 🎨 Style Guide — Kyle Lam Sound Healing Events Platform

> **Propósito:** Documento de referencia completo con todos los parámetros de estilo del sistema.
> Úsalo para replicar el mismo look & feel en nuevos desarrollos.

---

## 2. Tipografía

### Fuentes

| Fuente | Uso | Tipo | Import |
|---|---|---|---|
| **Playfair Display** | Headings, display, marca | Serifa elegante | Google Fonts |
| **Sistema (sans-serif)** | Body text, UI | Sans-serif del OS | Nativo |

### Importación de Fuente (index.html)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&display=swap" rel="stylesheet">
```

### Configuración Tailwind (tailwind.config.ts)
```ts
fontFamily: {
  'playfair': ['"Playfair Display"', 'serif'],
}
```

**Uso:** `font-playfair` para títulos y elementos de marca.

### Propiedades tipográficas globales
```css
body {
  font-feature-settings: "cv11", "ss01"; /* Ligaduras y caracteres refinados */
  line-height: 1.6;
}

h1, h2, h3, h4, h5, h6 {
  letter-spacing: -0.015em; /* tracking-tight */
  line-height: 1.25;
}

html {
  -webkit-font-smoothing: antialiased;    /* Texto más suave en macOS */
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

---

## 3. Paleta de Colores — Modo Claro

> Todos los colores están en formato HSL sin el wrapper `hsl()`.
> Para usarlos: `hsl(var(--nombre))` en CSS o `bg-background` en Tailwind.

### Colores Base
| Token CSS | Valor HSL | Descripción |
|---|---|---|
| `--background` | `35 40% 98%` | Fondo general — beige muy claro |
| `--foreground` | `24 30% 15%` | Texto principal — marrón oscuro |

### Tarjetas y Popovers
| Token CSS | Valor HSL | Descripción |
|---|---|---|
| `--card` | `0 0% 100%` | Fondo de tarjeta — blanco puro |
| `--card-foreground` | `24 30% 15%` | Texto en tarjeta |
| `--popover` | `0 0% 100%` | Fondo de popover |
| `--popover-foreground` | `24 30% 15%` | Texto en popover |

### Color Primario (Cobre/Dorado)
| Token CSS | Valor HSL | Hex aproximado |
|---|---|---|
| `--primary` | `30 60% 42%` | `#AC6E2B` — cobre cálido |
| `--primary-foreground` | `0 0% 100%` | Blanco — texto sobre primario |

### Colores Secundarios y de Apoyo
| Token CSS | Valor HSL | Descripción |
|---|---|---|
| `--secondary` | `35 30% 94%` | Fondo secundario — beige suave |
| `--secondary-foreground` | `24 30% 20%` | Texto sobre secundario |
| `--muted` | `35 20% 90%` | Fondo muted — beige medio |
| `--muted-foreground` | `24 15% 40%` | Texto muted — gris cálido |
| `--accent` | `35 45% 96%` | Fondo acento — casi blanco beige |
| `--accent-foreground` | `24 30% 30%` | Texto sobre acento |

### Estados Semánticos
| Token CSS | Valor HSL | Descripción |
|---|---|---|
| `--destructive` | `0 72% 46%` | Rojo — error, eliminar |
| `--destructive-foreground` | `0 0% 100%` | Blanco sobre destructivo |
| `--success` | `142 71% 35%` | Verde — confirmación, éxito |
| `--success-foreground` | `0 0% 100%` | Blanco sobre success |

### Bordes e Inputs
| Token CSS | Valor HSL | Descripción |
|---|---|---|
| `--border` | `35 18% 88%` | Borde sutil beige |
| `--input` | `35 18% 88%` | Fondo/borde de inputs |
| `--ring` | `30 60% 42%` | Focus ring — igual que primario |

### Sidebar
| Token CSS | Valor HSL |
|---|---|
| `--sidebar-background` | `35 40% 98%` |
| `--sidebar-foreground` | `24 30% 15%` |
| `--sidebar-primary` | `30 60% 42%` |
| `--sidebar-primary-foreground` | `0 0% 100%` |
| `--sidebar-accent` | `35 30% 94%` |
| `--sidebar-accent-foreground` | `24 30% 20%` |
| `--sidebar-border` | `35 18% 88%` |
| `--sidebar-ring` | `30 60% 42%` |

---

## 4. Paleta de Colores — Modo Oscuro

### Colores Base
| Token CSS | Valor HSL | Descripción |
|---|---|---|
| `--background` | `24 15% 8%` | Fondo oscuro — marrón muy oscuro |
| `--foreground` | `35 20% 95%` | Texto — crema claro |

### Tarjetas y Popovers
| Token CSS | Valor HSL |
|---|---|
| `--card` | `24 15% 10%` |
| `--card-foreground` | `35 20% 95%` |
| `--popover` | `24 15% 10%` |
| `--popover-foreground` | `35 20% 95%` |

### Primario (más brillante en dark)
| Token CSS | Valor HSL |
|---|---|
| `--primary` | `30 60% 60%` |
| `--primary-foreground` | `24 15% 10%` |

### Secundarios
| Token CSS | Valor HSL |
|---|---|
| `--secondary` | `24 10% 18%` |
| `--secondary-foreground` | `35 20% 95%` |
| `--muted` | `24 10% 18%` |
| `--muted-foreground` | `35 12% 75%` |
| `--accent` | `24 12% 22%` |
| `--accent-foreground` | `35 20% 95%` |

### Estados Semánticos Dark
| Token CSS | Valor HSL |
|---|---|
| `--destructive` | `0 63% 40%` |
| `--success` | `142 71% 45%` |

### Bordes Dark
| Token CSS | Valor HSL |
|---|---|
| `--border` | `24 10% 22%` |
| `--input` | `24 10% 22%` |
| `--ring` | `30 60% 60%` |

---

## 5. Radios de Borde (Border Radius)

| Variable CSS | Valor | Tailwind clase equivalente |
|---|---|---|
| `--radius` | `1rem` (16px) | Base radius |
| `border-radius-lg` | `var(--radius)` → 16px | `rounded-lg` |
| `border-radius-md` | `calc(var(--radius) - 2px)` → 14px | `rounded-md` |
| `border-radius-sm` | `calc(var(--radius) - 4px)` → 12px | `rounded-sm` |

> Sistema de bordes **muy redondeado** — estilo suave y amigable.

---

## 6. Sombras Personalizadas (Horizon Shadows)

Sombras multi-capa con tinte cobre cálido (`rgba(112, 80, 40, ...)`) para un efecto premium sutil.

```css
/* Sombra estándar */
.shadow-horizon {
  box-shadow:
    0 4px 6px -1px rgba(112, 80, 40, 0.06),
    0 10px 25px -5px rgba(112, 80, 40, 0.10),
    0 20px 60px -10px rgba(112, 80, 40, 0.08);
}

/* Sombra grande */
.shadow-horizon-lg {
  box-shadow:
    0 8px 12px -2px rgba(112, 80, 40, 0.08),
    0 20px 40px -8px rgba(112, 80, 40, 0.14),
    0 40px 80px -16px rgba(112, 80, 40, 0.10);
}
```

---

## 7. Glassmorphism

```css
/* Modo claro */
.glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
}

/* Modo oscuro */
.dark .glass {
  background: rgba(30, 20, 14, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

---

## 8. Gradientes

### Fondo de Página (body)
```css
body {
  background-image:
    radial-gradient(ellipse 80% 60% at 0% 0%, hsl(35 60% 96%) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 100% 100%, hsl(30 50% 95%) 0%, transparent 60%);
  background-attachment: fixed;
}
```
> Dos gradientes radiales en esquinas opuestas para efecto de luz ambiente.

### Texto Gradiente
```css
.text-gradient {
  background: linear-gradient(135deg, hsl(30 60% 42%), hsl(30 70% 58%));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Botón Gradiente
```css
.btn-gradient {
  background: linear-gradient(135deg, hsl(30 60% 42%), hsl(30 70% 52%));
}
.btn-gradient:hover {
  background: linear-gradient(135deg, hsl(30 60% 38%), hsl(30 70% 48%));
}
```

---

## 9. Animaciones

### Keyframes definidas

| Nombre | Descripción |
|---|---|
| `accordion-down` | Expande altura de 0 a auto |
| `accordion-up` | Contrae altura de auto a 0 |
| `fade-in` | Opacity 0→1 + translateY(10px→0) |
| `fade-out` | Opacity 1→0 + translateY(0→10px) |
| `scale-in` | scale(0.95→1) + opacity 0→1 |
| `scale-out` | scale(1→0.95) + opacity 1→0 |
| `slide-in-right` | translateX(100%→0) |
| `slide-out-right` | translateX(0→100%) |

### Clases de animación (Tailwind)

| Clase | Definición |
|---|---|
| `animate-accordion-down` | `accordion-down 0.2s ease-out` |
| `animate-accordion-up` | `accordion-up 0.2s ease-out` |
| `animate-fade-in` | `fade-in 0.3s ease-out` |
| `animate-fade-out` | `fade-out 0.3s ease-out` |
| `animate-scale-in` | `scale-in 0.2s ease-out` |
| `animate-scale-out` | `scale-out 0.2s ease-out` |
| `animate-slide-in-right` | `slide-in-right 0.3s ease-out` |
| `animate-slide-out-right` | `slide-out-right 0.3s ease-out` |
| `animate-enter` | `fade-in 0.3s + scale-in 0.2s ease-out` |
| `animate-exit` | `fade-out 0.3s + scale-out 0.2s ease-out` |

### Transiciones Globales de Interactividad
```css
/* Se aplica a: a, button, input, textarea, select, [role="button"] */
transition-property: color, background-color, border-color, box-shadow, opacity, transform;
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
transition-duration: 180ms;
```
> Solo aplica si el usuario no tiene `prefers-reduced-motion` activo.

---

## 10. Layout y Contenedor

```ts
container: {
  center: true,
  padding: '2rem',
  screens: {
    '2xl': '1400px'   // Ancho máximo en pantallas grandes
  }
}
```

```css
/* Overflow global para evitar scroll horizontal */
html, #root {
  overflow-x: clip;
}

body {
  overflow-x: clip;
}
```

---

## 11. Scrollbar personalizado (webkit)

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 9999px; /* rounded-full */
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.4);
}
```

---

## 12. Estados de Foco (Accessibility)

```css
*:focus-visible {
  outline: none;
  ring: 2px solid hsl(var(--primary) / 0.6);
  ring-offset: 2px;
  ring-offset-color: hsl(var(--background));
}
```

### Selección de texto
```css
::selection {
  background: hsl(var(--primary) / 0.20);
  color: hsl(var(--foreground));
}
```

---

## 13. Sistema de Componentes (shadcn/ui)

| Parámetro | Valor |
|---|---|
| Style | `default` |
| Base color | `slate` |
| CSS Variables | `true` |
| TypeScript | `true` (TSX) |
| RSC | `false` |

### Aliases en el proyecto
```json
{
  "components": "@/components",
  "utils": "@/lib/utils",
  "ui": "@/components/ui",
  "lib": "@/lib",
  "hooks": "@/hooks"
}
```

---

## 14. CSS Variables — Copia lista para pegar

### `:root` (Light Mode)
```css
:root {
  --background: 35 40% 98%;
  --foreground: 24 30% 15%;
  --card: 0 0% 100%;
  --card-foreground: 24 30% 15%;
  --popover: 0 0% 100%;
  --popover-foreground: 24 30% 15%;
  --primary: 30 60% 42%;
  --primary-foreground: 0 0% 100%;
  --secondary: 35 30% 94%;
  --secondary-foreground: 24 30% 20%;
  --muted: 35 20% 90%;
  --muted-foreground: 24 15% 40%;
  --accent: 35 45% 96%;
  --accent-foreground: 24 30% 30%;
  --destructive: 0 72% 46%;
  --destructive-foreground: 0 0% 100%;
  --success: 142 71% 35%;
  --success-foreground: 0 0% 100%;
  --border: 35 18% 88%;
  --input: 35 18% 88%;
  --ring: 30 60% 42%;
  --radius: 1rem;
  --sidebar-background: 35 40% 98%;
  --sidebar-foreground: 24 30% 15%;
  --sidebar-primary: 30 60% 42%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 35 30% 94%;
  --sidebar-accent-foreground: 24 30% 20%;
  --sidebar-border: 35 18% 88%;
  --sidebar-ring: 30 60% 42%;
}
```

### `.dark` (Dark Mode)
```css
.dark {
  --background: 24 15% 8%;
  --foreground: 35 20% 95%;
  --card: 24 15% 10%;
  --card-foreground: 35 20% 95%;
  --popover: 24 15% 10%;
  --popover-foreground: 35 20% 95%;
  --primary: 30 60% 60%;
  --primary-foreground: 24 15% 10%;
  --secondary: 24 10% 18%;
  --secondary-foreground: 35 20% 95%;
  --muted: 24 10% 18%;
  --muted-foreground: 35 12% 75%;
  --accent: 24 12% 22%;
  --accent-foreground: 35 20% 95%;
  --destructive: 0 63% 40%;
  --destructive-foreground: 0 0% 100%;
  --success: 142 71% 45%;
  --success-foreground: 0 0% 100%;
  --border: 24 10% 22%;
  --input: 24 10% 22%;
  --ring: 30 60% 60%;
  --sidebar-background: 24 15% 8%;
  --sidebar-foreground: 35 20% 95%;
  --sidebar-primary: 30 60% 60%;
  --sidebar-primary-foreground: 24 15% 10%;
  --sidebar-accent: 24 10% 18%;
  --sidebar-accent-foreground: 35 20% 95%;
  --sidebar-border: 24 10% 22%;
  --sidebar-ring: 30 60% 60%;
}
```

---

## 15. Identidad Visual

- **Marca:** Kyle Lam Sound Healing
- **Estilo general:** Cálido, orgánico, espiritual — inspirado en Humanitix
- **Paleta cromática:** Tonos beige, crema, cobre y marrón cálido
- **Personalidad:** Premium pero accesible, sereno, editorial
- **Favicon:** `https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-33-100.jpg`
- **Imagen OG:** `https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-34-100.jpg`

---

*Generado el 2026-03-30 a partir del código fuente de `eventsklsh`.*
