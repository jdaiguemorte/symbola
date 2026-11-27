"use client";

// Lot 70e (HUB-02 ; C-12, C-13, C-82, M7 ; page 3 des maquettes du lot 68) — le menu du compte, sous le
// prénom dans la barre du haut : il quitte le bas du menu latéral (200 px gagnés, C-82). Nom et adresse
// en entier (à la ligne), l'organisation et le rôle, « Mon compte », « Changer d'organisation », puis à
// part « Se déconnecter ». Échap et un clic ailleurs le ferment, le focus revient au bouton.
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type AccountMenuLabels = { menu: string; profile: string; profileHint: string; switch: string; switchHint: string };

export function AccountMenu({
  initials,
  shortName,
  fullName,
  email,
  context,
  labels,
  switcher,
  logout,
}: {
  initials: string;
  shortName: string;
  fullName: string;
  email: string;
  // « Atelier Roussel · titulaire »
  context: string;
  labels: AccountMenuLabels;
  switcher: ReactNode;
  logout: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
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
    <div className="account-menu" ref={root}>
      <button ref={button} type="button" className="account-menu-button button-secondary" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <span className="account-menu-initials" aria-hidden="true">
          {initials}
        </span>
        <span className="account-menu-name">{shortName}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div id={panelId} className="account-menu-panel" role="group" aria-label={labels.menu}>
          <div className="account-menu-identity">
            <strong>{fullName}</strong>
            <span>{email}</span>
            <span>{context}</span>
          </div>
          <Link href="/profil" className="account-menu-item" onClick={() => setOpen(false)}>
            <strong>{labels.profile}</strong>
            <span className="meta">{labels.profileHint}</span>
          </Link>
          <div className="account-menu-item account-menu-switch">
            <strong>{labels.switch}</strong>
            <span className="meta">{labels.switchHint}</span>
            {switcher}
          </div>
          <div className="account-menu-logout">{logout}</div>
        </div>
      ) : null}
    </div>
  );
}
