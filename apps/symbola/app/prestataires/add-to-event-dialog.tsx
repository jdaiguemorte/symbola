"use client";

// Lot 73c (PRE-02, BUD-01, UX-07, UX-14, UX-15 ; spécification du lot 73, § 5.3, critères 1 à 6 et 9 ;
// P12, P14, M13, P-14 ; maquette 19, « Depuis le carnet ») — la fenêtre courte « Ajouter « {fiche} » à un
// mariage », la même depuis une ligne du carnet, la fiche, la sélection et le carnet ouvert depuis un
// poste (mariage et poste déjà choisis) :
// - « Mariage » : les évènements à venir, demandes comprises, le plus proche d'abord, avec leur date ; une
//   pièce de la fiche qui expire avant ce mariage est dite dessous ;
// - « Poste du budget » : proposé d'après le métier principal (il reste un choix), ou « Nouveau poste » ;
// - « Comment l'ajouter ? » : « En comparaison » ou « Retenu », rien de coché ; plusieurs fiches, « En
//   comparaison » seulement ; sur un poste déjà pourvu, le pied propose « Remplacer {nom} » puis « Retenir
//   aussi » (P12) ;
// - après l'ajout, le message de retour dit où le prestataire est allé, avec « Annuler » (dix secondes)
//   et « Ouvrir le poste ».
// Montée au clic seulement (un seul exemplaire pour tout le carnet, NFR-02) ; une page entière sur
// téléphone (la règle des fenêtres, ADR 0107).
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/app/ui/feedback";
import { addToEventAction, loadAdditionAction, undoAdditionAction } from "./add-to-event-actions";
import { allowedModes, footerFor, initialAdditionForm, NEW_SLOT, planAddition, slotOptions, withEvent, type AdditionChoices, type AdditionField, type AdditionForm } from "./add-to-event-model";

export type AdditionPreset = { eventId: string; slotId: string };

