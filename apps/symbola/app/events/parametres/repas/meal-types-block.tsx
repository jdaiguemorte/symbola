// Lot 50 (INV-06 ; D5) — Types de repas : la liste de la synthèse pour le traiteur, copiée des données de
// départ (adulte, enfant, bébé sans repas, prestataire). Renommer, masquer (n'efface rien), ajouter.
// Lot 74g : un bloc de la rubrique « Invités : régimes et repas » (/events/parametres/regimes#repas),
// tableau et formulaires inchangés.
import { getLocale, getTranslations } from "next-intl/server";
import { listMealTypes } from "@/modules/guests/service";
import { AddMealTypeForm, MealTypeList } from "./meal-type-forms";

export async function MealTypesBlock({ organizationId }: { organizationId: string }) {
  const t = await getTranslations("Guests.mealTypes");
  const types = await listMealTypes(organizationId, (await getLocale()) === "en" ? "en" : "fr");
  return (
    <>
      <h2 id="repas-title">{t("title")}</h2>
      <p>{t("intro")}</p>
      {/* Lot 62b (UX-13, D1) : tableau éditable, enregistré à la sortie du champ. */}
      <section aria-labelledby="meal-types-list" className="card">
        <h3 id="meal-types-list" className="sr-only">
          {t("title")}
        </h3>
        <MealTypeList types={types.map((type) => ({ id: type.id, label: type.label, hidden: type.hidden, starter: type.starterKey !== null }))} />
      </section>
      <section aria-labelledby="meal-types-add" className="card">
        <h3 id="meal-types-add">{t("addTitle")}</h3>
        <AddMealTypeForm />
      </section>
    </>
  );
}
