/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#37352f',
        muted: '#6c6a65',
        line: '#e9e9e7',
        'line-strong': '#d3d1cb',
        surface: '#f7f7f5',
        soft: '#efefed',
        primary: '#37352f',
        error: '#a62c32',
      },
      boxShadow: {
        panel: '0 1px 2px #00000008, 0 4px 12px #00000006',
      },
      borderRadius: {
        panel: '0.625rem',
      },
    },
  },
  plugins: [],
}
