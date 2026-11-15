"use client";

// Lot 36a (UX-02, CRM-03) — choisir un contact existant comme client d'un évènement, au lieu de le
// ressaisir : recherche en tapant (nom, adresse ou téléphone), quelques résultats, un bouton pour
// choisir. Le contact choisi remplace la saisie du nom (les champs passés en enfants, dans le même
// cadre) ; « Changer » revient à la recherche.
import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ContactKind } from "@symbola/contracts";
import { searchContactsAction, type ContactChoice } from "./actions";

const DEBOUNCE_MS = 250;

export function ContactPicker({
  name,
  legend,
  initial = null,
  kinds,
  searchLabel,
  children,
}: {
  // Nom du champ caché qui porte l'identifiant du contact choisi.
  name: string;
  legend: string;
  initial?: ContactChoice | null;
  // Les champs d'un nouveau contact, montrés tant qu'aucun contact n'est choisi.
  children?: ReactNode;
  // Lot 36b : natures proposées (les personnes seulement, pour le membre d'un foyer).
  kinds?: readonly ContactKind[];
  // Libellé de la recherche (par défaut : « Client déjà connu ? … »).
  searchLabel?: string;
}) {
  const t = useTranslations("Contacts");
  const id = useId();
  const [chosen, setChosen] = useState<ContactChoice | null>(initial);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ContactChoice[] | null>(null);
  // Clé stable des natures demandées (un tableau change à chaque rendu).
  const kindsKey = (kinds ?? []).join(",");

  useEffect(() => {
    if (chosen || term.trim().length < 2) {
      setResults(null);
      return;
    }
    const wanted = kindsKey ? (kindsKey.split(",") as ContactKind[]) : undefined;
    const timer = setTimeout(() => {
      searchContactsAction(term, wanted).then(setResults, () => setResults([]));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, chosen, kindsKey]);

  const choose = (contact: ContactChoice | null) => {
    setChosen(contact);
    setTerm("");
  };

  return (
    <fieldset className="stack">
      <legend>{legend}</legend>
      {chosen ? (
        <>
          <input type="hidden" name={name} value={chosen.id} />
          <p>
            {t("pickerChosen", { name: chosen.displayName })}
            {chosen.email ? ` · ${chosen.email}` : ""}{" "}
            <button type="button" className="button-ghost" onClick={() => choose(null)}>
              {t("pickerChange")}
            </button>
          </p>
        </>
      ) : (
        <>
          <label htmlFor={`${id}-search`}>{searchLabel ?? t("pickerSearch")}</label>
          <input id={`${id}-search`} type="search" value={term} onChange={(event) => setTerm(event.target.value)} maxLength={100} autoComplete="off" />
          <p className="sr-only" role="status" aria-live="polite">
            {results ? t("pickerResults", { count: results.length }) : ""}
          </p>
          {results && results.length > 0 ? (
            <ul className="contact-choices" aria-label={t("pickerResultsLabel")}>
              {results.map((contact) => (
                <li key={contact.id}>
                  <span>
                    {contact.displayName}
                    {contact.email || contact.city ? <span className="meta"> · {[contact.email, contact.city].filter(Boolean).join(" · ")}</span> : null}
                  </span>
                  <button type="button" onClick={() => choose(contact)} aria-label={t("pickerChoose", { name: contact.displayName })}>
                    {t("pickerChooseShort")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {results && results.length === 0 ? <p className="meta">{children ? t("pickerNone") : t("pickerNoneAlone")}</p> : null}
          {children}
        </>
      )}
    </fieldset>
  );
}
