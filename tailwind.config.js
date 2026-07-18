/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
    './zk-vault/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Kantumruy Pro"', '"Noto Sans Khmer"', '"Khmer OS"', 'sans-serif'],
        display: ['"Battambang"', '"Noto Sans Khmer"', '"Khmer OS Muol Light"', 'cursive'],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1', // Indigo
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
        accent: {
          500: '#14b8a6', // Teal
          600: '#0d9488',
        },
        khmer: {
          red: '#E03C31',
          blue: '#0033A0',
        },
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        card: '0 0 0 1px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.04)',
        glow: '0 0 20px rgba(99, 102, 241, 0.15)',
      },
    },
  },
  plugins: [],
};
