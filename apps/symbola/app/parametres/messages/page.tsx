// Lot 38b (HUB-21 ; D10 ; ADR 0072) — Paramètres › Modèles de messages : les messages types de la
// planner, pour tous les évènements ou pour un type ; les deux modèles de départ s'ajoutent d'un
// geste ; un nouveau modèle se crée ici. Demande le module Évènements (CLAUDE.md § 2.2).
import Link from "next/link";
import { EmptyState } from "@/app/ui/empty-state";
import { getLocale, getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { EMAIL_BODY_MAX, EMAIL_SUBJECT_MAX, listMessageTemplates, MESSAGE_TEMPLATE_NAME_MAX, messageTemplateVariables } from "@/modules/hub/service";
import { addStarterMessageTemplatesAction } from "./actions";
import { MessageTemplateForm } from "./message-template-form";

export default async function MessageTemplatesPage({ searchParams }: { searchParams: Promise<{ ajoutes?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("MessageTemplates");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) === "en" ? "en" : "fr";

  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <PageHeader title={t("title")} />
        <p>{t("unavailable")}</p>
      </main>
    );
  }

  const [templates, eventTypes] = await Promise.all([listMessageTemplates(organizationId), ensureEventTypes(organizationId, locale)]);
  const typeLabel = new Map(eventTypes.map((type) => [type.id, type.label]));
  const added = (await searchParams).ajoutes;

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("messageTemplates.title")} body={tHelp("messageTemplates.body")} />
      {added !== undefined && /^\d+$/.test(added) ? <p role="status">{t("startersAdded", { count: Number(added) })}</p> : null}
      {/* Lot 39c (UX-08) : l'écran vide enseigne. */}
      {/* Lot 67c (UX-08 ; R08) : le bouton de l'écran vide ajoute les modèles de départ ; un lien mène au formulaire. */}
      {templates.length === 0 ? (
        <EmptyState
          screen="messageTemplates"
          title={t("empty")}
          action={
            <>
              <form action={addStarterMessageTemplatesAction}>
                <button type="submit">{t("addStarters")}</button>
              </form>
              <Link href="#message-template-new-title" className="button-link">
                {t("writeOwn")}
              </Link>
            </>
          }
        />
      ) : null}
      {templates.length > 0 ? (
        <ul className="item-list" aria-label={t("title")}>
          {templates.map((template) => (
            <li key={template.id}>
              <h2>
                <Link href={`/parametres/messages/${template.id}`}>{template.name}</Link>
              </h2>
              <p className="meta">
                {t("summary", {
                  type: template.eventTypeId ? (typeLabel.get(template.eventTypeId) ?? t("allTypes")) : t("allTypes"),
                  language: t(`language.${template.locale}`),
                  version: template.version,
                })}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {templates.length > 0 ? (
        <form action={addStarterMessageTemplatesAction} id="modeles-de-depart">
          <button type="submit" className="button-ghost">
            {t("addStarters")}
          </button>
        </form>
      ) : null}
      <section aria-labelledby="message-template-new-title" className="settings-block">
        <h2 id="message-template-new-title">{t("newTitle")}</h2>
        <MessageTemplateForm
          eventTypes={eventTypes.map((type) => ({ id: type.id, label: type.label }))}
          variables={messageTemplateVariables(locale).map((variable) => ({ key: variable.key, token: variable.token, description: t(`variables.${variable.key}`) }))}
          limits={{ name: MESSAGE_TEMPLATE_NAME_MAX, subject: EMAIL_SUBJECT_MAX, body: EMAIL_BODY_MAX }}
          locale={locale}
        />
      </section>
    </main>
  );
}
