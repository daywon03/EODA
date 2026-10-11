"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "./input";
import { cn } from "@/lib/utils";

// Champ de mot de passe avec un œil « afficher / masquer » (retour de démo du 15/09 :
// un mot de passe temporaire recopié à la main se tape mal sans le voir). Un seul
// composant pour tous les champs de mot de passe — jamais un œil recopié par
// formulaire. Le bouton est une vraie cible de 44 px, annoncée par son état
// (`aria-pressed`) et son libellé ; il n'envoie jamais le formulaire.
export type PasswordInputProps = Omit<InputProps, "type">;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [isVisible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={isVisible ? "text" : "password"}
          className={cn("pr-12", className)}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={isVisible}
          aria-label={isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex h-11 w-11 items-center justify-center rounded-md text-ink2 hover:text-ink disabled:opacity-50"
        >
          {isVisible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
