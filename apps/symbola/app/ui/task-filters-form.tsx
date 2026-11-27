"use client";

// Lot 70c (CHR-03, EVT-03 ; C-33, C-81 ; page 1 des maquettes du lot 68) — les filtres de l'onglet « Tâches »
// de la fiche : Qui s'en charge, Période, Catégorie, État, chacun nommé. Un choix s'applique tout de suite
// (l'adresse change, la page garde sa place) ; sans script, le bouton « Filtrer » envoie le formulaire.
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Option = { value: string; label: string };

export function TaskFiltersForm({
  action,
  hidden,
  filters,
  who,
  categories,
}: {
  // L'adresse de l'écran (« /events/<id> ») et les paramètres à garder (« onglet=taches »).
  action: string;
  hidden: Record<string, string>;
  filters: { who: string; period: string; category: string; state: string };
  who: Option[];
  categories: Option[];
}) {
  const t = useTranslations("TaskLine");
  const router = useRouter();
  const periods: Option[] = [
    { value: "", label: t("periodAll") },
    { value: "en-retard", label: t("periodLate") },
    { value: "semaine", label: t("periodWeek") },
    { value: "quinzaine", label: t("periodFortnight") },
    { value: "mois", label: t("periodMonth") },
  ];
  const states: Option[] = [
    { value: "", label: t("stateTodo") },
    { value: "faites", label: t("stateDone") },
    { value: "toutes", label: t("stateAll") },
  ];
  const fields: { name: string; label: string; value: string; options: Option[] }[] = [
    { name: "qui", label: t("filterWho"), value: filters.who, options: [{ value: "", label: t("filterEveryone") }, ...who] },
    { name: "periode", label: t("filterPeriod"), value: filters.period, options: periods },
    ...(categories.length > 0 ? [{ name: "categorie", label: t("filterCategory"), value: filters.category, options: [{ value: "", label: t("categoryAll") }, ...categories] }] : []),
    { name: "etat", label: t("filterState"), value: filters.state, options: states },
  ];
  return (
    <form
      action={action}
      method="get"
      className="task-filters"
      aria-label={t("filtersLabel")}
      onChange={(event) => {
        const data = new FormData(event.currentTarget);
        const params = new URLSearchParams();
        for (const [key, value] of data.entries()) if (typeof value === "string" && value !== "") params.set(key, value);
        router.replace(`${action}?${params.toString()}`, { scroll: false });
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((field) => (
        <label key={field.name} className="task-filter">
          <span>{field.label}</span>
          <select name={field.name} defaultValue={field.value}>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <noscript>
        <button type="submit" className="button-secondary">
          {t("filterApply")}
        </button>
      </noscript>
    </form>
  );
}
