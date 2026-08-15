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
        // VeggieVan: produce-green led, with the tomato-red / carrot-orange
        // accent pair called for in the business plan's brand direction.
        vv: {
          // The two official logo colours. Taken from the brand artwork, so
          // the wordmark in the header matches public/logo.svg exactly.
          forest: "#0B4427",
          fresh: "#498E32",
          red: "#E63946", // tomato accent
          yellow: "#F4D03F", // lemon / mustard-flower accent
          orange: "#F39C12", // carrot accent
          leaf: "#5FA845", // primary brand green (the van)
          leafDark: "#3D7A2B",
          cream: "#FFF8EC", // warm off-white, matches the product illustrations
          ink: "#16261A",
          mute: "#6B7A6E",
          line: "#E8E3D6",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 12px -2px rgba(27, 42, 31, 0.08)",
        lift: "0 12px 32px -10px rgba(27, 42, 31, 0.18)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        bounceSoft: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.18)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "bounce-soft": "bounceSoft 0.4s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
