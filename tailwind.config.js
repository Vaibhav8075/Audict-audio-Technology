
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        
        desertRock: "#A48D78",
        softSandstone: "#CBB9A4",
        creamedOat: "#E6DAC8",
        porcelainMist: "#F4F1EA",
        featherWhite: "#FAF9F6",

        
        mochaEarth: "#4B3935",
        vanillaCream: "#F0E7D5",

        
        bordeauxVelvet: "#53161D",
        ivoryWhisper: "#FFFBF0",

        
        brand: {
          50: '#FAF9F6', 
          100: '#FFFBF0', 
          200: '#F0E7D5', 
          300: '#E6DAC8', 
          400: '#CBB9A4', 
          500: '#A48D78', 
          600: '#8E7762', 
          700: '#4B3935', 
          800: '#342522', 
          900: '#53161D', 
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'orange-glow': '0 0 24px rgba(164, 141, 120, 0.35)', 
        'brand-glow': '0 0 24px rgba(164, 141, 120, 0.35)',
        elevated: '0 16px 40px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
}
