// Lot 66c (HUB-18, MSG-01 ; D5, D6 ; ADR 0113 ; maquettes M19 et M20) — Paramètres › Modèles d'e-mails ›
// Marque et signature : la marque des e-mails de l'organisation et le modèle commun des signatures,
// avec l'aperçu d'un e-mail fictif à l'image de l'organisation (et la signature de la personne qui
// regarde). Les collaboratrices le lisent ; la titulaire le règle.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { listTeam } from "@symbola/auth";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { EMAIL_FOOTER_LINE_MAX, EMAIL_SENDER_NAME_MAX, getEmailBranding, getMemberSignature, getOrganizationProfile, previewEmailTemplate } from "@/modules/hub/service";
import { EmailPreviewView } from "../email-preview";
import { templateLocale } from "../groups";
import { EmailBrandingForm } from "./branding-form";

export default async function EmailBrandingPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("EmailBranding");
  const tHelp = await getTranslations("Help");
  const locale = templateLocale(undefined, await getLocale());
  const db = appDatabase();
  const [branding, team, preview, profile] = await Promise.all([
    getEmailBranding(organizationId),
    listTeam(db, organizationId),
    // Un e-mail de la planner à un client : sa police, son pied, sa signature, son bouton.
    previewEmailTemplate({ organizationId, kind: "client_link", locale }),
    getOrganizationProfile(db, organizationId),
  ]);
  const active = team.filter((member) => !member.disabledAt && (member.role === "owner" || member.role === "member"));
  const planners = await Promise.all(
    active.map(async (member) => {
      const signature = await getMemberSignature(organizationId, member.id);
      return { id: member.id, label: signature?.displayName ? `${signature.displayName} (${member.email})` : member.email };
    }),
  );
  const ownerId = active.find((member) => member.role === "owner")?.id ?? null;
  const logoVersion = profile.logoKey ? (profile.logoKey.split("/").pop() ?? null) : null;

  return (
    <main>
      <Link href="/parametres/emails" className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("emailBranding.title")} body={tHelp("emailBranding.body")} />
      <div className="email-template-editor">
        <section aria-labelledby="email-branding-title" className="card">
          <h2 id="email-branding-title">{t("brandTitle")}</h2>
          <EmailBrandingForm
            branding={branding}
            planners={planners}
            ownerId={ownerId}
            limits={{ footerLine: EMAIL_FOOTER_LINE_MAX, senderName: EMAIL_SENDER_NAME_MAX }}
            disabled={auth.user.role !== "owner"}
          />
          <p>
            <Link href="/profil/signature">{t("mySignatureLink")}</Link>
          </p>
        </section>
        <section aria-labelledby="email-branding-preview-title">
          <h2 id="email-branding-preview-title">{t("previewTitle")}</h2>
          <p className="meta">{t("previewIntro")}</p>
          <EmailPreviewView preview={preview} logoUrl={logoVersion ? `/logo?v=${encodeURIComponent(logoVersion)}` : null} signaturePhotoUrl="/profil/signature/photo" />
        </section>
      </div>
    </main>
  );
}
