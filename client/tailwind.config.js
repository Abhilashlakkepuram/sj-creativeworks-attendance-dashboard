/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f1fafa',
          100: '#dbf2f3',
          200: '#bae5e9',
          300: '#8ad3d9',
          400: '#52b8c2',
          500: '#349aa6',
          600: '#1a8b9d', // Base Logo Teal
          700: '#256775',
          800: '#245663',
          900: '#224853',
          950: '#122e37',
        },
        secondary: {
          50: '#fef3f4',
          100: '#fde4e6',
          200: '#fbcad0',
          300: '#f7a2ab',
          400: '#f26f7a',
          500: '#f05a66', // Base Logo Reddish-Pink
          600: '#db3644',
          700: '#b82633',
          800: '#99232d',
          900: '#81232b',
          950: '#460e14',
        }
      }
    },
  },
  plugins: [],
}

