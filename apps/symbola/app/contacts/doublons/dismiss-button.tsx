"use client";

// Lot 45 (CRM-07, D4) — « Ce ne sont pas les mêmes » : la paire est écartée et ne revient pas.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { dismissPairAction } from "./actions";

export function DismissPairButton({ pairId }: { pairId: string }) {
  const t = useTranslations("ContactDuplicates");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button type="button" className="button-ghost" disabled={pending} onClick={() => startTransition(async () => setStatus((await dismissPairAction(pairId)) ? t("dismissed") : t("refused")))}>
        {t("dismiss")}
      </button>
      {status ? <span role="status">{status}</span> : null}
    </>
  );
}
