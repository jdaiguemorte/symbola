// Lot 51 (JRJ-06, HUB-20 ; ADR 0091) — Paramètres › Listes du jour J : les modèles de listes de
// contrôle (installation, démontage) de l'organisation, copiés des données de départ à la première
// lecture ; la planner les modifie, en ajoute, en retire. Sans le module Évènements : indisponible.
// Lot 72d (J9) : en tête, le délai de « Ouvrir le Jour J » dans l'en-tête de la fiche.
import { getLocale, getTranslations } from "next-intl/server";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { getDayOfLeadDays, listDayChecklistTemplates } from "@/modules/events/service";
import { DayOfLeadDaysForm } from "./lead-days-form";
import { ChecklistTemplateForm } from "./template-form";
import { ChecklistTemplateList } from "./template-list";

export default async function DayChecklistTemplatesPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("DayChecklists");
  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{tMenu("rubrics.dayChecklists.label")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  }
  const [templates, leadDays] = await Promise.all([listDayChecklistTemplates(organizationId, (await getLocale()) === "en" ? "en" : "fr"), getDayOfLeadDays(organizationId)]);
  return (
    <main>
      <h1>{tMenu("rubrics.dayChecklists.label")}</h1>
      <ScreenHelp title={tHelp("dayChecklists.title")} body={tHelp("dayChecklists.body")} />
      {/* Lot 72d (EVT-02 ; J9) : en tête de l'écran, le délai de « Ouvrir le Jour J » dans l'en-tête de la fiche. */}
      <section className="card">
        <DayOfLeadDaysForm days={leadDays} />
      </section>
      <p>{t("intro")}</p>
      {/* Lot 62b (UX-13, D1) : un tableau, une ligne par modèle. */}
      <section className="card" aria-labelledby="day-checklist-list">
        <h2 id="day-checklist-list" className="sr-only">
          {t("title")}
        </h2>
        {templates.length === 0 ? <p>{t("empty")}</p> : <ChecklistTemplateList templates={templates.map((template) => ({ id: template.id, name: template.name, phase: template.phase, items: template.items }))} />}
      </section>
      <section className="card" aria-labelledby="day-checklist-new">
        <h2 id="day-checklist-new">{t("addTitle")}</h2>
        <ChecklistTemplateForm />
      </section>
    </main>
  );
}
