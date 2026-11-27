// Lot 71b (HUB-14, PAR-01 ; spécification du lot 71, § 5.2 ; maquette 06) — la page de reprise d'un
// mariage, en cours ou terminée. Une reprise d'une autre organisation, hors de vue ou inexistante : la
// même page « introuvable » (SEC-13). Au retour d'un import confirmé (`?importe=`), le message de
// retour du lot 70b dit ce qui a été repris et mène au bilan.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShowFeedbackOnMount } from "@/app/ui/feedback";
import { loadTakeoverPage } from "@/lib/takeover/flow";
import { requireTakeoverActor, validId } from "../access";
import { TakeoverView } from "../takeover-view";

export default async function TakeoverPage({ params, searchParams }: { params: Promise<{ takeoverId: string }>; searchParams: Promise<{ importe?: string; saisi?: string }> }) {
  const { actor, eventsEnabled } = await requireTakeoverActor();
  const { takeoverId } = await params;
  const id = validId(takeoverId);
  if (!id || !eventsEnabled) notFound();
  const model = await loadTakeoverPage(actor, id);
  if (!model) notFound();

  const t = await getTranslations("Takeover");
  const query = await searchParams;
  const importedId = validId(query.importe);
  const imported = importedId ? model.rows.find((row) => row.importId === importedId && row.state === "done") : undefined;
  const feedback = imported
    ? {
        title: t("feedbackImported", { step: t(`step.${imported.kind}.title`), figure: imported.figure ? t(`figure.${imported.figure.key}`, { count: imported.figure.count }) : "" }),
        action: { kind: "link" as const, label: t("feedbackSeeSummary"), href: `/import/${importedId}/journal` },
      }
    : query.saisi === "1" && model.eventName
      ? { title: t("feedbackEvent", { event: model.eventName }), detail: t("feedbackEventDetail") }
      : null;

  return (
    <>
      {feedback ? <ShowFeedbackOnMount input={feedback} /> : null}
      <TakeoverView model={model} />
    </>
  );
}
