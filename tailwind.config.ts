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
        state: {
          urgent: '#DC2626',
          'urgent-bg': '#FEF2F2',
          new: '#059669',
          'new-bg': '#ECFDF5',
          verified: '#2563EB',
          'verified-bg': '#EFF6FF',
          promoted: '#D97706',
          'promoted-bg': '#FFFBEB',
        },
        background: '#FFFFFF',
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#FAFBFC',
        },
        border: '#E5E7EB',
        'text-primary': '#1A1A1A',
        'text-secondary': '#4B5563',
        'text-muted': '#9CA3AF',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        'micro': ['11px', { lineHeight: '1.35' }],
        'small': ['12px', { lineHeight: '1.4' }],
        'body': ['14px', { lineHeight: '1.55' }],
        'body-lg': ['15px', { lineHeight: '1.5' }],
        'h4': ['17px', { lineHeight: '1.4' }],
        'h3': ['20px', { lineHeight: '1.35' }],
        'h2': ['24px', { lineHeight: '1.3' }],
        'h1': ['28px', { lineHeight: '1.25' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.25rem',
        lg: '0.375rem',
      },
      transitionDuration: {
        'instant': '100ms',
        'quick': '150ms',
        'base': '200ms',
      },
    },
  },
  plugins: [],
};
export default config;
