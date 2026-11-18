// Lot 50 (INV-06 ; D5) — Paramètres › Types de repas : la liste de la synthèse pour le traiteur,
// copiée des données de départ (adulte, enfant, bébé sans repas, prestataire). Renommer, masquer
// (n'efface rien), ajouter. Sans le module Invités : « indisponible » (ARC-07).
import { getLocale, getTranslations } from "next-intl/server";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { listMealTypes } from "@/modules/guests/service";
import { isGuestsAvailable } from "@/app/events/[id]/invites/access";
import { toggleMealTypeAction } from "./actions";
import { AddMealTypeForm, RenameMealTypeForm } from "./meal-type-forms";

export default async function MealTypesPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Guests.mealTypes");
  const tHelp = await getTranslations("Help");
  if (!(await isGuestsAvailable(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  }
  const types = await listMealTypes(organizationId, (await getLocale()) === "en" ? "en" : "fr");
  return (
    <main className="stack">
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("mealTypes.title")} body={tHelp("mealTypes.body")} />
      <p>{t("intro")}</p>
      <section aria-labelledby="meal-types-list" className="card stack">
        <h2 id="meal-types-list">{t("title")}</h2>
        <ul className="plain-list stack">
          {types.map((type) => (
            <li key={type.id} className="stack">
              <span className={type.hidden ? "muted" : undefined}>
                {type.label}
                {type.hidden ? ` (${t("hidden")})` : ""}
              </span>
              <details>
                <summary>{t("rename", { label: type.label })}</summary>
                <RenameMealTypeForm id={type.id} label={type.label} starter={type.starterKey !== null} />
              </details>
              <form action={toggleMealTypeAction}>
                <input type="hidden" name="mealTypeId" value={type.id} />
                <input type="hidden" name="hidden" value={type.hidden ? "false" : "true"} />
                <button type="submit">{type.hidden ? t("show", { label: type.label }) : t("hide", { label: type.label })}</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="meal-types-add" className="card stack">
        <h2 id="meal-types-add">{t("addTitle")}</h2>
        <AddMealTypeForm />
      </section>
    </main>
  );
}
