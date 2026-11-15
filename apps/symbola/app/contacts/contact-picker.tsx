"use client";

// Lot 36a (UX-02, CRM-03) — choisir un contact existant comme client d'un évènement, au lieu de le
// ressaisir : recherche en tapant (nom, adresse ou téléphone), quelques résultats, un bouton pour
// choisir. Le contact choisi remplace la saisie du nom (les champs passés en enfants, dans le même
// cadre) ; « Changer » revient à la recherche.
import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { searchContactsAction, type ContactChoice } from "./actions";

const DEBOUNCE_MS = 250;

export function ContactPicker({
  name,
  legend,
  initial = null,
  children,
}: {
  // Nom du champ caché qui porte l'identifiant du contact choisi.
  name: string;
  legend: string;
  initial?: ContactChoice | null;
  // Les champs d'un nouveau contact, montrés tant qu'aucun contact n'est choisi.
  children?: ReactNode;
}) {
  const t = useTranslations("Contacts");
  const id = useId();
  const [chosen, setChosen] = useState<ContactChoice | null>(initial);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ContactChoice[] | null>(null);

  useEffect(() => {
    if (chosen || term.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      searchContactsAction(term).then(setResults, () => setResults([]));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, chosen]);

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
          <label htmlFor={`${id}-search`}>{t("pickerSearch")}</label>
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
          {results && results.length === 0 ? <p className="meta">{t("pickerNone")}</p> : null}
          {children}
        </>
      )}
    </fieldset>
  );
}
