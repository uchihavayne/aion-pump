import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        aion: {
          black: '#000000',
          yellow: '#FDDC11',
          purple: '#6B21A8',
          dark: '#0b0c0e',
          darker: '#020617',
        }
      },
      backgroundColor: {
        'aion-bg': 'linear-gradient(to br, #000000, #1a1a1a)',
      }
    },
  },
  plugins: [],
}
export default config