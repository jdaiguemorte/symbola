"use client";

// Lot 63c (BUD-04, PRE-02 ; #39, maquette M9) — chercher un prestataire du catalogue depuis la ligne
// d'un poste (le métier du poste et « Déjà travaillé ensemble » d'abord) ; « + Nouveau prestataire »
// crée la fiche dans une fenêtre, sans quitter le budget.
// Lot 65b (PRE-02, BUD-02 ; maquette M14 C) : choisir un nom ne le retient plus d'office. Chaque fiche
// propose « Comparer » (elle entre dans la comparaison du poste) et « Retenir » ; sans rien taper, la
// liste montre tout le carnet du métier, avec « Voir tout le carnet ». Retenir au-delà du seuil
// d'alerte du budget se confirme d'abord (BUD-02).
// Lot 73c (PRE-02, PRE-05, BUD-01, UX-07 ; spécification du lot 73, § 5.3, critères 4, 5, 7 et 9 ; P2,
// P12, P-14 ; maquette 19, « Depuis le poste ») — le panneau de 700 px rattaché à la ligne du poste,
// « Ajouter un prestataire à « {poste} » » : la recherche vide à chaque ouverture ; la phrase qui explique
// ses deux boutons ; « {métier} du carnet · N » d'abord (la correspondance du 73a), chaque fiche avec son
// métier, sa ville, ses mariages avec vous, son évaluation et l'état de ses pièces ; « Mettre en
// comparaison » et « Retenir » (sur un poste pourvu, « Retenir » demande sur place « Remplacer {nom} » ou
// « Retenir aussi ») ; une fiche déjà là dit « Dans la comparaison » ou « Retenu » ; « Chercher dans tout
// le carnet (N fiches) » ; après un ajout, le message de retour avec « Annuler », le panneau reste
// ouvert. Le même ajout que la fenêtre du carnet (mêmes actions, P-14). Sur téléphone, le panneau en page.
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { ChevronDown } from "lucide-react";
import { useFeedback } from "@/app/ui/feedback";
import { addToEventAction, undoAdditionAction } from "@/app/prestataires/add-to-event-actions";
import { panelGroups, panelRowState } from "@/app/prestataires/add-to-event-model";
import { createSlotVendorAction, searchSlotVendorsAction, type SlotPanelChoice, type SlotPanelSearch } from "./budget-vendor-actions";

const DEBOUNCE_MS = 200;

type Pending = { vendorId: string; kind: "confirm"; message: string; mode: "retain" | "replace" | "retain_also" } | { vendorId: string; kind: "choice"; retainedName: string };

