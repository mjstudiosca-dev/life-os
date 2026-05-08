import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tier accents — used sparingly across the brief
        tier1: "#ef4444", // locked in
        tier2: "#3b82f6", // plan today
        tier3: "#10b981", // optional
      },
    },
  },
  plugins: [],
};

export default config;
