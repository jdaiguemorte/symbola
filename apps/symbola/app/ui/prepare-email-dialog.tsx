"use client";

// Lot 65d (MSG-01, HUB-20 ; ADR 0110, ADR 0107) — la fenêtre « Préparer l'e-mail » : le message de la
// relation prérempli et modifiable (destinataire, objet, texte, liens personnels déjà insérés), envoyé
// par la planner de sa messagerie. Trois actions : « Ouvrir dans ma messagerie » (lien mailto, fait du
// texte affiché), « Copier le message » (une messagerie web ou un mailto trop long), « J'ai envoyé »
// (noté au journal du hub et dans l'activité de l'évènement). « Ne pas l'envoyer » l'écarte. Pas de
// pièce jointe : « Télécharger le PDF » est à côté. Plusieurs messages (un par destinataire) se
// suivent, « Message 1 sur 3 ». Fenêtre native : fond assombri, focus gardé, Échap ferme ; plein
// écran sur téléphone, avec « Retour ».
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { PreparedEmailDraft } from "@symbola/contracts";
import { dismissPreparedEmailAction, markPreparedEmailSentAction } from "@/app/preparer/actions";

type Outcome = "sent" | "dismissed" | "copied" | "copyFailed" | "error";

function mailtoOf(to: string, subject: string, body: string): string {
  const query = new URLSearchParams({ subject, body }).toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(to)}?${query}`;
}

export function PrepareEmailDialog({ drafts, loading = false, onClose }: { drafts: PreparedEmailDraft[]; loading?: boolean; onClose: () => void }) {
  const t = useTranslations("PrepareEmail");
  const tCommon = useTranslations("Common");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const [texts, setTexts] = useState<Record<string, { subject: string; body: string }>>({});
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const draft = drafts[Math.min(index, Math.max(drafts.length - 1, 0))];
  const text = draft ? (texts[draft.id] ?? { subject: draft.subject, body: draft.body }) : { subject: "", body: "" };
  const outcome = draft ? outcomes[draft.id] : undefined;
  const closed = outcome === "sent" || outcome === "dismissed";
  const setText = (patch: Partial<{ subject: string; body: string }>) => draft && setTexts((current) => ({ ...current, [draft.id]: { ...text, ...patch } }));
  const note = (value: Outcome) => draft && setOutcomes((current) => ({ ...current, [draft.id]: value }));

  const act = (action: typeof markPreparedEmailSentAction, done: Outcome) => {
    if (!draft) return;
    startTransition(async () => {
      const result = await action(draft.id);
      note(result.ok ? done : "error");
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text.subject}\n\n${text.body}`);
      note("copied");
    } catch {
      note("copyFailed");
    }
  };

  return (
    <dialog ref={dialog} className="task-dialog task-dialog-long" aria-labelledby={titleId} onClose={onClose}>
      <div className="task-dialog-head">
        <h2 id={titleId}>{t("title")}</h2>
        <button type="button" className="button-ghost" onClick={() => dialog.current?.close()}>
          <span className="task-dialog-back">{tCommon("dialogBack")}</span>
          <span className="task-dialog-x">{tCommon("dialogClose")}</span>
        </button>
      </div>
      <div className="task-dialog-body">
        <div className="task-dialog-content">
          {loading ? <p role="status">{t("loading")}</p> : null}
          {!loading && !draft ? <p role="status">{t("none")}</p> : null}
          {draft ? (
            <>
              <p className="meta">{t("intro")}</p>
              {drafts.length > 1 ? <p className="meta">{t("position", { n: index + 1, total: drafts.length })}</p> : null}
              {draft.problem ? (
                <p role="alert" className="notice notice-attention">
                  {t(draft.problem === "missing_variable" ? "missingVariable" : "unavailable")}
                </p>
              ) : (
                <form className="task-dialog-form" onSubmit={(event) => event.preventDefault()}>
                  <p>
                    <strong>{t("to")}</strong> {t("toValue", { name: draft.recipientName, email: draft.to })}
                  </p>
                  <label htmlFor={`${titleId}-subject`}>{t("subject")}</label>
                  <input id={`${titleId}-subject`} type="text" value={text.subject} maxLength={300} disabled={closed} onChange={(event) => setText({ subject: event.target.value })} />
                  <label htmlFor={`${titleId}-body`}>{t("body")}</label>
                  <textarea id={`${titleId}-body`} rows={12} value={text.body} disabled={closed} onChange={(event) => setText({ body: event.target.value })} />
                  {draft.renewedLink ? <p className="notice">{t("renewedLink", { name: draft.recipientName })}</p> : null}
                  <p className="meta">
                    {t("noAttachment")}{" "}
                    {draft.pdfHref ? (
                      <a href={draft.pdfHref} download>
                        {t("pdf")}
                      </a>
                    ) : null}
                  </p>
                </form>
              )}
              {outcome === "sent" ? <p role="status">{t("sentDone")}</p> : null}
              {outcome === "dismissed" ? <p role="status">{t("dismissed")}</p> : null}
              {outcome === "copied" ? <p role="status">{t("copied")}</p> : null}
              {outcome === "copyFailed" ? <p role="alert">{t("copyFailed")}</p> : null}
              {outcome === "error" ? <p role="alert">{t("error")}</p> : null}
            </>
          ) : null}
        </div>
      </div>
      {draft ? (
        <div className="task-dialog-actions">
          <div className="task-dialog-actions-main">
            {!draft.problem && !closed ? (
              <>
                <a className="button-link button-link-primary" href={mailtoOf(draft.to, text.subject, text.body)} title={t("openHint")}>
                  {t("open")}
                </a>
                <button type="button" className="button-secondary" onClick={copy}>
                  {t("copy")}
                </button>
                <button type="button" className="button-secondary" disabled={pending} onClick={() => act(markPreparedEmailSentAction, "sent")}>
                  {t("sent")}
                </button>
              </>
            ) : null}
            {!closed ? (
              <button type="button" className="button-ghost" disabled={pending} onClick={() => act(dismissPreparedEmailAction, "dismissed")}>
                {t("dismiss")}
              </button>
            ) : null}
          </div>
          {drafts.length > 1 ? (
            <div className="task-dialog-actions-main">
              <button type="button" className="button-ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                {t("previous")}
              </button>
              <button type="button" className="button-ghost" disabled={index >= drafts.length - 1} onClick={() => setIndex(index + 1)}>
                {t("next")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
