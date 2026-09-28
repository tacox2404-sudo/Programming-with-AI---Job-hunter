/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0B0F',
        card: '#16161C',
        card2: '#1E1E26',
        line: 'rgba(255,255,255,0.08)',
        mute: '#8E8E9A',
        accent: '#FF3D6E',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        brand: 'linear-gradient(95deg, #FF5A4E 0%, #FF2E7E 100%)',
      },
    },
  },
  plugins: [],
};
