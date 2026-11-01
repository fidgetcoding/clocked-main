import { cva } from "class-variance-authority";

// Every button is a plate. The tone goes on the plate behind the text, so a background colour
// passed in from a screen has no effect: pick a variant.
export const buttonVariants = cva(
  "plate fx gap-2 whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "plate-lime",
        destructive: "plate-red",
        outline: "plate-outline",
        secondary: "plate-graphite",
        steel: "plate-steel",
        white: "plate-white",
        black: "plate-black",
        gold: "plate-gold",
        ghost: "plate-clear hover:text-volt",
        link: "plate-clear text-volt underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 text-2xl",
        sm: "h-11 px-4 text-xl",
        lg: "h-16 px-8 text-4xl",
        xl: "h-20 px-8 text-5xl",
        icon: "h-11 w-12 text-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
