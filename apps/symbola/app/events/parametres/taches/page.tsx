// Lot 63d (CHR-03, HUB-20 ; recette du 21/11/2026) — rubrique « Catégories des tâches » des Paramètres des
// évènements : les catégories qui rangent les tâches (liste, calendrier d'« Aujourd'hui »), leur couleur
// et leur ordre ; et les deux priorités d'une tâche. Celles de départ (Client, Prestataires,
// Administratif, Jour J) s'installent à la première visite.
// Lot 74h (D7, G8, G9 ; page 30) : au patron d'un écran de réglage. L'en-tête commun ; le seuil de
// « Bientôt » en tête, réglage isolé ; les catégories en liste éditable, « ✓ Enregistré » sur la ligne.
// Toute l'équipe les change (garde de l'équipe, comme avant).
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { taskCategoryPalette } from "@symbola/starter-templates";
import { countTasksByCategory, getTaskSoonDays } from "@/modules/events/service";
import { ScreenHelp } from "@/app/screen-help";
import { SettingsHeader } from "@/app/ui/settings-header";
import { savedIndicatorLabels, settingsScopeLine } from "@/lib/settings/settings-header-texts";
import { requirePlanner } from "@/lib/guards";
import { ensureTaskCategories } from "@/lib/events/task-categories";
import { isEventsModuleEnabled } from "../../module-access";
import { AddTaskCategoryForm, TaskCategoryList, TaskSoonDaysSetting } from "../task-category-forms";

export default async function TaskCategoriesSettingsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("TaskCategories");
  const tMenu = await getTranslations("SettingsMenu");
  if (!(await isEventsModuleEnabled(organizationId))) {
    const tEvents = await getTranslations("Events");
    return (
      <main>
        <h1>{tMenu("rubrics.taskCategories.label")}</h1>
        <p>{tEvents("moduleUnavailable")}</p>
      </main>
    );
  }
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const [categories, counts, soonDays, saved, tPattern] = await Promise.all([
    ensureTaskCategories(organizationId, locale),
    countTasksByCategory(organizationId),
    getTaskSoonDays(organizationId),
    savedIndicatorLabels(),
    getTranslations("SettingsPattern"),
  ]);
  const palette = taskCategoryPalette(locale);
  const scope = await settingsScopeLine({ scope: "agency", editors: "team", saving: "auto", isOwner: auth.user.role === "owner" });

  return (
    <main className="stack">
      <SettingsHeader title={tMenu("rubrics.taskCategories.label")} hint={tPattern("headers.taskCategories")} scope={scope} />
      <ScreenHelp title={tHelp("taskCategories.title")} body={tHelp("taskCategories.body")} />
      <section className="card" aria-label={tPattern("tasks.soonTitle")}>
        <TaskSoonDaysSetting
          days={soonDays}
          saved={saved}
          labels={{ title: tPattern("tasks.soonTitle"), hint: tPattern("tasks.soonHint"), label: tPattern("tasks.soonLabel"), unit: tPattern("tasks.soonUnit"), invalid: tPattern("tasks.soonInvalid"), form: tPattern("tasks.soonTitle") }}
        />
      </section>
      <section className="card" aria-labelledby="task-categories-title">
        <h2 id="task-categories-title">{tPattern("tasks.categoriesTitle")}</h2>
        <p>{tPattern("tasks.categoriesHint")}</p>
        <TaskCategoryList categories={categories} counts={counts} palette={palette} saved={saved} menu={{ menu: tPattern.raw("tasks.rowMenu") as string, removeHint: tPattern("tasks.removeHint") }} />
      </section>
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
