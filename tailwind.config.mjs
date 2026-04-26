/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF7F3",
        ink: "#3A3530",
        rule: "#B9B6B1",
        muted: "#D2CFCA",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Rubik", "sans-serif"],
      },
      spacing: {
        grid: "50px",
        "grid-half": "25px",
        "grid-2": "100px",
        "grid-3": "150px",
      },
    },
  },
  plugins: [],
};
