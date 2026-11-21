"use client";

// Lot 63c (BUD-04, PRE-02 ; #39, maquette M9) — « Choisir un prestataire… » sur la ligne d'un poste :
// une recherche dans le catalogue (le métier du poste et « Déjà travaillé ensemble » d'abord) ; le
// choisir le retient. « + Nouveau prestataire » crée la fiche dans une fenêtre, sans quitter le
// budget ; « Comparer plusieurs prestataires » ouvre la consultation du poste.
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { ChevronDown } from "lucide-react";
import { createSlotVendorAction, retainSlotVendorAction, searchSlotVendorsAction } from "./budget-vendor-actions";
import type { SlotVendorChoice } from "@/lib/vendors/slot-retention";

const DEBOUNCE_MS = 200;

export function VendorChoice({ eventId, slotId, slotLabel, consultationHref, vendorTypes }: { eventId: string; slotId: string; slotLabel: string; consultationHref: string; vendorTypes: { id: string; label: string }[] }) {
  const t = useTranslations("BudgetVendors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SlotVendorChoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!creating && !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, creating]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    const timer = setTimeout(() => {
      void searchSlotVendorsAction({ eventId, slotId, term }).then((found) => {
        if (current) setResults(found);
      });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, term, eventId, slotId]);

  const retain = (vendor: SlotVendorChoice) =>
    startTransition(async () => {
      const result = await retainSlotVendorAction({ eventId, slotId, vendorId: vendor.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="menu-button" ref={root}>
      <button ref={button} type="button" className="button-secondary" aria-expanded={open} aria-controls={ids.popover} onClick={() => setOpen(!open)}>
        {t("choose")}
        <span className="sr-only"> {t("chooseFor", { slot: slotLabel })}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div id={ids.popover} className="menu-popover vendor-choice-popover" role="group" aria-label={t("chooseFor", { slot: slotLabel })}>
          <label htmlFor={ids.search}>{t("searchLabel", { slot: slotLabel })}</label>
          <input ref={search} id={ids.search} type="search" value={term} maxLength={100} autoComplete="off" onChange={(event) => setTerm(event.target.value)} />
          <p className="sr-only" role="status" aria-live="polite">
            {results ? t("resultsCount", { count: results.length }) : ""}
          </p>
          {results && results.length > 0 ? (
            <ul className="vendor-choice-results" aria-label={t("resultsLabel")}>
              {results.map((vendor) => (
                <li key={vendor.id}>
                  <button type="button" disabled={pending} onClick={() => retain(vendor)}>
                    <strong>{vendor.name}</strong>
                    <span className="meta">
                      {[vendor.city, vendor.typeLabel, vendor.workedWith ? t("workedWith") : null].filter(Boolean).join(" · ")}
                    </span>
                    <span className="sr-only">{t("retainHint", { slot: slotLabel })}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {results && results.length === 0 ? <p className="meta">{t("noResults")}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          <div className="vendor-choice-more">
            <button type="button" className="link-button" onClick={() => setCreating(true)} aria-haspopup="dialog">
              {term.trim() ? t("newVendorNamed", { name: term.trim() }) : t("newVendor")}
            </button>
            <Link href={consultationHref}>{t("compare")}</Link>
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
    const text = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value === "" ? null : value;
    };
    startTransition(async () => {
      const result = await createSlotVendorAction({ eventId, slotId, name: text("name") ?? "", typeId: text("typeId"), email: text("email"), phone: text("phone"), city: text("city") });
      if (!result.ok) {
        setError(result.error);
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
          <button type="submit" className="button-primary" disabled={pending}>
            {t("newVendorSave")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
