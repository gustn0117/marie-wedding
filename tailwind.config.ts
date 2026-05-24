import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4876EF',
          light: '#6F92F7',
          dark: '#3157D5',
          50: '#F4F7FF',
          100: '#E8EEFF',
          200: '#D5DFFF',
          300: '#AFC2FF',
          400: '#7F9DFA',
          500: '#4876EF',
          600: '#3157D5',
          700: '#2543AD',
          800: '#1F398F',
          900: '#1C3274',
        },
        secondary: {
          DEFAULT: '#F5F7FA',
          50: '#FAFBFD',
          100: '#F5F7FA',
          200: '#E8ECF2',
          300: '#D8DEE8',
          400: '#B8C1D1',
        },
        accent: {
          DEFAULT: '#00A86B',
          light: '#33C78D',
          dark: '#078257',
          50: '#ECFDF6',
          100: '#D2F8E8',
          200: '#A9EFD2',
          300: '#6EDFB3',
          400: '#33C78D',
          600: '#078257',
        },
        state: {
          urgent: '#FF4D4F',
          'urgent-bg': '#FEF2F2',
          new: '#00A86B',
          'new-bg': '#ECFDF5',
          verified: '#4876EF',
          'verified-bg': '#EFF6FF',
          promoted: '#FF8A00',
          'promoted-bg': '#FFFBEB',
        },
        background: '#F5F7FA',
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F8FAFD',
        },
        border: '#DDE3ED',
        'text-primary': '#202632',
        'text-secondary': '#5D6678',
        'text-muted': '#9AA4B5',
      },
      fontFamily: {
        serif: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
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
