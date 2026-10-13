"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invitationDeliveryMessage, type InvitationDelivery } from "@/lib/services/email-delivery-service";

// Panneau « compte créé » d'une invitation — partagé par l'invitation d'un
// interlocuteur client et celle d'un membre de l'équipe EODA (D1 : un seul rendu du
// mot de passe temporaire). Le mot de passe n'est affiché qu'ICI, une seule fois, et
// n'est stocké nulle part ; l'état d'envoi de l'e-mail est DIT, jamais supposé.
export function TemporaryPasswordPanel({
  userName,
  userEmail,
  tempPassword,
  invitationDelivery,
}: {
  userName: string;
  userEmail: string;
  tempPassword: string;
  invitationDelivery: InvitationDelivery;
}) {
  const [copied, setCopied] = useState(false);
  const delivery = invitationDeliveryMessage(invitationDelivery, userEmail);

  function copyPassword() {
    void navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start gap-3 rounded-lg border border-vert-ok/30 bg-vert-ok/10 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-vert-ok" aria-hidden="true" />
        <div>
          <p className="font-semibold text-ink">Compte créé pour {userName}</p>
          <p className="text-ink2">{userEmail}</p>
        </div>
      </div>
      <div className="space-y-2.5 rounded-lg border border-line bg-soft p-4">
        <p className="font-medium text-ink2">Mot de passe temporaire — à communiquer à la personne</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded border border-line bg-card px-3 py-2.5 font-mono tracking-wider text-ink tabular-nums">
            {tempPassword}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copyPassword}
            aria-label={copied ? "Mot de passe copié" : "Copier le mot de passe"}
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-vert-ok" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-rouge-imp">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Ce mot de passe ne sera plus affiché. Copiez-le avant de fermer.
        </p>
        <p role="status" className="flex items-center gap-1.5 text-ink2">
          {delivery.tone === "ok" ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-vert-ok" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-ambre" aria-hidden="true" />
          )}
          {delivery.text}
        </p>
      </div>
    </div>
  );
}
