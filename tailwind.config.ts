import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ashwoodTop: '#4b5563',
        ashwoodBottom: '#6b7280'
      }
    }
  },
  plugins: []
};

export default config;
