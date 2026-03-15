/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        anvil: '#111111',
        ember: '#E8553D',
        patina: '#2E9E6E',
        parchment: '#F5F2EB',
        smoke: '#8A8A8A',
        chalk: '#D4D0C8',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        display: ['"Instrument Serif"', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        body: ['"Inter"', 'sans-serif'],
      },
      borderRadius: {
        '2xl-custom': '2rem',
        '3xl-custom': '3rem',
        '4xl-custom': '4rem',
      },
    },
  },
  plugins: [],
}
