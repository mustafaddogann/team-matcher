/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rausch: '#FF385C',
        'rausch-dark': '#E31C5F',
        'rausch-light': '#FF5A5F',
        hof: '#484848',
        foggy: '#767676',
        babu: '#00A699',
        arches: '#FC642D',
        hackberry: '#222222',
        kazan: '#F7F7F7',
        'kazan-dark': '#EBEBEB',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Source Code Pro"', 'monospace'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
        full: '9999px',
      },
      boxShadow: {
        'airbnb': '0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
        'airbnb-md': '0 2px 4px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.08)',
        'airbnb-lg': '0 6px 20px rgba(0,0,0,0.12)',
        'airbnb-xl': '0 8px 28px rgba(0,0,0,0.16)',
        'airbnb-hover': '0 2px 4px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)',
        'airbnb-border': '0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-3d': '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06), 0 12px 40px rgba(0,0,0,0.04)',
        'card-3d-hover': '0 4px 8px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.1), 0 24px 60px rgba(0,0,0,0.06)',
        'glass': '0 4px 30px rgba(0,0,0,0.06)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.8)',
      },
      animation: {
        'pulse-live': 'pulse-live 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'float-slow': 'float-slow 25s ease-in-out infinite',
        'float-slow-reverse': 'float-slow-reverse 30s ease-in-out infinite',
        'float-diagonal': 'float-diagonal 35s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
      },
      keyframes: {
        'pulse-live': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(1.3)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-30px) rotate(3deg)' },
        },
        'float-slow-reverse': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(20px) rotate(-2deg)' },
        },
        'float-diagonal': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '33%': { transform: 'translate(15px, -20px) rotate(2deg)' },
          '66%': { transform: 'translate(-10px, 10px) rotate(-1deg)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
}
