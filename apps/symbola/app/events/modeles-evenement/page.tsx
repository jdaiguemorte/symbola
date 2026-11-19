// Lot 58 (EVT-08 ; D5 ; ADR 0097) — les modèles d'évènement de l'organisation : structures seulement
// (rétroplanning, programme, postes et lignes du budget sans montant, questionnaires, prestataires en
// option), jamais de donnée de client. Un modèle s'enregistre depuis la clôture d'un évènement.
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { listEventTemplates } from "@/modules/events/service";
import { isEventsModuleEnabled } from "../module-access";
import { removeTemplateAction } from "./actions";
import { CreateFromTemplateForm } from "./create-form";

export default async function EventTemplatesPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) notFound();
  const t = await getTranslations("EventTemplates");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const templates = await listEventTemplates(organizationId);
  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("eventTemplatesList.title")} body={tHelp("eventTemplatesList.body")} />
      {templates.length === 0 ? <p>{t("empty")}</p> : null}
      <ul className="plain-list stack" aria-label={t("listLabel")}>
        {templates.map((template) => (
          <li key={template.id} className="card stack">
            <h2>{template.name}</h2>
            <p className="muted">
              {t("counts", { tasks: template.taskCount, program: template.programCount, slots: template.slotCount })}
              {template.includesVendors ? ` · ${t("withVendors")}` : ""} · {formatDate(new Date(template.createdAt), locale)}
            </p>
            <CreateFromTemplateForm templateId={template.id} name={template.name} />
            <form action={removeTemplateAction} className="inline-form">
              <input type="hidden" name="templateId" value={template.id} />
              <button type="submit" className="button-link" aria-label={t("removeLabel", { name: template.name })}>
                <Trash2 aria-hidden="true" />
                {t("remove")}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
