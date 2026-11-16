// Lot 38b (HUB-21 ; D10 ; ADR 0072) — un modèle de message : le modifier (un texte changé fait une
// version), relire et restaurer ses versions, le dupliquer, le supprimer (confirmé).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { EMAIL_BODY_MAX, EMAIL_SUBJECT_MAX, getMessageTemplate, MESSAGE_TEMPLATE_NAME_MAX, messageTemplateVariables } from "@/modules/hub/service";
import { deleteMessageTemplateAction, duplicateMessageTemplateAction, restoreMessageTemplateAction } from "../actions";
import { MessageTemplateForm } from "../message-template-form";

export default async function MessageTemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ restaure?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { id } = await params;
  if (!isValidId(id) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const template = await getMessageTemplate(organizationId, id);
  if (!template) notFound();
  const t = await getTranslations("MessageTemplates");
  const tHelp = await getTranslations("Help");
  const tCommon = await getTranslations("Common");
  const uiLocale = (await getLocale()) as Locale;
  const eventTypes = await ensureEventTypes(organizationId, uiLocale);
  const typeLabel = template.eventTypeId ? (eventTypes.find((type) => type.id === template.eventTypeId)?.label ?? t("allTypes")) : t("allTypes");
  const restored = (await searchParams).restaure;

  return (
    <main>
      <Link href="/parametres/messages" className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={template.name} subtitle={t("summary", { type: typeLabel, language: t(`language.${template.locale}`), version: template.version })} />
      <ScreenHelp title={tHelp("messageTemplates.title")} body={tHelp("messageTemplates.body")} />
      {restored ? <p role="status">{t("restored")}</p> : null}
      <MessageTemplateForm
        key={restored ?? "modele"}
        template={{ id: template.id, name: template.name, eventTypeId: template.eventTypeId, subject: template.subject, body: template.body }}
        eventTypes={eventTypes.map((type) => ({ id: type.id, label: type.label }))}
        variables={messageTemplateVariables(template.locale).map((variable) => ({ key: variable.key, token: variable.token, description: t(`variables.${variable.key}`) }))}
        limits={{ name: MESSAGE_TEMPLATE_NAME_MAX, subject: EMAIL_SUBJECT_MAX, body: EMAIL_BODY_MAX }}
        locale={template.locale}
      />

      <details className="settings-block">
        <summary>{t("versionsTitle", { count: template.versions.length })}</summary>
        <ul className="item-list" aria-label={t("versionsTitle", { count: template.versions.length })}>
          {template.versions.map((version) => (
            <li key={version.version}>
              <h3>
                {t("versionLine", { version: version.version, date: formatDateTime(new Date(version.createdAt), uiLocale) })}
                {version.version === template.version ? ` (${t("current")})` : null}
              </h3>
              <p>
                <strong>{version.subject}</strong>
              </p>
              <p className="message-text">{version.body}</p>
              {version.version === template.version ? null : (
                <form action={restoreMessageTemplateAction}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <input type="hidden" name="version" value={version.version} />
                  <button type="submit" className="button-ghost">
                    {t("restore", { version: version.version })}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </details>

      <div className="row-wrap">
        <form action={duplicateMessageTemplateAction}>
          <input type="hidden" name="templateId" value={template.id} />
          <button type="submit" className="button-ghost">
            {t("duplicate")}
          </button>
        </form>
        <ConfirmDialog
          trigger={t("delete")}
          triggerLabel={t("delete")}
          triggerClassName="link-button"
          title={t("deleteTitle", { name: template.name })}
          body={t("deleteBody")}
          confirmLabel={t("delete")}
          cancelLabel={tCommon("cancel")}
          action={deleteMessageTemplateAction}
          fields={{ templateId: template.id }}
        />
      </div>
    </main>
  );
}
