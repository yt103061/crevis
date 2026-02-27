import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans JP"', '-apple-system', 'BlinkMacSystemFont', '"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', 'system-ui', 'sans-serif'],
        num: ['"Oswald"', '"DIN Alternate"', '"DIN 2014"', '"Noto Sans JP"', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;
