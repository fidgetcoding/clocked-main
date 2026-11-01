import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    // Square corners everywhere: the shape language is the slanted plate. `dot` is for the on-air light.
    borderRadius: {
      none: "0",
      sm: "0",
      DEFAULT: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "0",
      dot: "9999px",
    },
    // A step up from the Tailwind defaults, because condensed faces run about 20% narrower
    fontSize: {
      xs: ["0.8125rem", { lineHeight: "1.2" }],
      sm: ["0.9375rem", { lineHeight: "1.28" }],
      base: ["1.0625rem", { lineHeight: "1.3" }],
      lg: ["1.25rem", { lineHeight: "1.2" }],
      xl: ["1.5rem", { lineHeight: "1.05" }],
      "2xl": ["1.875rem", { lineHeight: "1" }],
      "3xl": ["2.375rem", { lineHeight: "0.96" }],
      "4xl": ["3rem", { lineHeight: "0.92" }],
      "5xl": ["3.75rem", { lineHeight: "0.9" }],
      "6xl": ["4.5rem", { lineHeight: "0.88" }],
      "7xl": ["5.75rem", { lineHeight: "0.86" }],
      "8xl": ["7.5rem", { lineHeight: "0.86" }],
      "9xl": ["10rem", { lineHeight: "0.86" }],
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Custom Get Clocked colors
        volt: "hsl(var(--electric-volt))",
        "tech-black": "hsl(var(--tech-black))",
        "alert-red": "hsl(var(--alert-red))",
        
        "surface-1": "hsl(var(--surface-1))",
        "surface-2": "hsl(var(--surface-2))",
        "surface-3": "hsl(var(--surface-3))",
        "championship-gold": "hsl(var(--championship-gold) / <alpha-value>)",
        "cooldown-blue": "hsl(var(--cooldown-blue) / <alpha-value>)",
      },
      fontFamily: {
        sans: "var(--font-text)",
        display: "var(--font-display)",
      },
      fontSize: {
        timer: ["4.5rem", { lineHeight: "0.86" }],
        "timer-lg": ["6rem", { lineHeight: "0.86" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          from: { transform: "translateY(-100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "xp-bubble": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-30px)", opacity: "0" },
        },
        "combo-xp-pop": {
          "0%": { transform: "translateY(0)", opacity: "0.9" },
          "50%": { opacity: "0.7" },
          "100%": { transform: "translateY(-24px)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "xp-bubble": "xp-bubble 2s ease-out forwards",
        "combo-xp-pop": "combo-xp-pop 1.2s ease-out forwards",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-top": "env(safe-area-inset-top)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
