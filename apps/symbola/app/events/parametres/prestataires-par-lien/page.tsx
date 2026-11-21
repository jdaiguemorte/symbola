// Lot 47 (partie F ; ADR 0085) — Paramètres › Prestataires par lien : date limite par défaut d'un
// brief, relance la veille, feuilles de route (J-30, J-7, désactivables), délai de l'alerte sans
// confirmation, tâches de suivi créées au choix du client (liste de l'organisation, HUB-20). La
// titulaire les change ; l'équipe les lit.
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { getVendorCoordinationSettings } from "@/modules/events/service";
import { getOrganizationProfile } from "@/modules/hub/service";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { VendorCoordinationSettingsForm } from "./settings-form";

export default async function VendorCoordinationSettingsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("VendorCoordination");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("settings.title")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const profile = await getOrganizationProfile(appDatabase(), organizationId);
  const settings = await getVendorCoordinationSettings(organizationId, locale, profile.metier);
  return (
    <main>
      <h1>{t("settings.title")}</h1>
      <ScreenHelp title={tHelp("vendorCoordinationSettings.title")} body={tHelp("vendorCoordinationSettings.body")} />
      <p>{t("settings.intro")}</p>
      <div>
        <VendorCoordinationSettingsForm settings={settings} editable={auth.user.role === "owner"} />
      </div>
    </main>
  );
}