export function VendorChoice({
  eventId,
  slotId,
  slotLabel,
  catalogHref,
  vendorTypes,
  label,
  onChanged,
}: {
  eventId: string;
  slotId: string;
  slotLabel: string;
  // « Chercher dans tout le carnet » : le carnet, filtré par le métier du poste (lot 73c).
  catalogHref: string;
  vendorTypes: { id: string; label: string }[];
  // Le libellé du bouton (« + Ajouter des prestataires » sur la ligne, « + Ajouter un prestataire » dans la fenêtre).
  label?: string | undefined;
  // Après un ajout (la comparaison de la fenêtre se recharge).
  onChanged?: () => void;
}) {
  const t = useTranslations("BudgetVendors");
  const tAdd = useTranslations("VendorAddition");
  const router = useRouter();
  const feedback = useFeedback();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [found, setFound] = useState<SlotPanelSearch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<Pending | null>(null);
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const ids = { popover: useId(), search: useId(), title: useId(), hint: useId() };

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || creating) return;
      // Dans la fenêtre du poste, Échap ferme le panneau, pas la fenêtre.
      event.stopPropagation();
      event.preventDefault();
      close();
    };
    const onPointer = (event: PointerEvent) => {
      // Le message de retour (« Annuler ») est hors du panneau : le toucher ne le ferme pas.
      const target = event.target as Element;
      if (!creating && !root.current?.contains(target) && !target.closest?.(".feedback-region")) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, creating]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    const timer = setTimeout(() => {
      void searchSlotVendorsAction({ eventId, slotId, term }).then((result) => {
        if (current) setFound(result);
      });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, term, eventId, slotId, version]);

  const add = (vendorId: string, mode: "compare" | "retain" | "replace" | "retain_also", confirmed = false) =>
    startTransition(async () => {
      const result = await addToEventAction({ eventId, slotId, vendorIds: [vendorId], mode, confirmed });
      if (!result.ok) {
        if (result.kind === "confirm") setAsking({ vendorId, kind: "confirm", message: result.message, mode: mode === "compare" ? "retain" : mode });
        else if (result.kind === "choice") setAsking({ vendorId, kind: "choice", retainedName: result.retainedName });
        else setError(result.error);
        return;
      }
      setError(null);
      setAsking(null);
      setVersion((current) => current + 1);
      onChanged?.();
      router.refresh();
      feedback?.show({
        title: result.title,
        detail: result.detail,
        action: {
          kind: "undo",
          label: tAdd("undo"),
          run: async () => {
            const undone = await undoAdditionAction({ undoId: result.undoId, eventId: result.eventId });
            feedback.show(undone.ok ? { title: undone.message } : { tone: "error", title: undone.message });
            setVersion((current) => current + 1);
            onChanged?.();
            router.refresh();
          },
        },
      });
    });

  const groups = panelGroups(found?.choices ?? []);
  const row = (vendor: SlotPanelChoice) => {
    const state = panelRowState(vendor);
    const facts = [vendor.typeLabel, vendor.city, vendor.workedWithCount > 0 ? t("workedWithCount", { count: vendor.workedWithCount }) : null, vendor.ratingText].filter(Boolean).join(" · ");
    return (
      <li key={vendor.id}>
        <span className="vendor-choice-who">
          <strong>{vendor.name}</strong>
          {facts ? <span className="meta">{facts}</span> : null}
          <span className="book-documents" data-tone={vendor.documents.tone}>
            {vendor.documents.icon ? (
              <span className="book-documents-icon" aria-hidden="true">
                {vendor.documents.icon}
              </span>
            ) : null}
            {vendor.documents.text}
          </span>
        </span>
        {state === "actions" ? (
          <span className="vendor-choice-actions">
            <button type="button" className="button-secondary" disabled={pending} onClick={() => add(vendor.id, "compare")}>
              {tAdd("panelCompare")}
              <span className="sr-only"> — {vendor.name}</span>
            </button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => add(vendor.id, "retain")}>
              {tAdd("panelRetain")}
              <span className="sr-only"> — {vendor.name}</span>
            </button>
          </span>
        ) : (
          <span className="vendor-choice-actions">
            <span className={state === "retained" ? "badge badge-sauge" : "badge"}>{tAdd(state === "retained" ? "rowRetained" : "rowInComparison")}</span>
            {state === "inComparison" ? (
              <button type="button" className="link-button" disabled={pending} onClick={() => add(vendor.id, "retain")}>
                {tAdd("panelRetain")}
                <span className="sr-only"> — {vendor.name}</span>
              </button>
            ) : null}
          </span>
        )}
        {asking?.vendorId === vendor.id && asking.kind === "confirm" ? (
          <div className="notice notice-attention slot-panel-ask">
            <p role="alert">{asking.message}</p>
            <button type="button" className="button-primary" disabled={pending} onClick={() => add(vendor.id, asking.mode, true)}>
              {t("confirmRetain")}
            </button>
          </div>
        ) : null}
        {asking?.vendorId === vendor.id && asking.kind === "choice" ? (
          // P12 : le poste a déjà un retenu ; « Remplacer {nom} » d'abord, « Retenir aussi » ensuite.
          <div className="notice slot-panel-ask" role="group" aria-label={tAdd("choiceLabel", { name: asking.retainedName })}>
            <span className="slot-panel-ask-option">
              <button type="button" className="button-primary" disabled={pending} onClick={() => add(vendor.id, "replace")}>
                {tAdd("replace", { name: asking.retainedName })}
              </button>
              <span className="meta">{tAdd("replaceHint", { name: asking.retainedName })}</span>
            </span>
            <span className="slot-panel-ask-option">
              <button type="button" className="button-secondary" disabled={pending} onClick={() => add(vendor.id, "retain_also")}>
                {tAdd("retainAlso")}
              </button>
              <span className="meta">{tAdd("retainAlsoHint")}</span>
            </span>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="menu-button" ref={root}>
      <button
        ref={button}
        type="button"
        className="button-secondary"
        aria-expanded={open}
        aria-controls={ids.popover}
        onClick={() => {
          // La recherche est vide à chaque ouverture (critère 7).
          if (!open) {
            setTerm("");
            setFound(null);
            setAsking(null);
            setError(null);
          }
          setOpen(!open);
        }}
      >
        {label ?? t("choose")}
        <span className="sr-only"> {t("chooseFor", { slot: slotLabel })}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div id={ids.popover} className="menu-popover vendor-choice-popover slot-panel" role="group" aria-labelledby={ids.title}>
          <div className="slot-panel-head">
            <button type="button" className="button-ghost slot-panel-back" onClick={close}>
              {tAdd("panelBack")}
            </button>
            <h3 id={ids.title}>{tAdd("panelTitle", { slot: slotLabel })}</h3>
          </div>
          <label htmlFor={ids.search} className="sr-only">
            {tAdd("panelSearch")}
          </label>
          <input ref={search} id={ids.search} type="search" value={term} maxLength={100} autoComplete="off" placeholder={tAdd("panelSearch")} aria-describedby={ids.hint} onChange={(event) => setTerm(event.target.value)} />
          <p id={ids.hint} className="meta slot-panel-hint">
            {tAdd("panelHint")}
          </p>
          <p className="sr-only" role="status" aria-live="polite">
            {found ? t("resultsCount", { count: found.choices.length }) : ""}
          </p>
          {groups.matching.length > 0 ? (
            <section className="slot-panel-group" aria-labelledby={`${ids.popover}-matching`}>
              <h4 id={`${ids.popover}-matching`}>{tAdd("panelTradeGroup", { trade: found?.tradeLabel ?? slotLabel, count: found?.matchingCount ?? groups.matching.length })}</h4>
              <ul className="vendor-choice-results">{groups.matching.map(row)}</ul>
            </section>
          ) : null}
          {groups.others.length > 0 ? (
            <section className="slot-panel-group" aria-labelledby={`${ids.popover}-others`}>
              <h4 id={`${ids.popover}-others`}>{tAdd("panelOthersGroup")}</h4>
              <ul className="vendor-choice-results">{groups.others.map(row)}</ul>
            </section>
          ) : null}
          {found && found.choices.length === 0 ? <p className="meta">{t("noResults")}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          <div className="vendor-choice-more">
            <Link href={catalogHref}>{tAdd("panelWholeBook", { count: found?.bookCount ?? 0 })}</Link>
            <button type="button" className="link-button" onClick={() => setCreating(true)} aria-haspopup="dialog">
              {term.trim() ? t("newVendorNamed", { name: term.trim() }) : t("newVendor")}
            </button>
          </div>
        </div>
      ) : null}
      {creating ? (
        <NewVendorDialog
          eventId={eventId}
          slotId={slotId}
          slotLabel={slotLabel}
          initialName={term.trim()}
          vendorTypes={vendorTypes}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setOpen(false);
            onChanged?.();
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

// La fenêtre de création d'une fiche (DESIGN.md, ADR 0107 : toute modification en fenêtre). Le
// <dialog> natif, en modal : fond assombri, focus piégé, Échap ferme.
function NewVendorDialog({ eventId, slotId, slotLabel, initialName, vendorTypes, onClose, onCreated }: { eventId: string; slotId: string; slotLabel: string; initialName: string; vendorTypes: { id: string; label: string }[]; onClose: () => void; onCreated: () => void }) {
  const t = useTranslations("BudgetVendors");
  const tCommon = useTranslations("Common");
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = { title: useId(), name: useId(), type: useId(), email: useId(), phone: useId(), city: useId() };

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Lot 65b : « Créer et comparer » (par défaut) ou « Créer et retenir ».
    const retain = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "retain";
    const text = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value === "" ? null : value;
    };
    startTransition(async () => {
      const result = await createSlotVendorAction({ eventId, slotId, name: text("name") ?? "", typeId: text("typeId"), email: text("email"), phone: text("phone"), city: text("city"), retain });
      if (!result.ok) {
        setError("error" in result ? result.error : result.confirm);
        return;
      }
      onCreated();
    });
  };

  return (
    <dialog ref={dialog} className="window window-short" aria-labelledby={ids.title} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="window-head">
        <h2 id={ids.title}>{t("newVendorTitle", { slot: slotLabel })}</h2>
        <button type="button" className="button-ghost" onClick={onClose}>
          {t("windowClose")}
        </button>
      </div>
      <form onSubmit={submit} className="stack">
        <RequiredLegend text={tCommon("requiredLegend")} />
        <label htmlFor={ids.name}>{t("newVendorName")}
          <RequiredMark />
        </label>
        <input id={ids.name} name="name" type="text" required maxLength={200} defaultValue={initialName} />
        {vendorTypes.length > 0 ? (
          <>
            <label htmlFor={ids.type}>{t("newVendorType")}</label>
            <select id={ids.type} name="typeId" defaultValue="">
              <option value="">{t("newVendorTypeNone")}</option>
              {vendorTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <label htmlFor={ids.email}>{t("newVendorEmail")}</label>
        <input id={ids.email} name="email" type="email" maxLength={320} autoComplete="off" />
        <label htmlFor={ids.phone}>{t("newVendorPhone")}</label>
        <input id={ids.phone} name="phone" type="tel" maxLength={40} autoComplete="off" />
        <label htmlFor={ids.city}>{t("newVendorCity")}</label>
        <input id={ids.city} name="city" type="text" maxLength={120} />
        <p className="meta">{t("newVendorHint")}</p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="window-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" name="intent" value="retain" className="button-secondary" disabled={pending}>
            {t("newVendorSaveRetain")}
          </button>
          <button type="submit" name="intent" value="compare" className="button-primary" disabled={pending}>
            {t("newVendorSave")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
