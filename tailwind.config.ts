import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default <Partial<Config>>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue'
  ],
  // Pairs with @nuxtjs/color-mode `classSuffix: ''` so the `.dark` class on <html>
  // flips dark variants.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Article card tokens. Concrete values may be tuned by frontend-dev;
        // these are semantic aliases so component classes stay stable.
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f5f6f8',
          dark: '#0f1220',
          'dark-muted': '#171a2b'
        },
        ink: {
          DEFAULT: '#101322',
          muted: '#54596b',
          dark: '#e7e9f3',
          'dark-muted': '#9aa0b4'
        },
        accent: {
          DEFAULT: '#2f6bff',
          hover: '#1f56e8'
        },
        map: {
          active: '#2f6bff',
          muted: '#c8cdda',
          'active-dark': '#6f8cff',
          'muted-dark': '#2a3048',
          stroke: '#ffffff',
          'stroke-dark': '#0f1220'
        }
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      }
    }
  },
  plugins: [typography]
}
