"use client";

// Lot 70d (CHR-03, CHR-02, UX-05, UX-12 ; C-33, C-32, C-77, C-81, M8 ; page 2 des maquettes du lot 68) — les
// filtres de l'écran « Tâches ». À l'ordinateur, la barre de filtres de DESIGN.md (lot 63) : Évènement, Qui
// s'en charge, Période, Catégorie, État, chacun nommé au-dessus de sa liste ; chaque filtre posé devient
// une pastille « × » qui se retire seule, et « Effacer les filtres » paraît dès le premier. Sur téléphone,
// la liste passe avant les filtres : « Filtres » (avec le nombre de filtres posés) et « Mes tâches » en un
// toucher ; le panneau du bas s'ouvre sur les réglages en cours, commence par « Mes tâches », « En retard »,
// « Cette semaine », et finit par « Voir les N tâches », son seul bouton plein. Un choix s'applique tout de
// suite (l'adresse change, la page garde sa place) ; sans script, « Filtrer » envoie le formulaire.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Option = { value: string; label: string };
export type FilterChip = { key: string; label: string; href: string };

export type ScreenFilterValues = { evenement: string; qui: string; periode: string; du: string; au: string; categorie: string; etat: string; grouper: string };

const FIELDS = ["evenement", "qui", "periode", "categorie", "etat"] as const;

// L'adresse d'après un choix : celle de la page à cet instant (un autre choix a pu la changer entre-temps),
// avec le choix fait ; sans tâche ouverte.
function hrefOf(changes: Partial<ScreenFilterValues>, keep: Record<string, string>): string {
  const params = new URLSearchParams(window.location.search);
  for (const key of ["tache", "nouvelle", "copie"]) params.delete(key);
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  // « Jour » ne regroupe que les tâches faites ; « Mois » est le défaut des autres.
  const done = params.get("etat") === "faites";
  if ((params.get("grouper") === "jour" && !done) || (params.get("grouper") === "mois" && !done) || (params.get("grouper") === "jour" && done)) params.delete("grouper");
  if (params.get("periode") !== "entre") {
    params.delete("du");
    params.delete("au");
  }
  for (const [key, value] of Object.entries(keep)) if (value && !params.has(key)) params.set(key, value);
  const query = params.toString();
  return query ? `/taches?${query}` : "/taches";
}

function useScreenValues(current: ScreenFilterValues, keep: Record<string, string>) {
  const router = useRouter();
  const [values, setValues] = useState(current);
  const signature = JSON.stringify(current);
  // L'adresse a changé (une pastille retirée, « Effacer ») : les listes la suivent.
  useEffect(() => setValues(JSON.parse(signature) as ScreenFilterValues), [signature]);
  const change = (changes: Partial<ScreenFilterValues>) => {
    const next = { ...values, ...changes };
    setValues(next);
    // « Entre deux dates » attend ses deux dates.
    if (next.periode === "entre" && (!next.du || !next.au)) return;
    router.replace(hrefOf(next.periode === "entre" ? { ...changes, periode: "entre", du: next.du, au: next.au } : changes, keep), { scroll: false });
  };
  return { values, change };
}

type FieldsProps = {
  values: ScreenFilterValues;
  change: (changes: Partial<ScreenFilterValues>) => void;
  events: Option[];
  who: Option[];
  categories: Option[];
  idPrefix: string;
};

