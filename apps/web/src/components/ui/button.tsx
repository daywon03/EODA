import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 cursor-pointer active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
  {
    variants: {
      // Aplats FIXES dans les deux thèmes, texte blanc dessus (maquette v2) :
      // l'ancien `bg-terre text-ivoire-light` ne faisait que 4.29:1 en clair, et
      // `bg-rouge-imp text-white` tombait à 2.3:1 en sombre, où le rouge s'éclaircit.
      // Paires vérifiées par lib/design/theme-contrast.test.ts.
      variant: {
        default: "bg-accent-fill text-on-accent shadow-eoda-sm hover:bg-accent-fill/90 hover:shadow-eoda-md",
        destructive: "bg-danger-fill text-on-accent shadow-eoda-sm hover:bg-danger-fill/90",
        outline: "border border-line bg-card hover:bg-soft hover:border-accent-text/40 text-ink",
        secondary: "bg-ink2 text-soft hover:opacity-90",
        ghost: "hover:bg-soft text-ink",
        link: "text-accent-text underline-offset-4 hover:underline",
      },
      // Toutes les tailles font au moins 44 px de haut : cible tactile minimale
      // (WCAG 2.5.5, maquettes v2). `sm` ne réduit plus que la largeur.
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-11 rounded-md px-3",
        lg: "h-12 rounded-md px-8",
        icon: "h-11 w-11",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
