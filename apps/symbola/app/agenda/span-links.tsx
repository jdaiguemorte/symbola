"use client";

// HUB-02 — choix de la durée affichée (3, 6 ou 12 mois), retenu pour la
// prochaine visite dans un cookie (préférence d'affichage, sans donnée
// personnelle).
import Link from "next/link";

export const AGENDA_SPAN_COOKIE = "symbola_agenda_mois";

export function AgendaSpanLinks({ links, label }: { links: { span: number; href: string; label: string; current: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="segmented">
      {links.map((link) => (
        <Link
          key={link.span}
          href={link.href}
          aria-current={link.current ? "true" : undefined}
          onClick={() => {
            document.cookie = `${AGENDA_SPAN_COOKIE}=${link.span}; path=/; max-age=31536000; samesite=lax`;
          }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
