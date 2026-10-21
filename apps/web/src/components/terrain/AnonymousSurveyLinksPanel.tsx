"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Link2, Loader2 } from "lucide-react";
import { createAnonymousSurveyLinks, type CreateLinksResult } from "@/lib/actions/anonymous-survey";
import { formatDate } from "@/lib/services/date-format-service";
import { Button } from "@/components/ui/button";

// Liens d'enquête ANONYME à usage unique (21/10/2026). La structure les remet à qui
// elle veut — e-mail, SMS, papier — : un lien ne désigne personne. Ils ne sont
// montrés qu'une fois, ici : la base n'en garde que l'empreinte.
export function AnonymousSurveyLinksPanel({ establishmentId }: { establishmentId: string }) {
  const [result, setResult] = useState<CreateLinksResult | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  useEffect(() => setOrigin(window.location.origin), []);

  const links = result && !("error" in result) ? result.tokens.map((t) => `${origin}/enquete/${t}`) : [];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("establishmentId", establishmentId);
    setCopied(false);
    startTransition(async () => setResult(await createAnonymousSurveyLinks(data)));
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(links.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-labelledby="enquete-liens" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5">
      <div>
        <h2 id="enquete-liens" className="text-xl font-bold">
          Envoyer l&apos;enquête par lien
        </h2>
        <p className="mt-1 max-w-[65ch] text-ink2">
          Anonyme : chaque lien sert une seule fois et ne désigne personne. Envoyez-le par e-mail ou par SMS aux
          personnes accompagnées et à leurs proches — un lien par questionnaire rempli.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-bold">Questionnaire</span>
          <select name="templateCode" defaultValue="PERSONNE" className="min-h-11 rounded-lg border border-line bg-card px-3 text-ink">
            <option value="PERSONNE">Personne accompagnée</option>
            <option value="FAMILLE">Famille ou proche</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-bold">Nombre de liens</span>
          <input
            name="count"
            type="number"
            min={1}
            max={100}
            defaultValue={10}
            required
            className="min-h-11 w-28 rounded-lg border border-line bg-card px-3 tabular-nums text-ink"
          />
        </label>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
          Créer les liens
        </Button>
      </form>
      {result && "error" in result && (
        <p role="alert" className="text-danger-text">
          {result.error}
        </p>
      )}
      {links.length > 0 && result && !("error" in result) && (
        <div className="flex flex-col gap-2" role="status">
          <p>
            {links.length} lien{links.length > 1 ? "s" : ""} prêt{links.length > 1 ? "s" : ""}, valables jusqu&apos;au{" "}
            {formatDate(result.expiresAt)}. Copiez-les maintenant : ils ne seront plus affichés.
          </p>
          <textarea
            readOnly
            rows={Math.min(links.length, 8)}
            value={links.join("\n")}
            aria-label="Liens d'enquête à envoyer"
            className="w-full rounded-lg border border-line bg-paper p-3 font-mono text-sm text-ink"
          />
          <Button type="button" variant="outline" className="w-fit" onClick={() => void copyAll()}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? "Copiés" : "Copier tous les liens"}
          </Button>
        </div>
      )}
    </section>
  );
}
