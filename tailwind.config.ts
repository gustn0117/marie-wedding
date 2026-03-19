import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B2A4A',
          light: '#2E4470',
          dark: '#111D35',
          50: '#F0F3F8',
          100: '#D9E0ED',
          200: '#B3C1DB',
          300: '#7A92BA',
          400: '#4A6899',
          500: '#2E4470',
          600: '#1B2A4A',
          700: '#152240',
          800: '#111D35',
          900: '#0B1424',
        },
        secondary: {
          DEFAULT: '#F5F6F8',
          50: '#FAFBFC',
          100: '#F5F6F8',
          200: '#E8EBF0',
          300: '#D1D5DE',
          400: '#B8BFC9',
        },
        accent: {
          DEFAULT: '#4A6899',
          light: '#7A92BA',
          dark: '#2E4470',
          50: '#F0F3F8',
          100: '#D9E0ED',
          200: '#B3C1DB',
          300: '#7A92BA',
          400: '#4A6899',
          600: '#2E4470',
        },
        background: '#FFFFFF',
        surface: '#FFFFFF',
        border: '#E5E7EB',
        'text-primary': '#1A1A1A',
        'text-secondary': '#4B5563',
        'text-muted': '#9CA3AF',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
    },
  },
  plugins: [],
};
export default config;
