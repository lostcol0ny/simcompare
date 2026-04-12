import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d0d1a',
          raised: '#14141f',
          overlay: '#1e1e2e',
        },
        border: {
          DEFAULT: '#1e1e2e',
          subtle: '#2d2d3d',
        },
        accent: {
          DEFAULT: '#7c3aed',
          light: '#a78bfa',
          muted: '#4c1d95',
        },
        positive: {
          DEFAULT: '#4ade80',
          bg: '#0d1f0d',
          border: '#166534',
        },
        negative: {
          DEFAULT: '#f87171',
          bg: '#1f0d0d',
          border: '#7f1d1d',
        },
        warning: {
          DEFAULT: '#fbbf24',
          bg: '#1a1200',
          border: '#854d0e',
        },
        text: {
          primary: '#e2e8f0',
          secondary: '#94a3b8',
          muted: '#64748b',
          faint: '#475569',
        },
      },
    },
  },
  plugins: [],
}

export default config
