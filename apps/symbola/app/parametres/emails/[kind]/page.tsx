// Lot 38a (MSG-01, HUB-18 ; D3, D5, D6, D7 ; ADR 0072) — un modèle d'e-mail, dans une langue : objet,
// texte, variables, aperçu à l'image de l'organisation avec des données fictives, essai envoyé à
// soi-même, et « Revenir au texte de départ » (confirmé : le texte personnalisé est perdu).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { ScreenHelp } from "@/app/screen-help";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import {
  defaultButtonLabel,
  EMAIL_BODY_MAX,
  EMAIL_BUTTON_LABEL_MAX,
  EMAIL_SUBJECT_MAX,
  emailTemplateVariables,
  getEmailTemplate,
  getOrganizationProfile,
  isEmailTemplateKind,
  previewEmailTemplate,
} from "@/modules/hub/service";
import { resetEmailTemplateAction } from "../actions";
import { EmailTemplateForm } from "../email-template-form";
import { isTemplateAvailable, templateLocale } from "../groups";

export default async function EmailTemplatePage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ langue?: string; retabli?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { kind } = await params;
  if (!isEmailTemplateKind(kind) || !(await isTemplateAvailable(organizationId, kind))) notFound();
  const query = await searchParams;
  const locale = templateLocale(query.langue, await getLocale());
  const t = await getTranslations("EmailTemplates");
  const tHelp = await getTranslations("Help");
  const tCommon = await getTranslations("Common");
  const [template, preview, profile] = await Promise.all([
    getEmailTemplate(organizationId, kind, locale),
    previewEmailTemplate({ organizationId, kind, locale }),
    getOrganizationProfile(appDatabase(), organizationId),
  ]);
  // Partie opaque de la clé du logo : change à chaque remplacement (comme l'écran des documents).
  const logoVersion = profile.logoKey ? (profile.logoKey.split("/").pop() ?? null) : null;
  const title = t(`kinds.${kind}.title`);

  return (
    <main>
      <Link href={`/parametres/emails?langue=${locale}`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader
        title={t("editorTitle", { title, language: t(`language.${locale}`) })}
        badge={<span className={template.customized ? "badge badge-sauge" : "badge"}>{template.customized ? t("customized") : t("starter")}</span>}
        subtitle={t(`kinds.${kind}.description`)}
      />
      <ScreenHelp title={tHelp("emailTemplates.title")} body={tHelp("emailTemplates.body")} />
      {query.retabli ? <p role="status">{t("resetDone")}</p> : null}
      <EmailTemplateForm
        key={query.retabli ?? "modele"}
        kind={kind}
        locale={locale}
        template={{ subject: template.subject, body: template.body, buttonLabel: template.buttonLabel ?? "" }}
        defaultButton={defaultButtonLabel(kind, locale)}
        variables={emailTemplateVariables(kind, locale).map((variable) => ({ ...variable, description: t(`variables.${variable.key}`) }))}
        initialPreview={preview}
        logoUrl={logoVersion ? `/logo?v=${encodeURIComponent(logoVersion)}` : null}
        signaturePhotoUrl="/profil/signature/photo"
        limits={{ subject: EMAIL_SUBJECT_MAX, body: EMAIL_BODY_MAX, buttonLabel: EMAIL_BUTTON_LABEL_MAX }}
      />
      {template.customized ? (
        <ConfirmDialog
          trigger={t("reset")}
          triggerLabel={t("reset")}
          triggerClassName="link-button"
          title={t("resetTitle")}
          body={t("resetBody")}
          confirmLabel={t("reset")}
          cancelLabel={tCommon("cancel")}
          action={resetEmailTemplateAction}
          fields={{ kind, locale }}
        />
      ) : null}
    </main>
  );
}
