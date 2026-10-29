"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invitationDeliveryMessage, type InvitationDelivery } from "@/lib/services/email-delivery-service";

// Panneau « compte créé » d'une invitation — partagé par l'invitation d'un
// interlocuteur client, l'ouverture d'un accès par une structure et l'invitation d'un
// membre de l'équipe EODA (D1 : un seul rendu).
//
// Aucun mot de passe n'existe ni ne s'affiche (audit du 28/10/2026) : la personne
// choisit le sien par un lien à usage unique. Ce lien n'apparaît ICI que s'il n'est PAS
// parti par e-mail, pour être transmis autrement ; l'état d'envoi est DIT, jamais supposé.
export function SetupLinkPanel({
  userName,
  userEmail,
  setupLink,
  invitationDelivery,
  title = `Compte créé pour ${userName}`,
}: {
  userName: string;
  userEmail: string;
  setupLink: string | null;
  invitationDelivery: InvitationDelivery;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const delivery = invitationDeliveryMessage(invitationDelivery, userEmail);

  function copyLink() {
    if (!setupLink) return;
    void navigator.clipboard.writeText(setupLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start gap-3 rounded-lg border border-vert-ok/30 bg-vert-ok/10 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-ok-text" aria-hidden="true" />
        <div>
          <p className="font-semibold text-ink">{title}</p>
          <p className="text-ink2">{userEmail}</p>
        </div>
      </div>
      <div className="space-y-2.5 rounded-lg border border-line bg-soft p-4">
        <p role="status" className="flex items-center gap-1.5 text-ink2">
          {delivery.tone === "ok" ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-ok-text" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-text" aria-hidden="true" />
          )}
          {delivery.text}
        </p>
        {setupLink && (
          <>
            <p className="font-medium text-ink2">Lien pour choisir le mot de passe — à transmettre à la personne elle-même</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded border border-line bg-card px-3 py-2.5 font-mono text-ink">{setupLink}</code>
              <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label={copied ? "Lien copié" : "Copier le lien"}>
                {copied ? <CheckCircle2 className="h-4 w-4 text-ok-text" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </div>
            <p className="flex items-center gap-1.5 text-rouge-imp">
              <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              Valable 3 jours, une seule fois. Il ne sera plus affiché : copiez-le avant de fermer.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
