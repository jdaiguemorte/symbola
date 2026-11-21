// Lot 63d (CHR-03, HUB-20) — catégories des tâches : une organisation qui n'en a aucune reçoit celles de
// départ (Client, Prestataires, Administratif, Jour J), dans la langue affichée, à la première visite d'un
// écran qui les montre. La dernière catégorie ne se retire pas : elles ne reviennent donc jamais d'office
// après un choix de la planner.
import type { Locale } from "@symbola/i18n";
import { starterTaskCategories } from "@symbola/starter-templates";
import { addStarterTaskCategories, listTaskCategories, type TaskCategory } from "@/modules/events/service";

export async function ensureTaskCategories(organizationId: string, locale: Locale): Promise<TaskCategory[]> {
  const categories = await listTaskCategories(organizationId);
  if (categories.length > 0) return categories;
  await addStarterTaskCategories(organizationId, starterTaskCategories(locale));
  return listTaskCategories(organizationId);
}
