import type { Config } from "tailwindcss";

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
        "championship-gold": "hsl(var(--championship-gold))",
        "cooldown-blue": "hsl(var(--cooldown-blue))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        timer: ["4.5rem", { lineHeight: "1", letterSpacing: "-0.02em" }],
        "timer-lg": ["6rem", { lineHeight: "1", letterSpacing: "-0.02em" }],
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
        "pulse-volt": {
          "0%, 100%": { 
            boxShadow: "0 0 0 0 hsl(var(--electric-volt) / 0.7)" 
          },
          "50%": { 
            boxShadow: "0 0 0 10px hsl(var(--electric-volt) / 0)" 
          },
        },
        "glow-pulse": {
          "0%, 100%": { 
            boxShadow: "0 0 20px hsl(var(--electric-volt) / 0.4)" 
          },
          "50%": { 
            boxShadow: "0 0 40px hsl(var(--electric-volt) / 0.6)" 
          },
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
        "gold-shimmer": {
          "0%, 100%": { textShadow: "0 0 10px hsl(43 96% 56% / 0.6), 0 0 20px hsl(43 96% 56% / 0.3)" },
          "50%": { textShadow: "0 0 20px hsl(43 96% 56% / 0.8), 0 0 40px hsl(43 96% 56% / 0.4)" },
        },
        "arc-glow-pulse": {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "0.55" },
        },
        // Metaball blob animations
        "blob-1": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(30px, -50px) scale(1.1)" },
          "50%": { transform: "translate(-20px, 30px) scale(0.9)" },
          "75%": { transform: "translate(50px, 20px) scale(1.05)" },
        },
        "blob-2": {
          "0%, 100%": { transform: "translate(0, 0) scale(1.1)" },
          "33%": { transform: "translate(-60px, 40px) scale(0.95)" },
          "66%": { transform: "translate(40px, -30px) scale(1.15)" },
        },
        "blob-3": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "20%": { transform: "translate(70px, 30px) scale(1.1)" },
          "40%": { transform: "translate(-30px, 60px) scale(0.85)" },
          "60%": { transform: "translate(50px, -40px) scale(1.05)" },
          "80%": { transform: "translate(-50px, -20px) scale(0.95)" },
        },
        "blob-4": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-80px, -40px) scale(1.2)" },
        },
        "blob-5": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(-40px, 50px) scale(1.15)" },
          "50%": { transform: "translate(60px, 20px) scale(0.9)" },
          "75%": { transform: "translate(20px, -60px) scale(1.1)" },
        },
        "blob-6": {
          "0%, 100%": { transform: "translate(0, 0) scale(1.05)" },
          "40%": { transform: "translate(50px, 60px) scale(0.9)" },
          "70%": { transform: "translate(-40px, -30px) scale(1.15)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-volt": "pulse-volt 2s infinite",
        "glow-pulse": "glow-pulse 2s infinite",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "xp-bubble": "xp-bubble 2s ease-out forwards",
        "combo-xp-pop": "combo-xp-pop 1.2s ease-out forwards",
        "gold-shimmer": "gold-shimmer 2s ease-in-out infinite",
        "arc-glow-pulse": "arc-glow-pulse 2s ease-in-out infinite",
        // Metaball blob animations
        "blob-1": "blob-1 18s ease-in-out infinite",
        "blob-2": "blob-2 22s ease-in-out infinite",
        "blob-3": "blob-3 25s ease-in-out infinite",
        "blob-4": "blob-4 30s ease-in-out infinite",
        "blob-5": "blob-5 20s ease-in-out infinite",
        "blob-6": "blob-6 28s ease-in-out infinite",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-top": "env(safe-area-inset-top)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
