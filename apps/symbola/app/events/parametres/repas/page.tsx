// Lot 50 (INV-06 ; D5) — Paramètres › Types de repas : la liste de la synthèse pour le traiteur,
// copiée des données de départ (adulte, enfant, bébé sans repas, prestataire). Renommer, masquer
// (n'efface rien), ajouter. Sans le module Invités : « indisponible » (ARC-07).
import { getLocale, getTranslations } from "next-intl/server";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { listMealTypes } from "@/modules/guests/service";
import { isGuestsAvailable } from "@/app/events/[id]/invites/access";
import { AddMealTypeForm, MealTypeList } from "./meal-type-forms";

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
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("mealTypes.title")} body={tHelp("mealTypes.body")} />
      <p>{t("intro")}</p>
      {/* Lot 62b (UX-13, D1) : tableau éditable, enregistré à la sortie du champ. */}
      <section aria-labelledby="meal-types-list" className="card">
        <h2 id="meal-types-list" className="sr-only">
          {t("title")}
        </h2>
        <MealTypeList types={types.map((type) => ({ id: type.id, label: type.label, hidden: type.hidden, starter: type.starterKey !== null }))} />
      </section>
      <section aria-labelledby="meal-types-add" className="card">
        <h2 id="meal-types-add">{t("addTitle")}</h2>
        <AddMealTypeForm />
      </section>
    </main>
  );
}
