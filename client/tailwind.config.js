/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        beige: {
          50: '#fbf8f1',
          100: '#f5efe1',
          200: '#e9dcbf',
        },
        sage: {
          400: '#8aa37b',
          500: '#6f8a5f',
          600: '#566f48',
        },
        bark: {
          400: '#9a7654',
          500: '#7a5a3b',
          600: '#5d4429',
          700: '#3f2e1c',
          800: '#2a1f13',
          900: '#15100a',
        },
      },
      fontFamily: {
        zen: ['"Noto Serif"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
