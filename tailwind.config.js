/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./body_comp_tracking/gui/templates/**/*.html",
    "./body_comp_tracking/gui/app.py", // If you generate HTML with Tailwind classes in Python
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
