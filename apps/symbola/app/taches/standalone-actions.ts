"use server";

// Lot 53 (CHR-10 ; D6) — tâches hors évènement : ajouter (avec sa répétition), cocher (la suivante naît
// si elle se répète), supprimer (corbeille). Le module Évènements valide tout (Zod) ; une tâche d'une
// autre organisation ou d'un évènement n'est pas touchée (RLS, event_id nul exigé).
import { revalidatePath } from "next/cache";
import { parisToday } from "@symbola/i18n";
import { PlanningInputError, setStandaloneTaskDone } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";


export async function completeStandaloneTaskAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  try {
    const now = new Date();
    await setStandaloneTaskDone(auth.user.organizationId, String(formData.get("taskId") ?? ""), true, now, parisToday(now));
  } catch (error) {
    if (!(error instanceof PlanningInputError)) throw error;
  }
  revalidatePath("/taches");
  revalidatePath("/");
}
