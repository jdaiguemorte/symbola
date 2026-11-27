// Lot 71b (HUB-14, PAR-01 ; spécification du lot 71, § 5.2 ; maquette 06) — « Reprendre un mariage en
// cours », la page neuve : par « Nouvel évènement › Reprendre ses fichiers », la fin de l'assistant de
// démarrage, la recherche. Ouverte depuis un mariage (`?evenement=`, l'état vide de « Tâches »), elle
// mène à sa reprise, ou montre une page où le mariage est déjà là. Rien n'est écrit avant la première
// action. Un mariage d'une autre organisation, hors de vue ou d'essai : la page n'existe pas (SEC-13).
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { loadNewTakeoverPage } from "@/lib/takeover/flow";
import { parseStepKind, requireTakeoverActor, validId } from "./access";
import { TakeoverView } from "./takeover-view";

export default async function NewTakeoverPage({ searchParams }: { searchParams: Promise<{ evenement?: string; ligne?: string }> }) {
  const { actor, eventsEnabled } = await requireTakeoverActor();
  if (!eventsEnabled) {
    const t = await getTranslations("Events");
    const tHelp = await getTranslations("Help");
    return (
      <main>
        <ScreenHelp title={tHelp("takeover.title")} body={tHelp("takeover.body")} />
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const query = await searchParams;
  const eventId = query.evenement === undefined ? null : validId(query.evenement);
  if (query.evenement !== undefined && !eventId) notFound();
  const page = await loadNewTakeoverPage(actor, eventId, parseStepKind(query.ligne));
  if (page.kind === "not_found") notFound();
  if (page.kind === "redirect") redirect(page.href);
  return <TakeoverView model={page.model} />;
}
