// Lot 66c (HUB-18 ; D5 ; ADR 0113 ; maquette M19) — Mon compte › Ma signature : la signature de la
// personne connectée, ajoutée aux e-mails qu'elle envoie depuis Symbola. L'organisation choisit les
// éléments affichés ; un envoi automatique porte celle choisie par la titulaire.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { SIGNATURE_ELEMENTS } from "@symbola/contracts";
import { starterSignatureLinkSuggestions } from "@symbola/starter-templates";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { getEmailBranding, getMemberSignature, getOrganizationContact, SIGNATURE_LINK_LABEL_MAX, SIGNATURE_TEXT_MAX, SIGNATURE_URL_MAX } from "@/modules/hub/service";
import { SignatureForm } from "./signature-form";

export default async function MySignaturePage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("MySignature");
  const tBranding = await getTranslations("EmailBranding");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const [signature, branding, organization] = await Promise.all([getMemberSignature(organizationId, auth.user.id), getEmailBranding(organizationId), getOrganizationContact(appDatabase(), organizationId)]);
  const hidden = SIGNATURE_ELEMENTS.filter((element) => !branding.signatureElements.includes(element));

  return (
    <main>
      <Link href="/profil" className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("mySignature.title")} body={tHelp("mySignature.body")} />
      {hidden.length > 0 ? <p className="notice">{t("hiddenNote", { elements: hidden.map((element) => tBranding(`elements.${element}`)).join(", ") })}</p> : null}
      <SignatureForm
        signature={signature}
        font={branding.font}
        elements={branding.signatureElements}
        organizationName={organization.name}
        suggestions={starterSignatureLinkSuggestions(locale)}
        limits={{ text: SIGNATURE_TEXT_MAX, label: SIGNATURE_LINK_LABEL_MAX, url: SIGNATURE_URL_MAX }}
      />
      <p className="meta">{t("automaticNote")}</p>
      <p className="meta">{t("preparedNote")}</p>
    </main>
  );
}
