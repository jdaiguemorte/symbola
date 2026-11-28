// Lot 74g (G1, G2 ; page 29 des maquettes du lot 68) — l'accueil des Paramètres : huit groupes, leurs
// rubriques et leur phrase, puis « Vos données ». « Entreprise et TVA », qu'ouvrait « Paramètres », est
// devenu deux rubriques (/parametres/entreprise, /parametres/mentions) ; ses anciennes ancres y mènent.
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { settingsMenu, YOUR_DATA_PATH } from "../settings-menu";
import { loadPrivacyAlerts, loadSettingsFlags } from "../settings-flags";
import { CompanyAnchorRedirect } from "./company-anchor-redirect";
import { SettingsHome } from "./settings-home";

export default async function SettingsHomePage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  const flags = await loadSettingsFlags(organizationId, auth.user.role);
  const alerts = await loadPrivacyAlerts(organizationId, flags.isOwner);
  const groups = settingsMenu(flags).map((group) => ({
    key: group.key,
    label: t(group.label),
    hint: t(group.hint),
    items: group.items.map((item) => ({ href: item.href, label: t(item.label), hint: t(item.hint), owner: item.owner })),
  }));
  const rubrics = groups.reduce((total, group) => total + group.items.length, 0);

  return (
    <main>
      <CompanyAnchorRedirect />
      <h1>{t("homeTitle")}</h1>
      <ScreenHelp title={tHelp("settingsHome.title")} body={tHelp("settingsHome.body")} />
      <p className="settings-home-intro">{t("homeIntro", { rubrics, groups: groups.length })}</p>
      <SettingsHome
        groups={groups}
        yourData={{ href: YOUR_DATA_PATH, label: t("yourData"), hint: t("yourDataHint"), open: t("yourDataOpen"), count: alerts, countLabel: t("privacyAlerts", { count: alerts }) }}
      />
    </main>
  );
}
