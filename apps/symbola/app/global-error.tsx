"use client";

// Lot 39b (NFR-16 ; D9 ; ADR 0074) — quand le gabarit lui-même échoue (base injoignable au moment
// d'afficher le menu, par exemple), Next.js remplace toute la page : jamais une page blanche, mais un
// message clair, une référence courte (la même qu'au journal du serveur) et « Réessayer ». Les textes
// viennent de fichiers de traduction réduits : le reste de l'app (et ses traductions) n'a pas pu se
// charger.
import { useEffect, useState } from "react";
import en from "@symbola/i18n/messages/global-error.en.json";
import fr from "@symbola/i18n/messages/global-error.fr.json";
import { errorReference } from "@/lib/error-reference";
import { reportBrowserError } from "@/lib/report-browser-error";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  useEffect(() => {
    if (navigator.language.toLowerCase().startsWith("en")) setLocale("en");
  }, []);
  const text = locale === "en" ? en : fr;
  const reference = errorReference(error.digest ?? error.name);
  // Lot 40b (Q27, ADR 0077) : une erreur née dans le navigateur part au suivi des erreurs, une fois.
  useEffect(() => {
    reportBrowserError(error, reference);
  }, [error, reference]);
  return (
    <html lang={locale}>
      <body>
        <main>
          <h1>{text.title}</h1>
          <p>{text.body}</p>
          <p>{text.reference.replace("{reference}", reference)}</p>
          <button type="button" onClick={reset}>
            {text.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
