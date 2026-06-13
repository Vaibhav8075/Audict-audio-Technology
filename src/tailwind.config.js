
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
        sageGreen: "#8C9A86",
        slateBlue: "#7F8E9C",

        
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
        surface: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          800: '#27272a',
          850: '#1f1f22',
          900: '#18181b',
          950: '#09090b',
        },
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0,0,0,0.12)',
        'glow': '0 0 20px rgba(249,115,22,0.3)',
        'card': '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.08)',
        'card-dark': '0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.3)',
      },
      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideRight: { from: { opacity: 0, transform: 'translateX(-8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        pulseGlow: { '0%, 100%': { boxShadow: '0 0 8px rgba(249,115,22,0.3)' }, '50%': { boxShadow: '0 0 20px rgba(249,115,22,0.6)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
