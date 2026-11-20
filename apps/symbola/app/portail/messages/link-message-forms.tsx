"use client";

// Lot 55 (POR-06 ; ADR 0102) — écrire depuis un lien (client ou prestataire) : une seule zone, toujours
// partagée avec la planner ; le bouton dit à qui le message part. Pièces jointes contrôlées par la
// route (ADR 0027).
import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";

export function LinkReplyForm({ endpoint, organizationName }: { endpoint: string; organizationName: string }) {
  const t = useTranslations("PortalMessages");
  const [state, action, pending] = useUploadAction<UploadState>(endpoint);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);
  const ids = { body: useId(), files: useId(), title: useId() };
  return (
    <form ref={form} action={action} className="composer composer-shared" aria-labelledby={ids.title}>
      <h2 id={ids.title}>{t("replyTitle")}</h2>
      <label htmlFor={ids.body}>{t("replyLabel")}</label>
      <textarea id={ids.body} name="body" rows={5} maxLength={5000} required />
      <label htmlFor={ids.files}>{t("filesLabel")}</label>
      <input id={ids.files} type="file" name="files" multiple accept="application/pdf,image/*" />
      <button type="submit" className="primary" disabled={pending}>
        {t("sendTo", { organization: organizationName })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("sent")}</p> : null}
    </form>
  );
}

export function LinkNewTopicForm({ endpoint, organizationName }: { endpoint: string; organizationName: string }) {
  const t = useTranslations("PortalMessages");
  const [state, action, pending] = useUploadAction<UploadState>(endpoint);
  const ids = { name: useId(), body: useId(), files: useId(), title: useId() };
  return (
    <form action={action} className="composer composer-shared" aria-labelledby={ids.title}>
      <h2 id={ids.title}>{t("newTopicTitle")}</h2>
      <label htmlFor={ids.name}>{t("newTopicName")}</label>
      <input id={ids.name} name="name" maxLength={120} required />
      <label htmlFor={ids.body}>{t("replyLabel")}</label>
      <textarea id={ids.body} name="body" rows={5} maxLength={5000} required />
      <label htmlFor={ids.files}>{t("filesLabel")}</label>
      <input id={ids.files} type="file" name="files" multiple accept="application/pdf,image/*" />
      <button type="submit" className="primary" disabled={pending}>
        {t("sendTo", { organization: organizationName })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
