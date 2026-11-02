import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { SearchForm } from "./search-form";

// RGPD-01 — module « Données personnelles » : recherche transverse d'une
// personne dans tous les modules souscrits. Titulaire du compte seulement.
export default async function PrivacyPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");

  const t = await getTranslations("Privacy");
  const tHelp = await getTranslations("Help");
  if (auth.user.role !== "owner") {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  return (
    <main>
      <h1>{t("title")}</h1>
      <HelpButton title={tHelp("privacySearch.title")} body={tHelp("privacySearch.body")} />
      <SearchForm />
    </main>
  );
}
