// Lot 26a (RGP-03) — mention d'information au nom de l'organisation, sur chaque
// page du portail : le texte de ses réglages RGPD, sinon le texte de départ.
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { linkPrivacyNoticeFor } from "@/modules/hub/service";

export async function LinkPrivacyNotice({ organizationId }: { organizationId: string }) {
  const t = await getTranslations("LinkPortal");
  const text = await linkPrivacyNoticeFor(appDatabase(), organizationId, (await getLocale()) as Locale);
  return (
    <section className="link-privacy" aria-labelledby="link-privacy-title">
      <h2 id="link-privacy-title">{t("privacyTitle")}</h2>
      <p>{text}</p>
    </section>
  );
}
