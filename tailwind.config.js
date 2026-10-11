/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--raritone-canvas) / <alpha-value>)",
        chrome: "rgb(var(--raritone-chrome) / <alpha-value>)",
        raise: "rgb(var(--raritone-raise) / <alpha-value>)",
        muted: "rgb(var(--raritone-muted) / <alpha-value>)",
        /**
         * The neutral ramp the dark UI is built from. The scale is inverted —
         * 950 is the page background and 100 is the brightest foreground — so
         * `bg-ink-950` and `text-ink-100` read as opposites at a glance.
         */
        ink: {
          950: "rgb(5 5 8 / <alpha-value>)",
          900: "rgb(7 7 11 / <alpha-value>)",
          850: "rgb(12 12 18 / <alpha-value>)",
          800: "rgb(16 16 24 / <alpha-value>)",
          700: "rgb(26 26 38 / <alpha-value>)",
          600: "rgb(60 60 78 / <alpha-value>)",
          500: "rgb(110 110 130 / <alpha-value>)",
          400: "rgb(var(--raritone-muted) / <alpha-value>)",
          300: "rgb(196 196 210 / <alpha-value>)",
          200: "rgb(226 226 236 / <alpha-value>)",
          100: "rgb(var(--raritone-ink) / <alpha-value>)",
          DEFAULT: "rgb(var(--raritone-ink) / <alpha-value>)",
        },
        violet: {
          electric: "rgb(var(--raritone-violet) / <alpha-value>)",
        },
        cyan: {
          signal: "rgb(var(--raritone-cyan) / <alpha-value>)",
        },
        /**
         * The raritone.com surface is a light, editorial canvas: warm paper,
         * charcoal type, and a single warm-yellow accent reserved for streaks,
         * rewards, and the actions that matter most.
         */
        paper: "#FAF9F6",
        cream: "#F3EFE7",
        sand: "#E8E1D3",
        coal: {
          DEFAULT: "#181611",
          700: "#3F3B33",
          500: "#6E6759",
          400: "#8B8375",
        },
        gold: {
          DEFAULT: "#F2AF0C",
          deep: "#8A6403",
          soft: "#FBF1D2",
        },
      },
      /**
       * Tailwind's default opacity scale skips the values this design uses for
       * its glass surfaces. Without these, `bg-white/8` and `border-white/12`
       * compile to nothing and the surfaces silently lose their definition.
       */
      opacity: {
        ...require("tailwindcss/defaultTheme").opacity,
        4: "0.04",
        6: "0.06",
        8: "0.08",
        12: "0.12",
        15: "0.15",
        18: "0.18",
        25: "0.25",
        35: "0.35",
        45: "0.45",
        55: "0.55",
        65: "0.65",
        85: "0.85",
      },
      fontFamily: {
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Fraunces"', '"DM Sans"', "ui-serif", "serif"],
        mono: ['"DM Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: {
        phone: "390px",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "220% 0" },
          "100%": { backgroundPosition: "-20% 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "sheet-in": {
          "0%": { opacity: "0", transform: "translateY(28px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%": { opacity: "0.85", transform: "scale(0.92)" },
          "70%": { opacity: "0", transform: "scale(1.5)" },
          "100%": { opacity: "0", transform: "scale(1.5)" },
        },
        "rec-ring": {
          "0%": { transform: "scale(0.55)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-8%)" },
          "100%": { transform: "translateY(108%)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "bounce-dot": {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.45" },
          "40%": { transform: "translateY(-4px)", opacity: "1" },
        },
        "float-y": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s linear infinite",
        "fade-up": "fade-up 260ms cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 200ms ease-out both",
        "sheet-in": "sheet-in 300ms cubic-bezier(0.22,1,0.36,1) both",
        "pop-in": "pop-in 200ms cubic-bezier(0.22,1,0.36,1) both",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.24,0.8,0.36,1) infinite",
        "rec-ring": "rec-ring 1.15s cubic-bezier(0.24,0.8,0.36,1) infinite",
        "scan-line": "scan-line 2.6s ease-in-out infinite",
        "spin-slow": "spin-slow 1.1s linear infinite",
        "bounce-dot": "bounce-dot 1.1s ease-in-out infinite",
        "float-y": "float-y 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
