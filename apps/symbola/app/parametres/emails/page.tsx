// Lot 38a (MSG-01 ; D3, D6 ; ADR 0072) — Paramètres › Modèles d'e-mails : les e-mails que Symbola
// envoie au nom de l'organisation, rangés par sujet, en français et en anglais ; chacun dit s'il a
// été personnalisé. Les modèles d'un module non souscrit ne sont pas proposés.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { getRelationMailSender, isRelationEmailKind, listEmailTemplates } from "@/modules/hub/service";
import { EMAIL_TEMPLATE_GROUPS, enabledTemplateModules, templateLocale } from "./groups";
import { RelationMailSenderForm } from "./sender-form";

export default async function EmailTemplatesPage({ searchParams }: { searchParams: Promise<{ langue?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("EmailTemplates");
  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  const locale = templateLocale((await searchParams).langue, await getLocale());
  const [templates, modules, sender] = await Promise.all([listEmailTemplates(organizationId, locale), enabledTemplateModules(organizationId), getRelationMailSender(organizationId)]);
  const byKind = new Map(templates.map((template) => [template.kind, template]));
  const groups = EMAIL_TEMPLATE_GROUPS.filter((group) => modules.has(group.module));

  return (
    <main>
      <PageHeader title={tMenu("rubrics.emailTemplates.label")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("emailTemplates.title")} body={tHelp("emailTemplates.body")} />
      {/* Lot 65d (MSG-01 ; ADR 0110) : qui envoie les messages de la relation. */}
      <section aria-labelledby="email-sender-title" className="card">
        <h2 id="email-sender-title">{t("sender.legend")}</h2>
        <RelationMailSenderForm sender={sender} disabled={auth.user.role !== "owner"} />
      </section>
      {/* Lot 66c (HUB-18 ; D5, D6 ; ADR 0113) : police, pied, nom affiché, modèle des signatures. */}
      <section aria-labelledby="email-branding-link-title" className="card">
        <h2 id="email-branding-link-title">
          <Link href="/parametres/emails/marque">{t("brandingLink")}</Link>
        </h2>
        <p className="meta">{t("brandingLinkHint")}</p>
      </section>
      <p>{t("intro")}</p>
      <nav aria-label={t("languageLabel")} className="segmented">
        {(["fr", "en"] as const).map((language) => (
          <Link key={language} href={`/parametres/emails?langue=${language}`} aria-current={language === locale ? "page" : undefined}>
            {t(`language.${language}`)}
          </Link>
        ))}
      </nav>
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`email-templates-${group.key}`}>
          <h2 id={`email-templates-${group.key}`}>{t(`groups.${group.key}`)}</h2>
          <ul className="item-list">
            {group.kinds.map((kind) => {
              const template = byKind.get(kind);
              return (
                <li key={kind}>
                  <h3>
                    <Link href={`/parametres/emails/${kind}?langue=${locale}`}>{t(`kinds.${kind}.title`)}</Link>
                  </h3>
                  <span className={template?.customized ? "badge badge-sauge" : "badge"}>{template?.customized ? t("customized") : t("starter")}</span>
                  {isRelationEmailKind(kind) && sender === "planner" ? <span className="badge">{t("sender.preparedBadge")}</span> : null}
                  <p className="meta">{t(`kinds.${kind}.description`)}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
