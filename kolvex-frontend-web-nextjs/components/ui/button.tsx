"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex max-w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none disabled:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        /* iOS-style lens glass: `glass-button` adds the blur, rim and glow, while
           translucent utilities carry each variant's fill and hover states.
           Filled brand action: tinted glass that hovers darker so the label keeps
           its contrast. This is the one control that stays green outside
           direction semantics. */
        default:
          "glass-button glass-button-primary bg-primary/85 text-primary-foreground hover:bg-primary/75 active:bg-primary/70 disabled:opacity-40",
        secondary:
          "glass-button glass-button-neutral bg-foreground/[0.14] text-foreground hover:bg-foreground/[0.2] focus-visible:bg-foreground/[0.2] active:bg-foreground/[0.25] disabled:opacity-40",
        /* Neutral actions take a grey wash on hover and press so green keeps
           meaning direction rather than interaction. */
        outline:
          "glass-button glass-button-neutral border border-transparent bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.13] focus-visible:bg-foreground/[0.13] active:bg-foreground/[0.18] disabled:opacity-40",
        destructive:
          "glass-button glass-button-destructive bg-destructive/85 text-destructive-foreground hover:bg-destructive/75 active:bg-destructive/70 disabled:opacity-40",
        /* Stays bare at rest so toolbars of icons don't become rows of bubbles;
           the glass appears on hover and press. */
        ghost:
          "glass-button-ghost font-medium text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground active:bg-foreground/[0.12] disabled:opacity-40",
        /* Link and text actions rest on `foreground`, not `positive`: green
           text is reserved for direction, so a plain navigation link must not
           read as "price is up". */
        link: "text-foreground underline-offset-4 underline hover:text-muted-foreground active:opacity-80 disabled:opacity-40",
        text: "text-foreground hover:opacity-70 active:opacity-60 !p-0 !h-auto !w-auto disabled:opacity-40",
        /* Filter / option chip. Selected state comes from the `selected` prop. */
        chip: "border border-border font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        /* Bare icon in a toolbar (charts, editors). Selected state comes from `selected`. */
        toolbar: "font-medium text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1] disabled:opacity-40",
        icon: "glass-button glass-button-primary bg-primary/85 text-primary-foreground hover:bg-primary/75 active:bg-primary/70 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
      },
      size: {
        default: "h-11 px-6 py-2",
        xs: "h-8 px-3 text-xs",
        md: "h-10 px-5 py-2",
        sm: "h-9 px-4 py-2",
        lg: "h-12 px-8 py-2.5 text-[0.9375rem]",
        icon: "h-9 w-9",
        chip: "min-h-9 px-3.5",
        toolbar: "h-11 w-11 sm:h-8 sm:w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Selected look for `chip` and `toolbar` buttons. */
  selected?: boolean;
}

const SELECTED: Partial<Record<string, string>> = {
  chip: "border-foreground bg-foreground text-background hover:text-background",
  toolbar: "glass-thumb glass-thumb-touch text-foreground hover:bg-transparent",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, selected, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), selected && variant && SELECTED[variant], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
