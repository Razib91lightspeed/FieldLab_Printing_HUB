/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: '#F8F7FC', // Very light purple/white
          card: '#FFFFFF',
          primary: '#8B5CF6', // Violet 500
          secondary: '#A78BFA', // Violet 400
          accent: '#EDE9FE', // Violet 100
          text: '#1F2937', // Gray 800
          subtext: '#6B7280', // Gray 500
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        }
      }
    },
  },
  plugins: [],
}