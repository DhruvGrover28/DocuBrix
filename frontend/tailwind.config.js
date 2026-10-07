/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(220 25% 88%)',
        input: 'hsl(220 25% 96%)',
        ring: 'hsl(224 76% 48%)',
        background: 'hsl(210 40% 98%)',
        foreground: 'hsl(222 47% 11%)',
        primary: {
          DEFAULT: 'hsl(224 76% 48%)',
          foreground: 'hsl(0 0% 100%)',
        },
        secondary: {
          DEFAULT: 'hsl(220 25% 96%)',
          foreground: 'hsl(222 47% 11%)',
        },
        muted: {
          DEFAULT: 'hsl(220 25% 96%)',
          foreground: 'hsl(220 10% 40%)',
        },
        accent: {
          DEFAULT: 'hsl(160 58% 42%)',
          foreground: 'hsl(0 0% 100%)',
        },
        success: {
          DEFAULT: 'hsl(142 76% 36%)',
          foreground: 'hsl(0 0% 100%)',
        },
        warning: {
          DEFAULT: 'hsl(38 92% 50%)',
          foreground: 'hsl(0 0% 100%)',
        },
        danger: {
          DEFAULT: 'hsl(0 72% 51%)',
          foreground: 'hsl(0 0% 100%)',
        },
      },
      boxShadow: {
        soft: '0 12px 24px rgba(15, 23, 42, 0.06)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
