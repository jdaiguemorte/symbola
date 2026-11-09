// Lot 17 (DEV-08 à DEV-11, décision A) — Paramètres › Ventes › Documents :
// logo, apparence, textes et paiement des devis et factures, avec un aperçu
// en direct et un PDF d'exemple.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { starterDocumentStyle, starterInvoiceMentions, starterQuoteTerms } from "@symbola/starter-templates";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { LogoForm } from "@/app/logo/logo-form";
import { requirePlanner } from "@/lib/guards";
import { getOrganizationProfile } from "@/modules/hub/service";
import { currentQuoteSeller, DOCUMENT_INTRO_MAX_LENGTH, DOCUMENT_TERMS_MAX_LENGTH, getDocumentSettings } from "@/modules/quotes/service";
import { isQuotesModuleEnabled } from "../../module-access";
import { DocumentSettingsForm } from "./document-settings-form";
import { sampleContextFor } from "./sample-context";

// Partie opaque de la clé du logo : change à chaque remplacement.
function logoVersion(logoKey: string | null): string | null {
  return logoKey ? (logoKey.split("/").pop() ?? null) : null;
}

export default async function DocumentsSettingsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Documents");
  const tHelp = await getTranslations("Help");

  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <PageHeader title={t("title")} />
        <p>{t("unavailable")}</p>
      </main>
    );
  }

  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const [settings, seller, profile, context] = await Promise.all([
    getDocumentSettings(organizationId),
    currentQuoteSeller(organizationId),
    getOrganizationProfile(appDatabase(), organizationId),
    sampleContextFor(organizationId),
  ]);
  const style = starterDocumentStyle(locale);
  const version = logoVersion(profile.logoKey);

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("quotesDocuments.title")} body={tHelp("quotesDocuments.body")} />

      <section aria-labelledby="documents-logo-title" className="settings-block">
        <h2 id="documents-logo-title">{t("logoTitle")}</h2>
        <LogoForm version={version} />
      </section>

      <section aria-labelledby="documents-details-title" className="settings-block">
        <h2 id="documents-details-title">{t("detailsTitle")}</h2>
        <p>
          {t("detailsHint")} <Link href="/parametres">{t("detailsLink")}</Link>
        </p>
      </section>

      <DocumentSettingsForm
        settings={settings}
        seller={seller}
        context={context}
        swatches={style.swatches}
        defaultColor={style.defaultColor}
        starters={{ quoteTerms: starterQuoteTerms(locale), invoiceTerms: starterInvoiceMentions(locale) }}
        limits={{ intro: DOCUMENT_INTRO_MAX_LENGTH, terms: DOCUMENT_TERMS_MAX_LENGTH }}
        logoUrl={version ? `/logo?v=${encodeURIComponent(version)}` : null}
      />
    </main>
  );
}
