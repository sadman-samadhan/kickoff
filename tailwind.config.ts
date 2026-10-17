import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: 'class',
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-body)'],
  			display: ['var(--font-display)']
  		},
  		colors: {
  			// App theme (Clean Pitch light / Floodlight dark), see app/globals.css
  			app: {
  				bg: 'var(--app-bg)',
  				surface: 'var(--app-surface)',
  				soft: 'var(--app-soft)',
  				ink: 'var(--app-ink)',
  				muted: 'var(--app-muted)',
  				line: 'var(--app-line)',
  				primary: 'var(--app-primary)',
  				'on-primary': 'var(--app-on-primary)',
  				accent: 'var(--app-accent)',
  				'on-accent': 'var(--app-on-accent)'
  			},
  			// Clean Pitch greys (a hint of pitch green). Dark mode versions: app/theme-dark.css
  			neutral: {
  				50: '#f8faf7',
  				100: '#eef2ec',
  				200: '#e2e8e0',
  				300: '#cbd5c9',
  				400: '#94a39a',
  				500: '#5b6b62',
  				600: '#4a5850',
  				700: '#36433c',
  				800: '#233029',
  				900: '#14211a',
  				950: '#0b140f'
  			},
  			// Auction screens (Clean Pitch light / Floodlight dark), see app/auction.css
  			ka: {
  				bg: 'var(--ka-bg)',
  				surface: 'var(--ka-surface)',
  				soft: 'var(--ka-soft)',
  				ink: 'var(--ka-ink)',
  				muted: 'var(--ka-muted)',
  				line: 'var(--ka-line)',
  				primary: 'var(--ka-primary)',
  				'on-primary': 'var(--ka-on-primary)',
  				accent: 'var(--ka-accent)',
  				'on-accent': 'var(--ka-on-accent)',
  				warn: 'var(--ka-warn)',
  				'on-warn': 'var(--ka-on-warn)',
  				danger: 'var(--ka-danger)'
  			},
  			background: 'var(--background)',
  			foreground: 'var(--foreground)',
  			card: {
  				DEFAULT: 'var(--card)',
  				foreground: 'var(--card-foreground)'
  			},
  			popover: {
  				DEFAULT: 'var(--popover)',
  				foreground: 'var(--popover-foreground)'
  			},
  			primary: {
  				DEFAULT: 'var(--primary)',
  				foreground: 'var(--primary-foreground)'
  			},
  			secondary: {
  				DEFAULT: 'var(--secondary)',
  				foreground: 'var(--secondary-foreground)'
  			},
  			muted: {
  				DEFAULT: 'var(--muted)',
  				foreground: 'var(--muted-foreground)'
  			},
  			accent: {
  				DEFAULT: 'var(--accent)',
  				foreground: 'var(--accent-foreground)'
  			},
  			destructive: {
  				DEFAULT: 'var(--destructive)',
  				foreground: 'var(--destructive-foreground)'
  			},
  			border: 'var(--border)',
  			input: 'var(--input)',
  			ring: 'var(--ring)',
  			chart: {
  				'1': 'var(--chart-1)',
  				'2': 'var(--chart-2)',
  				'3': 'var(--chart-3)',
  				'4': 'var(--chart-4)',
  				'5': 'var(--chart-5)'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [],
};
export default config;
