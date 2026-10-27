import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Page introuvable (identifiant inconnu, ressource supprimée — par exemple
// un événement d'essai terminé, AIDE-02 — ou d'une autre organisation) :
// traduite et accessible, sans dire si la ressource a existé.
export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <Link href="/">{t("home")}</Link>
    </main>
  );
}