function Fields({ values, change, events, who, categories, idPrefix }: FieldsProps) {
  const t = useTranslations("TaskScreen");
  const tLine = useTranslations("TaskLine");
  const options: Record<(typeof FIELDS)[number], { label: string; options: Option[] }> = {
    evenement: { label: tLine("fieldEvent"), options: [{ value: "", label: t("eventAll") }, { value: "hors", label: tLine("noEvent") }, ...events] },
    qui: { label: tLine("filterWho"), options: [{ value: "", label: tLine("filterEveryone") }, ...who] },
    periode: {
      label: tLine("filterPeriod"),
      options: [
        { value: "", label: tLine("periodAll") },
        { value: "retard", label: tLine("periodLate") },
        { value: "semaine", label: tLine("periodWeek") },
        { value: "15j", label: t("periodFortnightLate") },
        { value: "mois", label: tLine("periodMonth") },
        { value: "entre", label: t("periodBetween") },
      ],
    },
    categorie: { label: tLine("filterCategory"), options: [{ value: "", label: tLine("categoryAll") }, ...categories] },
    etat: {
      label: tLine("filterState"),
      options: [
        { value: "", label: tLine("stateTodo") },
        { value: "faites", label: tLine("stateDone") },
        { value: "toutes", label: tLine("stateAll") },
      ],
    },
  };
  return (
    <>
      {FIELDS.filter((name) => name !== "categorie" || categories.length > 0).map((name) => (
        <label key={name} className="task-filter" htmlFor={`${idPrefix}-${name}`}>
          <span>{options[name].label}</span>
          <select id={`${idPrefix}-${name}`} name={name} value={values[name]} onChange={(event) => change({ [name]: event.target.value })}>
            {options[name].options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {values.periode === "entre" ? (
        <>
          <label className="task-filter" htmlFor={`${idPrefix}-du`}>
            <span>{t("periodFrom")}</span>
            <input id={`${idPrefix}-du`} type="date" name="du" value={values.du} onChange={(event) => change({ du: event.target.value })} />
          </label>
          <label className="task-filter" htmlFor={`${idPrefix}-au`}>
            <span>{t("periodTo")}</span>
            <input id={`${idPrefix}-au`} type="date" name="au" value={values.au} onChange={(event) => change({ au: event.target.value })} />
          </label>
        </>
      ) : null}
    </>
  );
}

const SHEET_ID = "task-filters-sheet";

// Sur téléphone, sur la ligne du titre (la liste passe avant les filtres) : « Filtres », avec le nombre de
// filtres posés, et « Mes tâches » en un toucher.
export function TaskFiltersPhoneButtons({ count, mine }: { count: number; mine: { href: string; active: boolean } }) {
  const t = useTranslations("TaskScreen");
  return (
    <div className="task-filters-phone" data-tour="tasks-filters">
      <button type="button" className="button-secondary" aria-haspopup="dialog" aria-controls={SHEET_ID} onClick={() => (document.getElementById(SHEET_ID) as HTMLDialogElement | null)?.showModal()}>
        {t("filters")}
        {count > 0 ? (
          <span className="task-filters-count">
            <span aria-hidden="true">{count}</span>
            <span className="sr-only">{t("filtersActive", { count })}</span>
          </span>
        ) : null}
      </button>
      <Link href={mine.href} scroll={false} className="button-link task-mine" aria-current={mine.active ? "true" : undefined}>
        {t("mine")}
      </Link>
    </div>
  );
}

export function GroupBySelect({ current, keep, done, idPrefix = "grouper" }: { current: ScreenFilterValues; keep: Record<string, string>; done: boolean; idPrefix?: string }) {
  const t = useTranslations("TaskScreen");
  const { values, change } = useScreenValues(current, keep);
  const value = values.grouper || (done ? "jour" : "mois");
  return (
    <label className="task-group-by" htmlFor={idPrefix}>
      <span>{t("groupBy")}</span>
      <select id={idPrefix} value={value} onChange={(event) => change({ grouper: event.target.value === (done ? "jour" : "mois") ? "" : event.target.value })}>
        {done ? <option value="jour">{t("groupDay")}</option> : <option value="mois">{t("groupMonth")}</option>}
        <option value="evenement">{t("groupEvent")}</option>
        <option value="qui">{t("groupWho")}</option>
      </select>
    </label>
  );
}

export function TaskScreenFilters({
  current,
  keep,
  events,
  who,
  categories,
  chips,
  clearHref,
  mine,
  quick,
  shown,
  done,
  display,
}: {
  current: ScreenFilterValues;
  // Les paramètres d'affichage gardés (calendrier et son mois).
  keep: Record<string, string>;
  events: Option[];
  who: Option[];
  categories: Option[];
  chips: FilterChip[];
  clearHref: string;
  // « Mes tâches » : l'adresse qui le pose (ou le retire) et s'il est posé.
  mine: { href: string; active: boolean };
  // Les raccourcis du panneau du téléphone : « En retard », « Cette semaine ».
  quick: { key: string; label: string; href: string; active: boolean }[];
  shown: number;
  done: boolean;
  // Liste ou calendrier : sur téléphone, le choix est dans le panneau.
  display: { label: string; list: { label: string; href: string }; calendar: { label: string; href: string }; isCalendar: boolean };
}) {
  const t = useTranslations("TaskScreen");
  const tLine = useTranslations("TaskLine");
  const { values, change } = useScreenValues(current, keep);
  const sheet = useRef<HTMLDialogElement>(null);
  const close = () => sheet.current?.close();

  return (
    <div className="task-screen-filters">
      {/* À l'ordinateur : la barre de filtres, puis les pastilles. */}
      <form action="/taches" method="get" className="task-filters task-filters-desktop" data-tour="tasks-filters" aria-label={tLine("filtersLabel")} onSubmit={(event) => event.preventDefault()}>
        {Object.entries(keep).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
        <Fields values={values} change={change} events={events} who={who} categories={categories} idPrefix="filtre" />
        <Link href={mine.href} scroll={false} className="button-link task-mine" aria-current={mine.active ? "true" : undefined}>
          {t("mine")}
        </Link>
        <noscript>
          <button type="submit" className="button-secondary">
            {tLine("filterApply")}
          </button>
        </noscript>
      </form>
      {chips.length > 0 ? (
        <ul className="task-chips task-filters-desktop" aria-label={t("activeFilters")}>
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link href={chip.href} scroll={false} className="task-chip" aria-label={t("removeFilter", { filter: chip.label })}>
                {chip.label} <span aria-hidden="true">×</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href={clearHref} scroll={false} className="task-chips-clear">
              {t("clearFilters")}
            </Link>
          </li>
        </ul>
      ) : null}

      {/* Sur téléphone : le panneau du bas, ouvert par « Filtres » (en tête de l'écran). */}
      <dialog ref={sheet} id={SHEET_ID} className="task-filters-sheet" aria-labelledby="task-filters-sheet-title" onClick={(event) => event.target === sheet.current && close()}>
        <div className="task-filters-sheet-head">
          <h2 id="task-filters-sheet-title">{t("filters")}</h2>
          {chips.length > 0 ? (
            <Link href={clearHref} scroll={false} className="task-chips-clear">
              {t("clear")}
            </Link>
          ) : null}
          <button type="button" className="button-ghost" onClick={close} aria-label={t("closeFilters")}>
            ×
          </button>
        </div>
        <ul className="task-quick" aria-label={t("quickFilters")}>
          <li>
            <Link href={mine.href} scroll={false} className="task-chip" aria-current={mine.active ? "true" : undefined}>
              {t("mine")}
            </Link>
          </li>
          {quick.map((item) => (
            <li key={item.key}>
              <Link href={item.href} scroll={false} className="task-chip" aria-current={item.active ? "true" : undefined}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="task-filters-sheet-fields">
          <Fields values={values} change={change} events={events} who={who} categories={categories} idPrefix="filtre-tel" />
          <GroupBySelect current={current} keep={keep} done={done} idPrefix="grouper-tel" />
        </div>
        <nav aria-label={display.label} className="segmented task-filters-display">
          <Link href={display.list.href} scroll={false} aria-current={display.isCalendar ? undefined : "page"} onClick={close}>
            {display.list.label}
          </Link>
          <Link href={display.calendar.href} scroll={false} aria-current={display.isCalendar ? "page" : undefined} onClick={close}>
            {display.calendar.label}
          </Link>
        </nav>
        <button type="button" className="button-primary task-filters-show" onClick={close}>
          {t("showTasks", { count: shown })}
        </button>
      </dialog>
    </div>
  );
}
