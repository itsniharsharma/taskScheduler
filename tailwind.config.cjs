/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        emeraldMain: "#0f9f6e",
        emeraldDeep: "#0c7f59",
        mintGlow: "#d8ffe9",
        neutralPanel: "#f7fff9"
      },
      boxShadow: {
        emerald: "0 14px 32px rgba(10, 136, 90, 0.28)",
        card: "0 10px 25px rgba(10, 120, 83, 0.14)"
      },
      backgroundImage: {
        "emerald-gradient": "linear-gradient(135deg, #0f9f6e 0%, #12be7f 45%, #61e8b6 100%)"
      }
    }
  },
  plugins: []
};
