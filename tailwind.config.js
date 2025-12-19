/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./add-download.html",
        "./settings.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: '#1e1e1e',
                surface: '#2d2d2d',
                primary: '#3b82f6',
                'primary-hover': '#2563eb',
                'text-primary': '#ffffff',
                'text-secondary': '#a1a1aa',
                border: '#3f3f46',
            }
        },
    },
    plugins: [],
}
