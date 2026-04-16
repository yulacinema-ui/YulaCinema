/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'apple-bg': '#000000',
        'apple-card': '#1c1c1e',
        'apple-accent': '#0a84ff',
        'apple-success': '#32d74b',
        'apple-text': '#ffffff',
        'apple-secondary': '#8e8e93',
        'apple-border': 'rgba(255, 255, 255, 0.1)',
        'apple-input': 'rgba(44, 44, 46, 0.6)',
      },
      backdropBlur: {
        'apple': '20px',
      },
      animation: {
        'pulse-slow': 'pulse 2s infinite',
        'slide-in': 'slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        pulse: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(5px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}