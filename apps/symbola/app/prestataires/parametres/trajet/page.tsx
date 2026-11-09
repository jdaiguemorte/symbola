// Lot 11 (PRE-07) — paramètres du trajet estimé (détour, vitesse moyenne).
import { getTranslations } from "next-intl/server";
import { getVendorSettings } from "@/modules/vendors/service";
import { vendorSettingsAccess } from "../guard";
import { TravelForm } from "../settings-forms";

export default async function VendorTravelPage() {
  const { organizationId, enabled } = await vendorSettingsAccess();
  const t = await getTranslations("VendorBook");
  if (!enabled) {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const settings = await getVendorSettings(organizationId);
  return (
    <main>
      <h1>{t("settingsTravelTitle")}</h1>
      {/* Lot 18 (PRE-16) : où l'estimation apparaît, et comment elle se calcule. */}
      <p>{t("settingsTravelIntro")}</p>
      <p className="meta">{t("settingsTravelHow")}</p>
      <TravelForm detour={(settings.detourFactorPermille / 1000).toLocaleString("fr-FR")} speed={settings.averageSpeedKmh} />
    </main>
  );
}
