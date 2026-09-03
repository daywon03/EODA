"use client";

import { useTransition } from "react";
import { getDocumentDownloadUrl } from "@/lib/actions/document";
import { Download, Loader2 } from "lucide-react";
import { INLINE_ACTION_CLASS } from "@/components/ui/inline-action";

type Props = { documentVersionId: string };

export function DocumentDownloadLink({ documentVersionId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const url = await getDocumentDownloadUrl(documentVersionId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={INLINE_ACTION_CLASS}
      aria-label="Télécharger le document"
    >
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" aria-hidden="true" />
      ) : (
        <Download className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      )}
      Télécharger
    </button>
  );
}
