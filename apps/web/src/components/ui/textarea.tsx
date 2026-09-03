import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

// Champ multiligne. Les mêmes classes étaient recopiées à la main sur chaque
// `<textarea>` du dépôt — une chaîne de 300 caractères qu'on ne relit pas, et dont
// une copie finit toujours par diverger de l'autre. Elles vivent ici, comme celles
// de `Input` juste à côté.
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex w-full rounded-md border border-gris-light bg-white px-3 py-2 text-base sm:text-sm text-brun-ancre transition-colors placeholder:text-gris-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2 focus-visible:border-terre disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
