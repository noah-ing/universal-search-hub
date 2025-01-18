/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0E14',
        'card-bg': '#1A1F2A',
        'card-hover': '#252B38',
        border: '#2C3340',
      },
    },
  },
  plugins: [],
}
