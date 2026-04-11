import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Satoshi", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F4F5F0",
        },
        accent: "#D97706",
      },
      boxShadow: {
        soft: "0 4px 40px -2px rgba(22, 101, 52, 0.08)",
        float: "0 20px 40px -8px rgba(0, 0, 0, 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
