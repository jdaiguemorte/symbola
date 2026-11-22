// Lot 63d (CHR-03, HUB-20 ; recette du 21/11/2026) — rubrique « Catégories des tâches » des Paramètres des
// évènements : les catégories qui rangent les tâches (liste, calendrier d'« Aujourd'hui »), leur couleur
// et leur ordre ; et les deux priorités d'une tâche. Celles de départ (Client, Prestataires,
// Administratif, Jour J) s'installent à la première visite.
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { taskCategoryPalette } from "@symbola/starter-templates";
import { countTasksByCategory } from "@/modules/events/service";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { ensureTaskCategories } from "@/lib/events/task-categories";
import { isEventsModuleEnabled } from "../../module-access";
import { AddTaskCategoryForm, TaskCategoryList } from "../task-category-forms";

export default async function TaskCategoriesSettingsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("TaskCategories");
  if (!(await isEventsModuleEnabled(organizationId))) {
    const tEvents = await getTranslations("Events");
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{tEvents("moduleUnavailable")}</p>
      </main>
    );
  }
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const [categories, counts] = await Promise.all([ensureTaskCategories(organizationId, locale), countTasksByCategory(organizationId)]);
  const palette = taskCategoryPalette(locale);

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("taskCategories.title")} body={tHelp("taskCategories.body")} />
      <p>{t("intro")}</p>
      <div className="card">
        <TaskCategoryList categories={categories} counts={counts} palette={palette} />
      </div>
      <section aria-labelledby="add-task-category-title" className="card">
        <h2 id="add-task-category-title">{t("add")}</h2>
        <AddTaskCategoryForm palette={palette} />
      </section>
      <section aria-labelledby="task-priority-title" className="card">
        <h2 id="task-priority-title">{t("priorityTitle")}</h2>
        <p>{t("priorityBody")}</p>
      </section>
    </main>
  );
}
