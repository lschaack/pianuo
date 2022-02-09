module.exports = {
  content: [],
  purge: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      animation: {
        // unblur: 'unblur 5s ease-out 0s 1'
        unblur: 'unblur 0.5s ease-out',
        wiggle: 'wiggle 1s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        unblur: {
          '100%': {
            filter: 'blur(0)'
          },
          '0%': {
            filter: 'blur(4px)'
          },
        }
      }
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
