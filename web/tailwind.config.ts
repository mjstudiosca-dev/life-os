import type { Config } from "tailwindcss";

// Palette: warm editorial. Cream + plum + sage + rust + mustard.
// Avoids the Apple/Material grey-and-blue look most apps default to.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', "ui-serif", "Georgia", "serif"],
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      colors: {
        // Surfaces
        cream:    "#f5efe6",   // page background
        sand:     "#ebe2d3",   // section/card background
        bone:     "#d4c5b1",   // subtle borders
        // Text
        ink:      "#1a1614",   // primary text (warm near-black)
        smoke:    "#574a42",   // secondary text
        ash:      "#9a8d80",   // tertiary / labels
        // Accents
        plum:     "#5e2750",   // primary action / Tier 1
        sage:     "#5d7a5e",   // secondary / Tier 2 / success
        rust:     "#a3502c",   // attention / amber-ish / time-anchored
        mustard:  "#c4a65a",   // optional / Tier 3
        oxblood:  "#3d1822",   // deep accent for headlines on cream
      },
    },
  },
  plugins: [],
};

export default config;
