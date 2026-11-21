// Lot 63c (UX-09, UX-13 ; ADR 0107, maquette M8) — la roue « Réglages » d'un écran, interceptée : les
// réglages s'affichent dans le panneau latéral, au-dessus de l'écran courant, qui ne bouge pas. Chaque
// page de réglages contrôle elle-même la session, l'organisation, le rôle et le module (SEC-12).
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePlanner } from "@/lib/guards";
import { SettingsPanel } from "@/app/ui/settings-panel";
import { backKeyOf, isSettingsPanelKey, SETTINGS_PANELS, type SettingsPanelKey } from "@/app/reglages/panels";
import EventsSettingsPage from "@/app/events/parametres/page";
import TaskTemplatesPage from "@/app/events/modeles/page";
import ProgramTemplatesPage from "@/app/events/modeles-programme/page";
import QuoteSettingsPage from "@/app/devis/parametres/page";
import VendorTypesPage from "@/app/prestataires/parametres/page";

const NO_QUERY = Promise.resolve({});

function content(key: SettingsPanelKey) {
  switch (key) {
    case "evenements":
      return <EventsSettingsPage searchParams={NO_QUERY} />;
    case "modeles":
      return <TaskTemplatesPage searchParams={NO_QUERY} />;
    case "modeles-programme":
      return <ProgramTemplatesPage searchParams={NO_QUERY} />;
    case "devis":
      return <QuoteSettingsPage />;
    case "prestataires":
      return <VendorTypesPage searchParams={NO_QUERY} />;
  }
}

export default async function SettingsPanelPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ retour?: string }> }) {
  await requirePlanner();
  const { key } = await params;
  if (!isSettingsPanelKey(key)) notFound();
  const back = backKeyOf((await searchParams).retour);
  const t = await getTranslations("Common");
  return (
    <SettingsPanel label={t("settingsPanelLabel")} backLabel={t(`settingsBack.${back ?? "screen"}`)} fallbackHref={SETTINGS_PANELS[key]}>
      {content(key)}
    </SettingsPanel>
  );
}
