/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral Luxury Palette
        desertRock: "#A48D78",
        softSandstone: "#CBB9A4",
        creamedOat: "#E6DAC8",
        porcelainMist: "#F4F1EA",
        featherWhite: "#FAF9F6",

        // Coffee / Earth Palette
        mochaEarth: "#4B3935",
        vanillaCream: "#F0E7D5",

        // Wine / Ivory Palette
        bordeauxVelvet: "#53161D",
        ivoryWhisper: "#FFFBF0",

        // Map standard brand colors to desertRock & mochaEarth for backwards compatibility
        brand: {
          50: '#FAF9F6', // featherWhite
          100: '#FFFBF0', // ivoryWhisper
          200: '#F0E7D5', // vanillaCream
          300: '#E6DAC8', // creamedOat
          400: '#CBB9A4', // softSandstone
          500: '#A48D78', // desertRock (Primary brand color)
          600: '#8E7762', // slightly darker desertRock
          700: '#4B3935', // mochaEarth
          800: '#342522', // darker mochaEarth
          900: '#53161D', // bordeauxVelvet
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'orange-glow': '0 0 24px rgba(164, 141, 120, 0.35)', // mapped to desertRock glow
        'brand-glow': '0 0 24px rgba(164, 141, 120, 0.35)',
        elevated: '0 16px 40px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
}
