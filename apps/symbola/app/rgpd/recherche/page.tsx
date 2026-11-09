import { getTranslations } from "next-intl/server";
import { parisDate } from "@symbola/privacy";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requireOwner } from "@/lib/guards";
import { PRIVACY_REQUEST_TYPES } from "@/modules/hub/service";
import { PrivacyTabs } from "../privacy-tabs";
import { SearchForm } from "../search-form";

// RGPD-01, lot 18 (RGPD-07, décision B) — rechercher une personne pour
// consulter ses données. Exporter ou effacer part toujours d'une demande :
// la recherche propose de l'enregistrer, puis ouvre son dossier.
export default async function PrivacySearchPage() {
  const auth = await requireOwner();
  const t = await getTranslations("Privacy");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("searchSubtitle")} />
      <ScreenHelp title={tHelp("privacySearch.title")} body={tHelp("privacySearch.body")} />
      <PrivacyTabs />
      <SearchForm createRequest={{ types: PRIVACY_REQUEST_TYPES, today: parisDate(new Date()) }} />
    </main>
  );
}
