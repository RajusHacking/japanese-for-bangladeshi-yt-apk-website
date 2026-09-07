/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#8B1E1E',
          redHover: '#7A1A1A',
          light: '#fdf2f2',
          dark: '#3f0d0d'
        },
        dark: {
          bg: '#000000',
          surface: '#18181B', // Zinc-900
          card: '#27272A', // Zinc-800
          border: '#3F3F46' // Zinc-700
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        jp: ['"Noto Sans JP"', 'sans-serif'],
        bn: ['"Noto Sans Bengali"', 'sans-serif']
      }
    },
  },
  plugins: [],
}
