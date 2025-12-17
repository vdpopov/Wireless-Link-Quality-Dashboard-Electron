/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1e1e1e',
          light: '#2d2d2d',
          lighter: '#3d3d3d'
        }
      }
    }
  },
  plugins: []
}