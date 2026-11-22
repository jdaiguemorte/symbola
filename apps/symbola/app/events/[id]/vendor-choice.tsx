"use client";

// Lot 63c (BUD-04, PRE-02 ; #39, maquette M9) — chercher un prestataire du catalogue depuis la ligne
// d'un poste (le métier du poste et « Déjà travaillé ensemble » d'abord) ; « + Nouveau prestataire »
// crée la fiche dans une fenêtre, sans quitter le budget.
// Lot 65b (PRE-02, BUD-02 ; maquette M14 C) : choisir un nom ne le retient plus d'office. Chaque fiche
// propose « Comparer » (elle entre dans la comparaison du poste) et « Retenir » ; sans rien taper, la
// liste montre tout le carnet du métier, avec « Voir tout le carnet ». Retenir au-delà du seuil
// d'alerte du budget se confirme d'abord (BUD-02).
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { ChevronDown } from "lucide-react";
import { compareSlotVendorAction, createSlotVendorAction, retainSlotVendorAction, searchSlotVendorsAction, type SlotVendorState } from "./budget-vendor-actions";
import type { SlotVendorSearch } from "@/lib/vendors/slot-retention";

const DEBOUNCE_MS = 200;

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
  // « Voir tout le carnet » : le carnet, filtré pour ce poste.
  catalogHref: string;
  vendorTypes: { id: string; label: string }[];
  // Le libellé du bouton (« + Ajouter des prestataires » sur la ligne, « + Ajouter un prestataire » dans la fenêtre).
  label?: string | undefined;
  // Après un ajout (la comparaison de la fenêtre se recharge).
  onChanged?: () => void;
}) {
  const t = useTranslations("BudgetVendors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [found, setFound] = useState<SlotVendorSearch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ vendorId: string; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const ids = { popover: useId(), search: useId() };

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || creating) return;
      // Dans la fenêtre du poste, Échap ferme la liste, pas la fenêtre.
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!creating && !root.current?.contains(event.target as Node)) setOpen(false);
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

  const done = (result: SlotVendorState, vendorId: string) => {
    if (result.ok) {
      setError(null);
      setConfirm(null);
      setVersion(version + 1);
      onChanged?.();
      router.refresh();
      return;
    }
    if ("confirm" in result) setConfirm({ vendorId, message: result.confirm });
    else setError(result.error);
  };

  const compare = (vendorId: string) => startTransition(async () => done(await compareSlotVendorAction({ eventId, slotId, vendorId }), vendorId));
  const retain = (vendorId: string, confirmed = false) => startTransition(async () => done(await retainSlotVendorAction({ eventId, slotId, vendorId, confirmed }), vendorId));
  const choices = found?.choices ?? null;

  return (
    <div className="menu-button" ref={root}>
      <button ref={button} type="button" className="button-secondary" aria-expanded={open} aria-controls={ids.popover} onClick={() => setOpen(!open)}>
        {label ?? t("choose")}
        <span className="sr-only"> {t("chooseFor", { slot: slotLabel })}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div id={ids.popover} className="menu-popover vendor-choice-popover" role="group" aria-label={t("chooseFor", { slot: slotLabel })}>
          <label htmlFor={ids.search}>{t("searchLabel", { slot: slotLabel })}</label>
          <input ref={search} id={ids.search} type="search" value={term} maxLength={100} autoComplete="off" onChange={(event) => setTerm(event.target.value)} />
          <p className="sr-only" role="status" aria-live="polite">
            {choices ? t("resultsCount", { count: choices.length }) : ""}
          </p>
          {choices && choices.length > 0 ? (
            <ul className="vendor-choice-results" aria-label={t("resultsLabel")}>
              {choices.map((vendor) => (
                <li key={vendor.id}>
                  <span className="vendor-choice-who">
                    <strong>{vendor.name}</strong>
                    <span className="meta">
                      {[vendor.city, vendor.typeLabel, vendor.workedWithCount > 0 ? t("workedWithCount", { count: vendor.workedWithCount }) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {vendor.onSlot ? (
                    <span className={vendor.onSlot === "retained" ? "badge badge-sauge" : "badge"}>{t(vendor.onSlot === "retained" ? "retainedBadge" : "inComparison")}</span>
                  ) : (
                    <span className="vendor-choice-actions">
                      <button type="button" className="button-secondary" disabled={pending} onClick={() => compare(vendor.id)} title={t("compareHint", { name: vendor.name, slot: slotLabel })}>
                        {t("compareOne")}
                        <span className="sr-only"> — {vendor.name}</span>
                      </button>
                      <button type="button" className="button-secondary" disabled={pending} onClick={() => retain(vendor.id)} title={t("retainHint", { name: vendor.name, slot: slotLabel })}>
                        {t("retainOne")}
                        <span className="sr-only"> — {vendor.name}</span>
                      </button>
                    </span>
                  )}
                  {vendor.onSlot === "compared" ? (
                    <button type="button" className="link-button" disabled={pending} onClick={() => retain(vendor.id)} title={t("retainHint", { name: vendor.name, slot: slotLabel })}>
                      {t("retainOne")}
                      <span className="sr-only"> — {vendor.name}</span>
                    </button>
                  ) : null}
                  {confirm?.vendorId === vendor.id ? (
                    <div className="notice notice-attention">
                      <p role="alert">{confirm.message}</p>
                      <button type="button" className="button-primary" disabled={pending} onClick={() => retain(vendor.id, true)}>
                        {t("confirmRetain")}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {choices && choices.length === 0 ? <p className="meta">{t("noResults")}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          <div className="vendor-choice-more">
            <Link href={catalogHref}>{found && found.matchingCount > 0 ? t("seeCatalog", { count: found.matchingCount }) : t("seeCatalogAll")}</Link>
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
