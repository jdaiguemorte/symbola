"use server";

// Lot 33b (HUB-10, PAR-01 ; D10), revu au lot 74a (HUB-10 ; C-67, D8, B6, B13) — « Votre espace est prêt » :
// le premier mariage se crée dans « Nouvel évènement » (la seule entrée, D8) ; reste ici « Ouvrir un mariage
// d'exemple », le mariage de référence en données fictives (30 jours). Le formulaire en ligne, dont la case du
// rétroplanning était cochée d'avance, est retiré (C-67). Contrôles côté serveur : session de l'équipe,
// organisation, module Évènements.
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { startExampleEvent } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "@/app/events/module-access";

async function team() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

export async function exploreExampleAction(): Promise<void> {
  const access = await team();
  if (!access) redirect("/");
  const example = await startExampleEvent({
    organizationId: access.organizationId,
    userId: access.userId,
    locale: (await getLocale()) === "en" ? "en" : "fr",
  });
  redirect(`/events/${example.eventId}`);
}
