/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PRD 10.1 主题色
        primary: {
          DEFAULT: '#4a8eff',
          dark: '#3a7aee',
          light: '#f0f6ff',
          50: '#f0f6ff',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f0f2f6',
        },
        border: {
          DEFAULT: '#e6eaef',
          strong: '#d0d6df',
        },
        text: {
          DEFAULT: '#1a1a2e',
          secondary: '#6b7280',
          light: '#9aa0b0',
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      borderRadius: {
        card: '20px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 4px 16px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.02)',
        primary: '0 6px 16px rgba(74,142,255,0.25)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Segoe UI', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
