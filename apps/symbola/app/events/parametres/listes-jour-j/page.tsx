// Lot 51 (JRJ-06, HUB-20 ; ADR 0091) — Paramètres › Listes du jour J : les modèles de listes de
// contrôle (installation, démontage) de l'organisation, copiés des données de départ à la première
// lecture ; la planner les modifie, en ajoute, en retire. Sans le module Évènements : indisponible.
import { getLocale, getTranslations } from "next-intl/server";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { listDayChecklistTemplates } from "@/modules/events/service";
import { removeChecklistTemplateAction } from "./actions";
import { ChecklistTemplateForm } from "./template-form";

export default async function DayChecklistTemplatesPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("DayChecklists");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  }
  const templates = await listDayChecklistTemplates(organizationId, (await getLocale()) === "en" ? "en" : "fr");
  return (
    <main className="stack">
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("dayChecklists.title")} body={tHelp("dayChecklists.body")} />
      <p>{t("intro")}</p>
      <ul className="plain-list stack">
        {templates.map((template) => (
          <li key={template.id} className="card stack">
            <h2>
              {template.name} <span className="muted">· {t(template.phase)}</span>
            </h2>
            <p className="muted">{t("count", { count: template.items.length })}</p>
            <details>
              <summary>{t("edit", { name: template.name })}</summary>
              <ChecklistTemplateForm template={template} />
            </details>
            <form action={removeChecklistTemplateAction}>
              <input type="hidden" name="templateId" value={template.id} />
              <button type="submit" className="button-ghost">
                {t("remove", { name: template.name })}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <section className="card stack" aria-labelledby="day-checklist-new">
        <h2 id="day-checklist-new">{t("addTitle")}</h2>
        <ChecklistTemplateForm template={null} />
      </section>
    </main>
  );
}
