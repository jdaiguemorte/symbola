// Lot 51 (JRJ-06 ; ADR 0091) — « Préparer les listes » : la planner ajoute à un temps fort une liste
// copiée d'un modèle de l'organisation (installation, démontage), ajoute ou retire une case. Les
// modèles se règlent dans les paramètres (/parametres/listes-jour-j).
import { getTranslations } from "next-intl/server";
import { addDayChecklistItemAction, createDayChecklistAction, removeDayChecklistAction, removeDayChecklistItemAction } from "./day-checklist-actions";

export async function DayChecklistsPrep(props: {
  eventId: string;
  moments: { id: string; name: string }[];
  templates: { id: string; name: string; phase: "setup" | "teardown" }[];
  lists: { id: string; name: string; items: { id: string; label: string; checked: boolean }[] }[];
}) {
  const t = await getTranslations("DayOf");
  return (
    <details className="card day-documents-choice" id="preparer-listes">
      <summary>{t("prepTitle")}</summary>
      <p>{t("prepHint")}</p>
      <form action={createDayChecklistAction} className="field-prep">
        <input type="hidden" name="eventId" value={props.eventId} />
        <label>
          {t("prepTemplate")}
          <select name="templateId" required>
            {props.templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({t(`phase.${template.phase}`)})
              </option>
            ))}
          </select>
        </label>
        {props.moments.length > 0 ? (
          <label>
            {t("prepMoment")}
            <select name="keyMomentId">
              {props.moments.map((moment) => (
                <option key={moment.id} value={moment.id}>
                  {moment.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit">{t("prepAdd")}</button>
      </form>
      <p>
        <a href="/parametres/listes-jour-j">{t("prepTemplatesLink")}</a>
      </p>
      {props.lists.map((list) => (
        <div key={list.id} className="field-prep-list">
          <h3>{list.name}</h3>
          <ul className="day-list">
            {list.items.map((item) => (
              <li key={item.id}>
                {item.label}
                {item.checked ? null : (
                  <form action={removeDayChecklistItemAction}>
                    <input type="hidden" name="eventId" value={props.eventId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button type="submit" className="button-ghost" aria-label={t("prepRemoveItem", { label: item.label })}>
                      {t("prepRemove")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <form action={addDayChecklistItemAction} className="field-prep">
            <input type="hidden" name="eventId" value={props.eventId} />
            <input type="hidden" name="checklistId" value={list.id} />
            <label>
              {t("prepNewItem")}
              <input name="label" required maxLength={200} />
            </label>
            <button type="submit">{t("prepAddItem")}</button>
          </form>
          {list.items.every((item) => !item.checked) ? (
            <form action={removeDayChecklistAction}>
              <input type="hidden" name="eventId" value={props.eventId} />
              <input type="hidden" name="checklistId" value={list.id} />
              <button type="submit" className="button-ghost">
                {t("prepRemoveList", { name: list.name })}
              </button>
            </form>
          ) : null}
        </div>
      ))}
    </details>
  );
}
