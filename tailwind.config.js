export default {
  content: [
    './resources/**/*.{blade.php,php,js,jsx,ts,tsx,vue}',
    './src/**/*.{js,jsx,ts,tsx}',   // include your React code
    './index.html',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Dark mode glass colors
        glass: {
          dark: {
            bg: 'rgba(30, 41, 59, 0.6)',
            border: 'rgba(148, 163, 184, 0.2)',
            text: 'rgb(203, 213, 225)',
          }
        }
      },
      transitionDuration: {
        '400': '400ms',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
