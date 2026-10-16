"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/services/date-format-service";
import { sendQuizCampaign, type CampaignInvitationView } from "@/lib/actions/staff-quiz-write";
import { initialCampaignChoice } from "@/lib/services/quiz-status-service";

// « Envoyer un quiz » : choisir le quiz, puis les personnes — celles qui doivent le
// faire ou le refaire sont pré-cochées. L'envoi crée une campagne et affiche, pour
// chaque personne, SON QR code et SON lien, à imprimer ou à montrer en réunion. Pas
// de SMS (décision 8). Les liens ne sont affichés qu'une fois : rien ne les stocke.
type Props = {
  establishmentId: string;
  modules: { code: string; title: string }[];
  staff: { id: string; name: string }[];
  preselection: Record<string, string[]>;
};

const CHIP = "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2";

export function SendQuizDialog({ establishmentId, modules, staff, preselection }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moduleCode, setModuleCode] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ moduleTitle: string; invitations: CampaignInvitationView[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  function pickModule(code: string) {
    setModuleCode(code);
    setSelected(preselection[code] ?? []);
  }

  // Présélection relue à chaque ouverture : l'équipe a pu changer depuis l'affichage.
  function openDialog() {
    const choice = initialCampaignChoice(
      modules.map((m) => m.code),
      preselection
    );
    setModuleCode(choice.moduleCode);
    setSelected(choice.selected);
    setOpen(true);
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function close() {
    setOpen(false);
    setSent(null);
    setError(null);
  }

  function send() {
    const data = new FormData();
    data.set("establishmentId", establishmentId);
    data.set("moduleCode", moduleCode);
    for (const id of selected) data.append("staffMemberIds", id);
    setError(null);
    startTransition(async () => {
      const result = await sendQuizCampaign(data);
      if ("error" in result) return setError(result.error);
      setSent(result);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={openDialog}>
        <Send className="h-4 w-4" aria-hidden="true" />
        Envoyer un quiz
      </Button>
      {open && (
        <Modal title={sent ? `Quiz « ${sent.moduleTitle} » : les liens` : "Envoyer un quiz"} onClose={close} maxWidthClassName="max-w-3xl">
          <div className="space-y-5 overflow-y-auto p-5">
            {sent ? (
              <QuizInvitationSheets invitations={sent.invitations} />
            ) : (
              <>
                <fieldset className="space-y-2">
                  <legend className="mb-2 font-bold">Quel quiz ?</legend>
                  <div className="flex flex-wrap gap-2">
                    {modules.map((m) => (
                      <label key={m.code} className={cn(CHIP, moduleCode === m.code ? "border-ink bg-ink-fill text-on-ink" : "border-line bg-card")}>
                        <input type="radio" name="quiz-module" className="sr-only" checked={moduleCode === m.code} onChange={() => pickModule(m.code)} />
                        {m.title}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="mb-2 font-bold">
                    À qui ? <span className="font-normal text-ink2">Ceux qui doivent le faire ou le refaire sont cochés.</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {staff.map((person) => {
                      const checked = selected.includes(person.id);
                      return (
                        <label key={person.id} className={cn(CHIP, checked ? "border-ink bg-ink-fill text-on-ink" : "border-line bg-card")}>
                          <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(person.id)} />
                          <span aria-hidden="true">{checked ? "✓" : "+"}</span>
                          {person.name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <p className="text-ink2">
                  Chaque personne reçoit son QR code et son lien, valables 3 jours. Le quiz se fait sur téléphone, en 10 minutes.
                </p>
                {error && (
                  <p role="alert" className="font-bold text-rouge-imp">
                    {error}
                  </p>
                )}
                <Button className="h-12 w-full text-base" onClick={send} disabled={isPending || selected.length === 0}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {selected.length === 0
                    ? "Choisissez au moins une personne"
                    : `Créer ${selected.length} lien${selected.length > 1 ? "s" : ""}`}
                </Button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function QuizInvitationSheets({ invitations }: { invitations: CampaignInvitationView[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1">Imprimez cette page ou montrez chaque QR code. Ces liens ne seront plus affichés ensuite.</p>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          Imprimer
        </Button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {invitations.map((inv) => (
          <li key={inv.url} className="flex flex-col items-center gap-2 rounded-xl border border-line bg-card p-4 text-center break-inside-avoid">
            <p className="font-bold">{inv.staffName}</p>
            <svg
              viewBox={`0 0 ${inv.qr.size} ${inv.qr.size}`}
              role="img"
              aria-label={`QR code du quiz pour ${inv.staffName}`}
              shapeRendering="crispEdges"
              className="h-48 w-48"
            >
              <rect width={inv.qr.size} height={inv.qr.size} fill="#ffffff" />
              <path d={inv.qr.d} fill="#000000" />
            </svg>
            <a href={inv.url} className="break-all text-accent-text underline underline-offset-4">
              {inv.url}
            </a>
            <p className="text-ink2">Valable jusqu&apos;au {formatDateTime(new Date(inv.expiresAt))}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
