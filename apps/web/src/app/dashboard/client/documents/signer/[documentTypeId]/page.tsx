import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NEED } from "@/lib/auth/capabilities";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { getDocumentSigningContext } from "@/lib/actions/document-signature";
import { formatDate } from "@/lib/services/date-format-service";
import { signedCopyPath } from "@/lib/services/document-signature-service";
import { CLIENT_DOCUMENTS_PATH } from "@/lib/design/client-navigation";
import { DocumentSigningWorkspace } from "@/components/client/documents/signing/DocumentSigningWorkspace";

export const metadata = { title: "Signer le document" };

// « Signer le document » (12/11/2026, option B) : la structure est lue depuis le LIEN de
// la session, jamais depuis l'adresse ; seul le type de document vient de l'adresse, et
// `getDocumentSigningContext` revérifie tout (direction, accepté, version courante).
type Props = { params: Promise<{ documentTypeId: string }> };

export default async function SignDocumentPage({ params }: Props) {
  const { documentTypeId } = await params;
  const { establishment } = await requireClientEstablishment(NEED.DOCUMENTS_WRITE);
  if (!establishment) notFound();
  const context = await getDocumentSigningContext(establishment.id, documentTypeId);

  return (
    <div className="flex flex-col gap-6">
      <Link href={CLIENT_DOCUMENTS_PATH} className="inline-flex min-h-12 w-fit items-center gap-2 font-bold text-accent-text underline underline-offset-4">
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        Retour à mes documents
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-[34px] font-bold leading-tight">Signer le document</h1>
        <p className="text-lg">{context.documentLabel}</p>
      </header>

      {context.signedAt ? (
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-5">
          <p className="text-base font-bold">Ce document a été signé le {formatDate(context.signedAt)}.</p>
          <a href={signedCopyPath(context.versionId)} className="font-bold text-accent-text underline underline-offset-4">
            Télécharger la version signée
          </a>
        </section>
      ) : context.refusal ? (
        <p role="alert" className="rounded-xl border border-line bg-card p-5 text-base">
          {context.refusal}
        </p>
      ) : (
        <DocumentSigningWorkspace context={context} />
      )}
    </div>
  );
}
