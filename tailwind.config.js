/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#7c3aed', light: '#a78bfa', dark: '#6d28d9', soft: '#2d1f5e' }
      }
    }
  },
  plugins: [],
}
