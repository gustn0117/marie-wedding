import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand — Warm burgundy / wine
        primary: {
          DEFAULT: '#7a1d2e',
          light: '#9c3b4f',
          dark: '#5c1422',
          50: '#fbf5f5',
          100: '#f5e6e8',
          200: '#ecd0d4',
          300: '#dba1a9',
          400: '#c4707c',
          500: '#a64558',
          600: '#7a1d2e',
          700: '#651825',
          800: '#52131e',
          900: '#3f0e17',
        },
        // Cream / Ivory / Beige neutrals (warm gray scale)
        secondary: {
          DEFAULT: '#f8f3eb',
          50: '#faf7f1',
          100: '#f4ede1',
          200: '#ebe0cd',
          300: '#dbc9ac',
          400: '#b8a585',
          500: '#8f7d63',
          600: '#6b5b46',
          700: '#4a3f31',
        },
        // Warm gray scale (replaces cool tailwind gray-* references via overrides)
        gray: {
          50: '#faf7f3',
          100: '#f3ede5',
          200: '#e7ddd0',
          300: '#d4c5b1',
          400: '#a89580',
          500: '#7a6a57',
          600: '#574a3b',
          700: '#3d3327',
          800: '#26201a',
          900: '#1a1510',
          950: '#0f0c08',
        },
        // Accent — muted gold for highlights (verified / promoted)
        accent: {
          DEFAULT: '#a7763a',
          50: '#fbf6ee',
          100: '#f5e9d2',
          200: '#e9d2a3',
          300: '#d4b06e',
          400: '#bc8e48',
          500: '#a7763a',
          600: '#85592b',
          700: '#684525',
        },
        state: {
          urgent: '#a8312f',
          'urgent-bg': '#f9ecea',
          new: '#5e7a3a',
          'new-bg': '#f1f3e8',
          verified: '#7a1d2e',
          'verified-bg': '#f5e6e8',
          promoted: '#a7763a',
          'promoted-bg': '#fbf6ee',
        },
        background: '#faf7f1',
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f8f3eb',
        },
        border: '#e7ddd0',
        'text-primary': '#1a1510',
        'text-secondary': '#574a3b',
        'text-muted': '#a89580',
      },
      fontFamily: {
        serif: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        micro: ['11px', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        small: ['12.5px', { lineHeight: '1.45' }],
        body: ['14px', { lineHeight: '1.6' }],
        'body-lg': ['15px', { lineHeight: '1.55' }],
        h4: ['17px', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
        h3: ['20px', { lineHeight: '1.35', letterSpacing: '-0.015em' }],
        h2: ['26px', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
        h1: ['32px', { lineHeight: '1.2', letterSpacing: '-0.025em' }],
      },
      borderRadius: {
        DEFAULT: '2px',
        sm: '1px',
        md: '2px',
        lg: '3px',
        xl: '4px',
      },
      transitionDuration: {
        instant: '100ms',
        quick: '150ms',
        base: '200ms',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(26, 21, 16, 0.04), 0 1px 1px rgba(26, 21, 16, 0.02)',
        card: '0 1px 3px rgba(26, 21, 16, 0.06)',
        lift: '0 4px 12px rgba(26, 21, 16, 0.08)',
      },
    },
  },
  plugins: [],
};
export default config;
