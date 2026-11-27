"use client";

// Lot 72c (PAR-10 ; J4 ; maquette 14 du lot 68) — les deux gestes de « Moi · L'agence » qui tiennent au
// navigateur : le filtre « Planner principal » de la table des évènements (un choix s'applique tout de suite,
// l'adresse change) et le dernier choix de la bascule, gardé sur l'appareil (cookie, aucune donnée personnelle :
// « moi » ou « agence »).
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AgencyLeadFilter({ label, allLabel, value, options, hrefs }: { label: string; allLabel: string; value: string; options: { id: string; name: string }[]; hrefs: Record<string, string> }) {
  const router = useRouter();
  return (
    <label className="agency-lead-filter" htmlFor="agency-lead">
      <span>{label}</span>
      <select id="agency-lead" value={value} onChange={(event) => router.push(hrefs[event.target.value] ?? hrefs[""]!, { scroll: false })}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function RememberHomeScope({ cookie, value }: { cookie: string; value: string }) {
  useEffect(() => {
    document.cookie = `${cookie}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [cookie, value]);
  return null;
}
