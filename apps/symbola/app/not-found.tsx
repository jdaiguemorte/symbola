import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { journalAccessRefusal } from "@/lib/access-refusals";

// Page introuvable (identifiant inconnu, ressource supprimée — par exemple
// un événement d'essai terminé, AIDE-02 — ou d'une autre organisation) :
// traduite et accessible, sans dire si la ressource a existé (SEC-13). Lot 24a
// (SC-S1, décision D4) : un identifiant demandé dans l'adresse par une personne
// connectée va au journal de son organisation (chemin posé par middleware.ts).
export default async function NotFound() {
  await journalAccessRefusal((await headers()).get("x-pathname") ?? "");
  const t = await getTranslations("NotFound");
  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <Link href="/">{t("home")}</Link>
    </main>
  );
}