export function AddToEventDialog({ vendorIds, names, preset, onClose, onAdded }: { vendorIds: string[]; names: string[]; preset?: AdditionPreset | undefined; onClose: () => void; onAdded?: () => void }) {
  const t = useTranslations("VendorAddition");
  const locale = useLocale();
  const router = useRouter();
  const feedback = useFeedback();
  const dialog = useRef<HTMLDialogElement>(null);
  const [choices, setChoices] = useState<AdditionChoices | null>(null);
  const [form, setForm] = useState<AdditionForm | null>(null);
  const [errors, setErrors] = useState<AdditionField[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; intent: "add" | "replace" | "retain_also" } | null>(null);
  // « Remplacer {nom} » d'abord, bouton plein ; « Retenir aussi » ensuite, bouton simple (P12).
  // Le serveur a trouvé le poste pourvu entre-temps : le pied propose les deux boutons.
  const [retainedFromServer, setRetainedFromServer] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = { title: useId(), event: useId(), eventHint: useId(), slot: useId(), slotHint: useId(), newSlot: useId(), mode: useId(), modeError: useId() };

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    let current = true;
    void loadAdditionAction({ vendorIds }).then((result) => {
      if (!current) return;
      if (!result.ok) {
        setFailure(result.error);
        return;
      }
      setChoices(result.choices);
      setForm(initialAdditionForm(result.choices, preset));
    });
    return () => {
      current = false;
      element?.close();
    };
    // La fenêtre est montée pour une demande : ses fiches ne changent pas.
  }, []);

  const event = choices && form ? (choices.events.find((entry) => entry.eventId === form.eventId) ?? null) : null;
  const options = useMemo(() => (event && choices ? slotOptions(event, choices.tradeLabel) : []), [event, choices]);
  const chosenSlot = options.find((option) => option.value === form?.slot) ?? null;
  const footer = choices && form ? footerFor(form, choices) : { kind: "add" as const };
  const retainedName = footer.kind === "choose" ? footer.retainedName : form?.mode === "retain" ? retainedFromServer : null;
  const many = choices ? allowedModes(choices).length === 1 : false;
  const title = names.length === 1 ? t("titleOne", { vendor: names[0]! }) : t("titleMany", { count: names.length });
  const date = (value: string | null) => (value ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : t("noDate"));
  const update = (next: Partial<AdditionForm>) => {
    setForm((current) => (current ? { ...current, ...next } : current));
    setErrors([]);
    setConfirm(null);
    setRetainedFromServer(null);
  };

  const submit = (intent: "add" | "replace" | "retain_also", confirmed = false) => {
    if (!choices || !form) return;
    const plan = planAddition(form, choices, intent);
    if (!plan.ok) {
      setErrors(plan.errors);
      return;
    }
    startTransition(async () => {
      const result = await addToEventAction({ ...plan.request, confirmed });
      if (!result.ok) {
        if (result.kind === "confirm") setConfirm({ message: result.message, intent });
        else if (result.kind === "choice") setRetainedFromServer(result.retainedName);
        else setFailure(result.error);
        return;
      }
      dialog.current?.close();
      onClose();
      onAdded?.();
      router.refresh();
      feedback?.show({
        title: result.title,
        detail: result.detail,
        action: {
          kind: "undo",
          label: t("undo"),
          run: async () => {
            const undone = await undoAdditionAction({ undoId: result.undoId, eventId: result.eventId });
            feedback.show(undone.ok ? { title: undone.message } : { tone: "error", title: undone.message });
            router.refresh();
          },
        },
        link: { label: t("openSlot"), href: result.slotHref },
      });
    });
  };

  return (
    <dialog
      ref={dialog}
      className="window window-short add-to-event"
      aria-labelledby={ids.title}
      onCancel={(cancel) => {
        cancel.preventDefault();
        onClose();
      }}
    >
      <div className="window-head">
        <button type="button" className="button-ghost window-back" onClick={onClose}>
          {t("back")}
        </button>
        <h2 id={ids.title}>{title}</h2>
        <button type="button" className="button-ghost window-close" onClick={onClose}>
          {t("close")}
        </button>
      </div>

      {failure ? (
        <p role="alert" className="field-error">
          {failure}
        </p>
      ) : null}
      {!choices && !failure ? <p className="meta">{t("loading")}</p> : null}
      {choices && form && choices.events.length === 0 ? <p>{t("noEvents")}</p> : null}

      {choices && form && choices.events.length > 0 ? (
        <form
          className="stack"
          noValidate
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            submit("add");
          }}
        >
          <div className="field">
            <label htmlFor={ids.event}>{t("event")}</label>
            <select id={ids.event} value={form.eventId ?? ""} aria-describedby={ids.eventHint} aria-invalid={errors.includes("event") || undefined} onChange={(change) => {
              setForm((current) => (current ? withEvent(current, choices, change.target.value) : current));
              setErrors([]);
              setConfirm(null);
              setRetainedFromServer(null);
            }}>
              {choices.events.map((entry) => (
                <option key={entry.eventId} value={entry.eventId}>
                  {t("eventOption", { event: entry.label || t("unnamedEvent"), date: date(entry.eventDate) })}
                </option>
              ))}
            </select>
            <p id={ids.eventHint} className="field-hint">
              {t("eventHint")}
            </p>
            {event?.documentWarning ? (
              <p className="notice notice-attention add-to-event-warning">{t("documentWarning", { document: event.documentWarning.label, date: date(event.documentWarning.validUntil) })}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor={ids.slot}>{t("slot")}</label>
            <select id={ids.slot} value={form.slot ?? ""} aria-describedby={ids.slotHint} aria-invalid={errors.includes("slot") || undefined} onChange={(change) => update({ slot: change.target.value || null })}>
              {form.slot === null ? <option value="">{t("slotNone")}</option> : null}
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === NEW_SLOT
                    ? option.label
                      ? t("newSlotNamed", { trade: option.label })
                      : t("newSlot")
                    : option.retainedNames.length > 0
                      ? t("slotOptionRetained", { slot: option.label, names: option.retainedNames.join(", ") })
                      : t("slotOption", { slot: option.label, count: option.comparingCount })}
                </option>
              ))}
            </select>
            <p id={ids.slotHint} className="field-hint">
              {chosenSlot?.proposed && choices.tradeLabel ? `${t("proposedFrom", { trade: choices.tradeLabel })} ${t("otherChoice")}` : t("otherChoice")}
            </p>
            {errors.includes("slot") ? <p className="field-error">{t("chooseSlot")}</p> : null}
            {form.slot === NEW_SLOT ? (
              <div className="field">
                <label htmlFor={ids.newSlot}>{t("newSlotLabel")}</label>
                <input id={ids.newSlot} type="text" maxLength={120} value={form.newSlotLabel} aria-invalid={errors.includes("newSlotLabel") || undefined} onChange={(change) => update({ newSlotLabel: change.target.value })} />
                {errors.includes("newSlotLabel") ? <p className="field-error">{t("nameSlot")}</p> : null}
              </div>
            ) : null}
          </div>

          <fieldset className="add-to-event-modes" aria-describedby={errors.includes("mode") ? ids.modeError : undefined}>
            <legend>{t("how")}</legend>
            {many ? <p className="field-hint">{t("manyCompare", { count: names.length })}</p> : null}
            <label className="add-to-event-mode">
              <input type="radio" name="mode" value="compare" checked={form.mode === "compare"} onChange={() => update({ mode: "compare" })} />
              <span>
                <strong>{t("compare")}</strong>
                <span className="meta">{chosenSlot && chosenSlot.value !== NEW_SLOT && chosenSlot.comparingCount > 0 ? t("compareHintOthers", { count: chosenSlot.comparingCount }) : t("compareHint")}</span>
              </span>
            </label>
            {many ? null : (
              <label className="add-to-event-mode">
                <input type="radio" name="mode" value="retain" checked={form.mode === "retain"} onChange={() => update({ mode: "retain" })} />
                <span>
                  <strong>{t("retain")}</strong>
                  <span className="meta">{t("retainHint")}</span>
                </span>
              </label>
            )}
            {errors.includes("mode") ? (
              <p id={ids.modeError} className="field-error" role="alert">
                {t("chooseMode")}
              </p>
            ) : null}
          </fieldset>

          {confirm ? (
            <div className="notice notice-attention">
              <p role="alert">{confirm.message}</p>
              <button type="button" className="button-primary" disabled={pending} onClick={() => submit(confirm.intent, true)}>
                {t("confirmRetain")}
              </button>
            </div>
          ) : null}

          {retainedName ? (
            <div className="window-actions add-to-event-choice">
              <button type="button" className="button-ghost" onClick={onClose}>
                {t("cancel")}
              </button>
              <span className="add-to-event-choice-option">
                <button type="button" className="button-primary" disabled={pending} onClick={() => submit("replace")}>
                  {t("replace", { name: retainedName })}
                </button>
                <span className="meta">{t("replaceHint", { name: retainedName })}</span>
              </span>
              <span className="add-to-event-choice-option">
                <button type="button" className="button-secondary" disabled={pending} onClick={() => submit("retain_also")}>
                  {t("retainAlso")}
                </button>
                <span className="meta">{t("retainAlsoHint")}</span>
              </span>
            </div>
          ) : (
            <div className="window-actions">
              <button type="button" className="button-ghost" onClick={onClose}>
                {t("cancel")}
              </button>
              <button type="submit" className="button-primary" disabled={pending}>
                {t("submit")}
              </button>
            </div>
          )}
        </form>
      ) : null}
    </dialog>
  );
}
