/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: "#0ea5a4", fg: "#073737" },
        border: "rgba(2,6,23,0.08)"
      },
      boxShadow: { soft: "0 8px 28px rgba(2,6,23,0.08)" }
    }
  },
  plugins: []
}
