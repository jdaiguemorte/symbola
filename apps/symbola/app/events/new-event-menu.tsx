"use client";

// Lot 63c (EVT-01, HUB-07 ; maquette M7) — « Nouveau » sur les trois vues des évènements : un menu de
// trois choix, chacun avec ce qu'il veut dire. Échap ou un clic ailleurs le ferme ; le focus va au
// premier choix à l'ouverture et revient au bouton à la fermeture.
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NEW_EVENT_MODES, newEventHref, type NewEventMode } from "./new/new-event-mode";

const KEYS: Record<NewEventMode, { title: "newMenuProspect" | "newMenuConfirmed" | "newMenuClient"; hint: "newMenuProspectHint" | "newMenuConfirmedHint" | "newMenuClientHint" }> = {
  prospect: { title: "newMenuProspect", hint: "newMenuProspectHint" },
  confirmed: { title: "newMenuConfirmed", hint: "newMenuConfirmedHint" },
  client: { title: "newMenuClient", hint: "newMenuClientHint" },
};

export function NewEventMenu() {
  const t = useTranslations("Events");
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="menu-button" ref={root}>
      <button ref={button} type="button" className="button-primary" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)} data-tour="new-prospect">
        {t("newMenu")}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <ul id={menuId} className="menu-popover" aria-label={t("newMenuLabel")}>
          {NEW_EVENT_MODES.map((mode) => (
            <li key={mode}>
              <Link href={newEventHref(mode)} onClick={() => setOpen(false)}>
                <strong>{t(KEYS[mode].title)}</strong>
                <span className="meta">{t(KEYS[mode].hint)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
