/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#1a2b53', // Dark Navy from Logo
                    hover: '#13203d',
                    light: '#64b5f6', // Light Blue from Shield
                },
                secondary: {
                    DEFAULT: '#26a69a', // Emerald from Logo
                    hover: '#1f8b7f',
                    light: '#8bc34a', // Apple Green from Checkmark
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Outfit', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
