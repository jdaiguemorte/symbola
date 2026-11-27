// Lot 49 (INV-07, RGP-06 ; D6) — Paramètres › Régimes et allergies : la liste fermée que les
// invités cochent sur leur page de réponse, copiée des données de départ (quatorze allergènes du
// règlement INCO, régimes courants, aucun régime religieux par défaut). Masquer n'efface rien.
// Lot 74g (§ 7.1) : « Invités : régimes et repas », une rubrique, deux blocs ; l'ancienne adresse des
// types de repas (/events/parametres/repas) mène au second (#repas). Le patron vient au lot 74i.
import { getLocale, getTranslations } from "next-intl/server";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { listDietaryOptions } from "@/modules/guests/service";
import { isGuestsAvailable } from "@/app/events/[id]/invites/access";
import { toggleDietaryOptionAction } from "./actions";
import { AddDietaryOptionForm } from "./dietary-option-form";
import { MealTypesBlock } from "../repas/meal-types-block";

export default async function DietaryOptionsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Guests.options");
  const tHelp = await getTranslations("Help");
  const tMenu = await getTranslations("SettingsMenu");
  if (!(await isGuestsAvailable(organizationId))) {
    return (
      <main>
        <h1>{tMenu("rubrics.guestOptions.label")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const options = await listDietaryOptions(organizationId, locale);
  const groups = [
    { kind: "diet" as const, title: t("diets") },
    { kind: "allergen" as const, title: t("allergens") },
  ];
  return (
    <main className="stack">
      <h1>{tMenu("rubrics.guestOptions.label")}</h1>
      <ScreenHelp title={tHelp("dietaryOptions.title")} body={`${tHelp("dietaryOptions.body")} ${tHelp("mealTypes.body")}`} />
      <section aria-labelledby="regimes-title" className="settings-block stack">
      <h2 id="regimes-title">{t("title")}</h2>
      <p>{t("intro")}</p>
      {groups.map((group) => (
        <section key={group.kind} aria-labelledby={`options-${group.kind}`} className="card stack">
          <h3 id={`options-${group.kind}`}>{group.title}</h3>
          <ul className="plain-list stack">
            {options
              .filter((option) => option.kind === group.kind)
              .map((option) => (
                <li key={option.id} className="row-wrap">
                  <span className={option.hidden ? "muted" : undefined}>
                    {option.label}
                    {option.hidden ? ` (${t("hidden")})` : ""}
                  </span>
                  <form action={toggleDietaryOptionAction}>
                    <input type="hidden" name="optionId" value={option.id} />
                    <input type="hidden" name="hidden" value={option.hidden ? "false" : "true"} />
                    <button type="submit">{option.hidden ? t("show", { label: option.label }) : t("hide", { label: option.label })}</button>
                  </form>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <section aria-labelledby="options-add" className="card stack">
        <h3 id="options-add">{t("addTitle")}</h3>
        <AddDietaryOptionForm />
      </section>
      </section>
      <section id="repas" aria-labelledby="repas-title" className="settings-block">
        <MealTypesBlock organizationId={organizationId} />
      </section>
    </main>
  );
}
