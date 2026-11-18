"use client";

// Lot 45 (CRM-06 ; D3) — « A répondu » et « Ne plus relancer », d'un geste : les relances en attente
// s'arrêtent. Une réponse par e-mail ou WhatsApp, Symbola ne la voit pas : c'est la planner qui la dit.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { noteAnsweredAction, stopFollowUpsAction } from "./ecrire/actions";

export function ProspectGestures({ eventId }: { eventId: string }) {
  const t = useTranslations("ProspectExchanges");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="stack">
      <div className="row-wrap">
        <button type="button" className="button-ghost" disabled={pending} onClick={() => startTransition(async () => setStatus((await noteAnsweredAction(eventId)) ? t("answeredNoted") : t("refused")))}>
          {t("answered")}
        </button>
        <button type="button" className="button-ghost" disabled={pending} onClick={() => startTransition(async () => setStatus((await stopFollowUpsAction(eventId)) ? t("stoppedNoted") : t("refused")))}>
          {t("stop")}
        </button>
      </div>
      <p className="meta">{t("gesturesHint")}</p>
      {status ? <p role="status">{status}</p> : null}
    </div>
  );
}
