"use client";

// Lot 73d (PRE-01, PRE-05, UX-07 ; spécification du lot 73, § 5.4, critères 6, 7 et 10 ; P3, P4, V11 ;
// maquette 20, « La fiche », « Une fiche neuve ») — les gestes de la fiche d'un prestataire :
//
// - le menu « ⋯ » de l'en-tête : « Modifier », « Chercher autour de {nom} », et à part « Archiver… »
//   (« Annuler » dix secondes, lot 39a) ;
// - « Demander au prestataire » : une petite fenêtre (la pièce, et ce que devient la demande : elle arrive
//   sur son lien de prestataire, ou l'attendra s'il n'en a pas encore) ; Symbola n'envoie rien de plus ;
// - « Demander l'assurance et le Kbis » : les pièces demandées d'habitude, d'un geste, avec « Annuler ».
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { VendorDocumentKind } from "@symbola/contracts";
import { useFeedback } from "@/app/ui/feedback";
import { TaskPopover, usePopover } from "@/app/ui/task-popover";
import { archiveVendorAction } from "../actions";
import { requestUsualDocumentsAction, requestVendorDocumentAction, undoUsualDocumentsAction, type RecordFormState } from "./records-actions";

export function SheetMenu({ vendorId, vendorName, searchAroundHref, archived }: { vendorId: string; vendorName: string; searchAroundHref: string | null; archived: boolean }) {
  const t = useTranslations("VendorSheet");
  const menu = usePopover();
  const button = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const label = t("menu.label", { vendor: vendorName });
  return (
    <>
      <button ref={button} type="button" className="task-menu-button" aria-haspopup="menu" aria-label={label} onClick={() => menu.open(button.current)}>
        ⋯
      </button>
      <TaskPopover handle={menu} label={label} className="task-menu">
        <div role="menu" aria-label={label}>
          <Link role="menuitem" href={`/prestataires/${vendorId}?modifier=1`} scroll={false} data-autofocus onClick={() => menu.close()}>
            <span>{t("menu.edit")}</span>
          </Link>
          {searchAroundHref ? (
            <Link role="menuitem" href={searchAroundHref} onClick={() => menu.close()}>
              <span>{t("menu.searchAround", { vendor: vendorName })}</span>
            </Link>
          ) : null}
          {archived ? null : (
            <>
              <hr className="task-menu-separator" />
              <button
                type="button"
                role="menuitem"
                className="task-menu-danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    menu.close();
                    const formData = new FormData();
                    formData.set("vendorId", vendorId);
                    await archiveVendorAction(formData);
                  })
                }
              >
                <span>{t("menu.archive")}</span>
                <span className="task-menu-hint">{t("menu.archiveHint")}</span>
              </button>
            </>
          )}
        </div>
      </TaskPopover>
    </>
  );
}

// « Demander au prestataire » : la pièce (proposée d'après l'alerte d'où elle part), et ce que la demande
// devient, dit avant l'envoi.
export function RequestDocumentButton({
  vendorId,
  vendorName,
  kinds,
  initialKindId = null,
  reach,
  label,
  className = "button-secondary",
}: {
  vendorId: string;
  vendorName: string;
  kinds: VendorDocumentKind[];
  initialKindId?: string | null;
  reach: "link" | "waiting";
  label: string;
  className?: string;
}) {
  const t = useTranslations("VendorSheet");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const feedback = useFeedback();
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = { title: useId(), reach: useId() };
  const [state, action, pending] = useActionState<RecordFormState, FormData>(requestVendorDocumentAction, {});
  const handled = useRef<RecordFormState | null>(null);
  useEffect(() => {
    if (handled.current === state || !state.success) return;
    handled.current = state;
    dialog.current?.close();
    feedback?.show({ title: state.notice ?? t("documents.requestDoneShort") });
    router.refresh();
  }, [state, feedback, router, t]);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog ref={dialog} className="window window-short" aria-labelledby={ids.title} aria-describedby={ids.reach}>
        <div className="window-head">
          <h2 id={ids.title}>{t("documents.requestTitle", { name: vendorName })}</h2>
          <button type="button" className="button-ghost window-close" onClick={() => dialog.current?.close()}>
            {t("close")}
          </button>
        </div>
        <form action={action} className="stack">
          <input type="hidden" name="vendorId" value={vendorId} />
          <label>
            {t("documents.requestKind")}
            <select name="kindId" defaultValue={initialKindId ?? kinds[0]?.id}>
              {kinds.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          {/* La fenêtre dit vrai (§ 7 de la spécification) : sans lien, rien ne le prévient. */}
          <p id={ids.reach} className={reach === "link" ? "field-hint" : "notice"}>
            {t(reach === "link" ? "documents.requestViaLink" : "documents.requestWaiting")}
          </p>
          {state.error ? <p role="alert">{state.error}</p> : null}
          <div className="window-actions">
            <button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>
              {tCommon("cancel")}
            </button>
            <button type="submit" className="button-primary" disabled={pending}>
              {t("documents.requestSubmit")}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

// P4, critère 10 : « Demander l'assurance et le Kbis », d'un geste ; le message de retour et son « Annuler ».
export function RequestUsualButton({ vendorId, label, reach }: { vendorId: string; label: string; reach: "link" | "waiting" }) {
  const t = useTranslations("VendorSheet");
  const tFeedback = useTranslations("Feedback");
  const router = useRouter();
  const feedback = useFeedback();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="button-secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await requestUsualDocumentsAction({ vendorId });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError(null);
            router.refresh();
            feedback?.show({
              title: result.message,
              detail: t(reach === "link" ? "documents.requestViaLink" : "documents.requestWaiting"),
              action: {
                kind: "undo",
                label: tFeedback("undo"),
                run: async () => {
                  const undone = await undoUsualDocumentsAction({ vendorId, documentIds: result.documentIds });
                  feedback.show(undone.ok ? { title: undone.message } : { tone: "error", title: undone.message });
                  router.refresh();
                },
              },
            });
          })
        }
      >
        {label}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
